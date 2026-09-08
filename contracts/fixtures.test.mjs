import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateWire } from '../packages/typescript/src/generated/validators.ts';
import { Ja3ProxyClient } from '../packages/typescript/src/index.ts';

// wire.json is emitted by Rust from actual DTO values. The exporter checks every
// rustAccepts expectation with serde; this suite checks the other side of that
// same contract through the SDK's real precompiled validator bridge.
const document = JSON.parse(await readFile(new URL('./fixtures/wire.json', import.meta.url), 'utf8'));
for (const fixture of document.fixtures) {
  test(fixture.name, () => {
    assert.equal(validateWire(fixture.contract, fixture.value), fixture.valid,
      `${fixture.reason} Rust deserialization accepts this value: ${fixture.rustAccepts}`);
  });
}

const diagnostics = document.fixtures.find((fixture) => fixture.name === 'diagnostics-rust-serialized').value;

test('JS non-finite counters fail before JSON can silently turn them into null', () => {
  for (const responseBytes of [NaN, Infinity, -Infinity]) {
    assert.equal(validateWire('diagnostics', { ...diagnostics, responseBytes }), false);
  }
});

test('transport-error validation does not coerce a numeric-looking counter from a string', () => {
  assert.equal(validateWire('transportError', {
    code: 'CANCELLED',
    message: 'Die Anfrage wurde abgebrochen.',
    diagnostics: { ...diagnostics, responseBytes: '4' },
  }), false);
});

test('nested snapshot expiry is subject to the same exact-integer boundary as direct cookie records', () => {
  const snapshot = structuredClone(document.fixtures.find((fixture) =>
    fixture.name === 'cookieSnapshot-rust-serialized').value);
  snapshot.cookies[0].expiresAtMs = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(validateWire('cookieSnapshot', snapshot), false);
  snapshot.cookies[0].expiresAtMs = Number.MAX_SAFE_INTEGER;
  assert.equal(validateWire('cookieSnapshot', snapshot), true);
});

const semantics = JSON.parse(await readFile(new URL('./fixtures/request-semantics.json', import.meta.url), 'utf8'));
const capabilities = document.fixtures.find((fixture) => fixture.name === 'capabilities-rust-serialized').value;
const cancelled = document.fixtures.find((fixture) => fixture.name === 'transportError-Cancelled').value;

function requestOptions(value) {
  return {
    requestId: value.requestId,
    partition: value.partition,
    url: value.url,
    method: value.method,
    headers: value.headers,
    timeoutMs: value.timeoutMs,
    maxResponseBytes: value.maxResponseBytes,
    attempt: value.attempt,
    ...(value.connection == null ? {} : { connection: value.connection }),
    ...(value.contextId == null ? {} : { contextId: value.contextId }),
    body: value.hasBody ? new Uint8Array(value.bodyLength) : null,
  };
}

for (const fixture of semantics.fixtures) {
  test(`request semantics: ${fixture.name}`, async () => {
    // These are intentionally schema-valid, including the semantically invalid
    // values. Moving the assertion to validateWire would bypass the SDK boundary.
    assert.equal(validateWire('requestMetadata', fixture.value), fixture.schemaValid);
    let requests = 0;
    let serviceCalls = 0;
    let uploaded;
    const client = new Ja3ProxyClient({
      baseUrl: 'http://127.0.0.1:8787',
      token: 'contract-test-dedicated-credential-32',
      transport: async (url, init) => {
        serviceCalls++;
        if (new URL(url).pathname === '/capabilities') return Response.json(capabilities);
        requests++;
        uploaded = new Uint8Array(await new Response(init.body).arrayBuffer());
        // End the exercise with an actual Rust-serialized safe service error;
        // this test is about what the SDK sends, not fabricated upstream success.
        return Response.json(cancelled, { status: 400 });
      },
    });
    try {
      const result = await client.tryRequest(requestOptions(fixture.value));
      assert.equal(result.ok, false);
      if (fixture.sdkBoundary === 'reject') {
        assert.equal(fixture.semanticValid, false);
        assert.equal(result.error.code, fixture.errorCode);
        assert.equal(serviceCalls, 0, 'Locally invalid requests must never contact the service');
        return;
      }
      assert.equal(result.error.code, cancelled.code);
      assert.equal(requests, 1);
      assert(uploaded);
      const frames = [];
      for (let offset = 0; offset < uploaded.length;) {
        assert(offset + 5 <= uploaded.length);
        const length = new DataView(uploaded.buffer, uploaded.byteOffset + offset + 1, 4).getUint32(0, false);
        assert(offset + 5 + length <= uploaded.length);
        frames.push({ type: uploaded[offset], payload: uploaded.subarray(offset + 5, offset + 5 + length) });
        offset += 5 + length;
      }
      assert.equal(frames[0].type, 1);
      assert.equal(frames.at(-1).type, 3);
      const wire = JSON.parse(new TextDecoder().decode(frames[0].payload));
      const payloadBytes = frames.filter((frame) => frame.type === 2)
        .reduce((sum, frame) => sum + frame.payload.length, 0);
      assert.equal(validateWire('requestMetadata', wire), true);
      assert.equal(wire.hasBody, fixture.value.hasBody);
      if (!wire.hasBody) {
        assert.equal(payloadBytes, 0);
        assert.equal(wire.bodyLength ?? 0, 0,
          'The public API derives body metadata and cannot encode the Rust-rejected contradictory length');
      } else {
        assert.equal(wire.bodyLength, payloadBytes,
          'Declared buffered length must equal payload bytes on the actual upload stream');
        assert.equal(payloadBytes, fixture.value.bodyLength);
      }
      assert.equal(fixture.semanticValid, fixture.sdkBoundary === 'encode');
    } finally {
      await client.close();
    }
  });
}
