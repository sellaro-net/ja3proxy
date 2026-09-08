import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { MessageChannel } from 'node:worker_threads';
import { initialDiagnostics } from '../src/errors.js';
import { plainResponse, request } from '../src/sync/ipc.js';

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
