import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { MessageChannel } from 'node:worker_threads';
import { initialDiagnostics, Ja3ProxyTransportError } from '../src/errors.js';
import { diagnostics, responseMetadata, validateDiagnosticEnvelope } from '../src/protocol.js';
import { Service } from '../src/service.js';
import { decodeError, encodeError, plainResponse, request, response } from '../src/sync/ipc.js';

async function receivedBody(value: unknown): Promise<Uint8Array> {
  const { port1, port2 } = new MessageChannel();
  try {
    const received = once(port2, 'message');
    // Exercise Node's real structured clone, including its backing-buffer semantics.
    port1.postMessage(value);
    const packet: unknown = (await received)[0];
    assert.ok(packet !== null && typeof packet === 'object' && 'body' in packet);
    assert.ok(packet.body instanceof Uint8Array);
    return packet.body;
  } finally { port1.close(); port2.close(); }
}

const options = {
  partition: 'ipc-isolation', url: 'https://example.com', method: 'POST',
  connection: { egress: { mode: 'direct' as const }, identity: { tlsProfile: 'chrome_149', emulateHeaders: false } },
};

test('a bounded request view cannot expose adjacent backing bytes to the receiving worker', async () => {
  const backing = new Uint8Array(16 * 1024 * 1024).fill(99);
  const view = Buffer.from(backing.buffer, 4096, 1);
  view[0] = 42;
  const body = await receivedBody(request({ ...options, body: view }, 1));
  // Accessing .buffer at the recipient must reveal only the one authorized body byte,
  // not the adjacent data or the large allocation surrounding the caller's view.
  assert.deepEqual([...new Uint8Array(body.buffer)], [42]);
  assert.equal(backing.byteLength, 16 * 1024 * 1024);
  assert.equal(backing[4095], 99);
  assert.equal(view[0], 42);
});

test('shared request bodies become owned snapshots rather than sharing mutable memory across IPC', async () => {
  const backing = new SharedArrayBuffer(32);
  const view = new Uint8Array(backing, 8, 1);
  view[0] = 45;
  const body = await receivedBody(request({ ...options, body: view }, 1));
  view[0] = 7;
  assert.ok(body.buffer instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(body.buffer)], [45]);
  assert.equal(view[0], 7);
});

test('response IPC never exposes bytes outside a worker-owned body view', async () => {
  const backing = Buffer.alloc(4096, 99);
  const view = backing.subarray(100, 102);
  view.set([17, 18]);
  const body = await receivedBody(plainResponse({
    status: 200, headers: {}, body: view, elapsed: 0, diagnostics: initialDiagnostics(),
  }));
  assert.deepEqual([...new Uint8Array(body.buffer)], [17, 18]);
  assert.equal(backing[99], 99);
  assert.deepEqual([...view], [17, 18]);
});

test('SDK accepts both old service diagnostic shapes and requires valid paired IDs when present', () => {
  const local = initialDiagnostics('request-1');
  assert.equal(local.traceId, undefined);
  assert.equal(local.spanId, undefined);
  const valid = { ...local, traceId: 'a'.repeat(32), spanId: 'b'.repeat(16) };
  assert.equal(diagnostics(valid, 'request-1', 0), true);
  const traceOnly = { ...local, traceId: 'a'.repeat(32) };
  assert.equal(diagnostics(traceOnly), true);
  for (const invalid of [
    { ...valid, traceId: undefined }, { ...valid, spanId: undefined }, { ...local, spanId: 'b'.repeat(16) },
    { ...valid, traceId: '0'.repeat(32) }, { ...traceOnly, traceId: '0'.repeat(32) }, { ...valid, spanId: '0'.repeat(16) },
    { ...valid, traceId: 'A'.repeat(32) }, { ...valid, spanId: 'B'.repeat(16) },
    { ...valid, traceId: 'a'.repeat(31) }, { ...valid, spanId: 'b'.repeat(15) },
  ]) assert.equal(diagnostics(invalid), false);
  assert.equal(diagnostics(local), true);
  assert.equal(responseMetadata({ requestId: 'request-1', status: 200, headers: [], diagnostics: { ...traceOnly, phase: 'body', delivery: 'response_started' } }, 'request-1', 0), true);
  assert.equal(validateDiagnosticEnvelope('requestStatus', {
    state: 'failed', diagnostics: traceOnly,
    error: { code: 'CANCELLED', message: 'cancelled', diagnostics: local },
  }), true);
});

test('transport errors preserve both IDs across the sync IPC boundary without retaining wire extras', () => {
  const wire = { ...initialDiagnostics('request-1'), traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), secret: 'discard' };
  const error = new Ja3ProxyTransportError('TIMEOUT', wire);
  const restored = decodeError(structuredClone(encodeError(error)));
  assert.equal(restored.code, 'TIMEOUT');
  assert.equal(restored.diagnostics.traceId, wire.traceId);
  assert.equal(restored.diagnostics.spanId, wire.spanId);
  assert.equal('secret' in restored.diagnostics, false);
  const local = decodeError(structuredClone(encodeError(new Ja3ProxyTransportError('CONNECT_ERROR', initialDiagnostics()))));
  assert.equal(local.diagnostics.traceId, undefined);
  assert.equal(local.diagnostics.spanId, undefined);
});

test('legacy trace-only transport errors retain correlation without accepting a span-only error', () => {
  const service = new Service({ baseUrl: 'http://localhost', token: 'x'.repeat(32) });
  const fallback = initialDiagnostics('legacy');
  const legacy = { ...fallback, traceId: 'a'.repeat(32) };
  const error = service.transportError({ code: 'TIMEOUT', message: 'safe', diagnostics: legacy }, fallback, false, true);
  assert.equal(error.code, 'TIMEOUT');
  assert.equal(error.diagnostics.traceId, legacy.traceId);
  assert.equal(error.diagnostics.spanId, undefined);
  const invalid = service.transportError({ code: 'TIMEOUT', message: 'safe', diagnostics: { ...fallback, spanId: 'b'.repeat(16) } }, fallback, false, true);
  assert.equal(invalid.code, 'PROTOCOL_ERROR');
});

test('sync response decoding accepts paired and both legacy ID shapes but rejects incomplete fields', () => {
  const diagnostics = { ...initialDiagnostics(), traceId: 'a'.repeat(32), spanId: 'b'.repeat(16) };
  const packet = { status: 200, headers: {}, body: new Uint8Array(), elapsed: 0, diagnostics };
  assert.equal(response(structuredClone(packet)).diagnostics.spanId, diagnostics.spanId);
  const legacy = { ...initialDiagnostics() };
  assert.equal(response({ ...packet, diagnostics: legacy }).diagnostics.traceId, undefined);
  assert.equal(response({ ...packet, diagnostics: { ...legacy, traceId: 'a'.repeat(32) } }).diagnostics.spanId, undefined);
  assert.throws(() => response({ ...packet, diagnostics: { ...diagnostics, spanId: undefined } }),
    (error: unknown) => error instanceof Ja3ProxyTransportError && error.code === 'PROTOCOL_ERROR');
});
