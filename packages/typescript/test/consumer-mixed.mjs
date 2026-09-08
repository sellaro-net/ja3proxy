import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as imported from '@sellaro/ja3proxy';
import { Ja3ProxySyncClient as ImportedSyncClient } from '@sellaro/ja3proxy/sync';

const require = createRequire(import.meta.url);
const required = require('@sellaro/ja3proxy');
const { Ja3ProxySyncClient: RequiredSyncClient } = require('@sellaro/ja3proxy/sync');
const wire = JSON.parse(await readFile(new URL('./wire-fixtures.json', import.meta.url), 'utf8'));
const caps = wire.fixtures.find(fixture => fixture.contract === 'capabilities' && fixture.valid === true)?.value;
assert.ok(caps, 'The Rust-generated capabilities fixture must exist.');
const connection = { egress: { mode: 'direct' }, identity: { tlsProfile: caps.profiles[0], emulateHeaders: false } };
const token = 'mixed-module-explicit-credential-32-bytes';
const bytes = new Uint8Array([0, 128, 255, 13, 10]);

function frame(type, payload) {
  const data = payload instanceof Uint8Array ? payload : new TextEncoder().encode(JSON.stringify(payload));
  const output = Buffer.alloc(5 + data.byteLength);
  output[0] = type;
  output.writeUInt32BE(data.byteLength, 1);
  output.set(data, 5);
  return output;
}

function transport(fail) {
  return async (url, init) => {
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    const pathname = new URL(url).pathname;
    if (pathname === '/capabilities') return Response.json(caps);
    assert.equal(pathname, '/request');
    // Exercise the actual SDK envelope, terminal parser and fetch adapter, not
    // monkeypatched completion state or an imported internal implementation.
    const envelope = Buffer.from(await new Response(init.body).arrayBuffer());
    assert.equal(envelope[0], 1);
    const request = JSON.parse(envelope.subarray(5, 5 + envelope.readUInt32BE(1)).toString());
    const diagnostics = {
      requestId: request.requestId, attempt: request.attempt,
      phase: 'body', delivery: 'response_started', queueMs: 0,
      headersMs: 1, bodyMs: null, totalMs: 1, requestBytes: 0,
      responseBytes: 0, tlsProfile: connection.identity.tlsProfile,
    };
    const terminal = { ...diagnostics, responseBytes: bytes.length, bodyMs: 1, totalMs: 2 };
    return new Response(Buffer.concat([
      frame(1, { requestId: request.requestId, status: 200, headers: [['content-type', 'application/octet-stream']], diagnostics }),
      frame(2, bytes),
      fail ? frame(4, { code: 'BODY_TOO_LARGE', message: 'Transport failure', diagnostics: terminal }) : frame(3, { ...terminal, phase: 'complete' }),
    ]), { headers: { 'content-type': 'application/vnd.ja3proxy' } });
  };
}

for (const [producer, consumer] of [[required, imported], [imported, required]]) {
  for (const fail of [false, true]) {
    const client = new producer.Ja3ProxyClient({ baseUrl: 'http://service.invalid', token, transport: transport(fail), defaultTimeoutMs: 1000, maxResponseBytes: 1024 });
    const fetcher = client.createFetch({ partition: 'mixed-modules', connection });
    try {
      const response = await fetcher('https://upstream.invalid/bytes');
      const completion = consumer.getResponseCompletion(response);
      assert.ok(completion, 'Opposite module format must recognize the actual SDK response.');
      assert.equal(completion, producer.getResponseCompletion(response));
      if (fail) {
        await assert.rejects(response.arrayBuffer(), error => error instanceof imported.Ja3ProxyTransportError && error instanceof required.Ja3ProxyTransportError && error.code === 'BODY_TOO_LARGE');
        const result = await completion;
        assert.equal(result.ok, false);
        assert.ok(result.error instanceof imported.Ja3ProxyTransportError);
        assert.ok(result.error instanceof required.Ja3ProxyTransportError);
      } else {
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
        assert.equal((await completion).ok, true);
      }
    } finally {
      await fetcher.close();
      await client.close();
    }
  }
}

for (const SyncClient of [ImportedSyncClient, RequiredSyncClient]) {
  const client = new SyncClient({ baseUrl: 'http://127.0.0.1:9', token });
  try {
    assert.throws(() => client.capabilities(), error => error instanceof imported.Ja3ProxyTransportError && error instanceof required.Ja3ProxyTransportError && error.kind === 'service_unavailable');
  } finally { client.close(); }
}
console.log('Mixed installed import/require consumers share response completion, transport errors and both sync workers.');
