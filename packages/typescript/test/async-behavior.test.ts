import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import test from 'node:test';
import { Ja3ProxyClient, Ja3ProxyTransportError, getResponseCompletion } from '../src/index.js';
import { capabilities, FrameReader, frame, jsonBytes, parseJson, record } from '../src/protocol.js';
import { initialDiagnostics } from '../src/errors.js';
import type { Capabilities, ConnectionSpec, Ja3Diagnostics, RequestOptions } from '../src/types.js';

const data: unknown = JSON.parse(await readFile(new URL('../../../contracts/fixtures/wire.json', import.meta.url), 'utf8'));
assert(record(data) && Array.isArray(data.fixtures));
const fixture: unknown = data.fixtures.find((value: unknown) => record(value) && value.contract === 'capabilities' && value.valid === true);
assert(record(fixture) && capabilities(fixture.value));
const caps: Capabilities = fixture.value;
const connection: ConnectionSpec = { egress: { mode: 'direct' }, identity: { tlsProfile: caps.profiles[0]!, emulateHeaders: false } };
const token = 'private-service-credential-0123456789';
const target: RequestOptions = { partition: 'test-partition', connection, method: 'GET', url: 'https://example.com/', maxResponseBytes: 1024, timeoutMs: 1000 };

interface Envelope { requestId: string; attempt: number; contextId?: string; method: string }
async function readEnvelope(init: RequestInit | undefined): Promise<Envelope> {
  assert(init?.body instanceof ReadableStream);
  const reader = new FrameReader(init.body, 65_536, 65_536);
  const first = await reader.next();
  assert.equal(first?.type, 1);
  const value = parseJson(first!.payload);
  assert(record(value) && typeof value.requestId === 'string' && typeof value.attempt === 'number' && typeof value.method === 'string');
  while (true) { const next = await reader.next(); if (next?.type === 3) break; assert.equal(next?.type, 2); }
  return { requestId: value.requestId, attempt: value.attempt, method: value.method, ...(typeof value.contextId === 'string' ? { contextId: value.contextId } : {}) };
}
function metadata(envelope: Envelope, revision?: number, status = 200): { bytes: Uint8Array; diagnostics: Ja3Diagnostics } {
  const diagnostics: Ja3Diagnostics = { ...initialDiagnostics(envelope.requestId, envelope.attempt, connection.identity.tlsProfile), phase: 'body', delivery: 'response_started', headersMs: 1, totalMs: 1, ...(envelope.contextId ? { contextId: envelope.contextId } : {}), ...(revision === undefined ? {} : { cookieRevision: revision }) };
  return { bytes: frame(1, jsonBytes({ requestId: envelope.requestId, status, headers: [['content-type', 'text/plain']], diagnostics, ...(revision === undefined ? {} : { cookieRevision: revision }) })), diagnostics };
}
function response(envelope: Envelope, tail: (diag: Ja3Diagnostics) => Promise<Uint8Array[]> | Uint8Array[], revision?: number, status = 200): Response {
  const first = metadata(envelope, revision, status);
  let sent = false;
  return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sent) { sent = true; controller.enqueue(first.bytes); return; }
      for (const bytes of await tail(first.diagnostics)) controller.enqueue(bytes);
      controller.close();
    },
  }, { highWaterMark: 0 }), { headers: { 'content-type': 'application/vnd.ja3proxy' } });
}
function success(diag: Ja3Diagnostics, body = 'ok'): Uint8Array[] {
  const bytes = new TextEncoder().encode(body);
  return [frame(2, bytes), frame(3, jsonBytes({ ...diag, phase: 'complete', responseBytes: bytes.length, totalMs: 2, bodyMs: 1 }))];
}
function client(transport: typeof fetch, limits?: { maxConcurrent: number; maxConcurrentPerPartition: number; maxQueued: number; maxQueuedPerPartition: number }): Ja3ProxyClient {
  return new Ja3ProxyClient({ baseUrl: 'http://service.invalid/', token, transport, maxResponseBytes: 1024, defaultTimeoutMs: 1000, controlTimeoutMs: 1000, ...(limits ? { limits } : {}) });
}

test('terminal failure is authoritative even after body bytes and resolves completion as Result', async () => {
  const transport: typeof fetch = async (input, init) => {
    if (new URL(String(input)).pathname === '/capabilities') return Response.json(caps);
    const envelope = await readEnvelope(init);
    return response(envelope, diag => [frame(2, new TextEncoder().encode('ok')), frame(4, jsonBytes({ code: 'BODY_TOO_LARGE', message: 'raw-secret-must-not-survive', diagnostics: { ...diag, responseBytes: 3, unexpectedSecret: 'wire-secret' } }))]);
  };
  const sdk = client(transport);
  try {
    const exchange = await sdk.stream(target);
    const reader = exchange.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'ok');
    await assert.rejects(reader.read(), (error: unknown) => error instanceof Ja3ProxyTransportError && error.code === 'BODY_TOO_LARGE');
    const result = await exchange.completion;
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.diagnostics.responseBytes, 3);
      assert(!JSON.stringify(result.error).includes('wire-secret'));
      assert(!String(result.error).includes('raw-secret'));
    }
  } finally { await sdk.close(); }
});

test('queued abort releases admission and stream cancellation admits exactly one successor', async () => {
  let dispatched = 0;
  const transport: typeof fetch = async (input, init) => {
    if (new URL(String(input)).pathname === '/capabilities') return Response.json(caps);
    const envelope = await readEnvelope(init);
    dispatched++;
    return response(envelope, diag => success(diag));
  };
  const sdk = client(transport, { maxConcurrent: 1, maxConcurrentPerPartition: 1, maxQueued: 1, maxQueuedPerPartition: 1 });
  try {
    const first = await sdk.stream(target);
    const abort = new AbortController();
    const queued = sdk.tryRequest({ ...target, signal: abort.signal });
    const overflow = await sdk.tryRequest(target);
    assert(!overflow.ok && overflow.error.code === 'BUSY');
    abort.abort();
    const cancelled = await queued;
    assert(!cancelled.ok && cancelled.error.code === 'CANCELLED');
    const successor = sdk.request(target);
    await first.close();
    assert.equal((await successor).text(), 'ok');
    assert.equal(dispatched, 2);
    const completion = await first.completion;
    assert(!completion.ok && completion.error.code === 'CANCELLED');
  } finally { await sdk.close(); }
});

test('close cancels unread streams and queued requests without replay or exposing service credentials', async () => {
  const transport: typeof fetch = async (input, init) => new URL(String(input)).pathname === '/capabilities' ? Response.json(caps) : response(await readEnvelope(init), diag => success(diag));
  const sdk = client(transport, { maxConcurrent: 1, maxConcurrentPerPartition: 1, maxQueued: 1, maxQueuedPerPartition: 1 });
  const first = await sdk.stream(target);
  const queued = sdk.tryRequest(target);
  assert(!JSON.stringify(sdk).includes(token));
  assert(!inspect(sdk, { depth: 8 }).includes(token));
  await sdk.close();
  const result = await first.completion;
  assert(!result.ok && result.error.kind === 'client_closed');
  const pending = await queued;
  assert(!pending.ok && pending.error.code === 'CANCELLED');
  const late = await sdk.tryRequest(target);
  assert(!late.ok && late.error.kind === 'client_closed');
});

test('fetch clones share terminal completion and bodyless fetch rejects terminal errors', async () => {
  const transport: typeof fetch = async (input, init) => {
    if (new URL(String(input)).pathname === '/capabilities') return Response.json(caps);
    const envelope = await readEnvelope(init);
    if (envelope.method === 'HEAD') return response(envelope, diag => [frame(4, jsonBytes({ code: 'TIMEOUT', message: 'timeout', diagnostics: diag }))], undefined, 204);
    return response(envelope, diag => success(diag));
  };
  const sdk = client(transport);
  try {
    const fetcher = sdk.createFetch({ partition: target.partition, connection });
    const original = await fetcher(target.url);
    const copy = original.clone();
    assert.strictEqual(getResponseCompletion(copy), getResponseCompletion(original));
    assert.deepEqual(await Promise.all([original.text(), copy.text()]), ['ok', 'ok']);
    assert.equal((await getResponseCompletion(copy))?.ok, true);
    await assert.rejects(fetcher(target.url, { method: 'HEAD' }), (error: unknown) => error instanceof Ja3ProxyTransportError && error.code === 'TIMEOUT');
  } finally { await sdk.close(); }
});

test('observer failures cannot retry or replace the actual transport operation', async () => {
  let sends = 0;
  let finishes = 0;
  const sdk = new Ja3ProxyClient({ baseUrl: 'http://service.invalid/', token, maxResponseBytes: 1024, transport: async (input, init) => {
    if (new URL(String(input)).pathname === '/capabilities') return Response.json(caps);
    sends++;
    return response(await readEnvelope(init), diag => success(diag));
  }, observer: () => ({
    run(operation) { const result = operation(); void operation(); void result.catch(() => undefined); throw new Error('observer-only'); },
    responseChunk() { throw new Error('observer-only'); },
    finish() { finishes++; throw new Error('observer-only'); },
  }) });
  try { assert.equal((await sdk.request(target)).text(), 'ok'); assert.equal(sends, 1); assert.equal(finishes, 1); }
  finally { await sdk.close(); }
});

test('rebind cancellation after commit reports cleanup pending and late old bodies cannot change the new revision', async () => {
  let created = 0;
  let oldDelete = true;
  const revisions = new Map<string, number>();
  const abort = new AbortController();
  const oldBody = Promise.withResolvers<void>();
  const transport: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/capabilities') return Response.json(caps);
    if (path === '/request') {
      const envelope = await readEnvelope(init);
      revisions.set(envelope.contextId!, 5);
      return response(envelope, async diag => { await oldBody.promise; return success(diag); }, 5);
    }
    if (path === '/contexts' && init?.method === 'POST') {
      const request: unknown = JSON.parse(new TextDecoder().decode(init.body as Uint8Array));
      assert(record(request) && record(request.connection));
      const contextId = `context-${++created}`;
      revisions.set(contextId, 0);
      return Response.json({ contextId, partition: target.partition, expiresAtMs: Date.now() + 10_000, revision: 0, cookieMode: 'managed', identity: request.connection.identity });
    }
    const id = path.split('/')[2]!;
    if (init?.method === 'DELETE') {
      if (id === 'context-1' && oldDelete) {
        oldDelete = false;
        abort.abort();
        throw new DOMException('cancelled', 'AbortError');
      }
      revisions.delete(id);
      return new Response(null, { status: 204 });
    }
    const request: unknown = JSON.parse(new TextDecoder().decode(init?.body as Uint8Array));
    assert(record(request));
    const revision = revisions.get(id)!;
    if (request.operation === 'export') return Response.json({ revision, snapshot: { partitionKey: 'https://example.com', cookies: [] } });
    assert.equal(request.expectedRevision, revision);
    revisions.set(id, revision + 1);
    return Response.json({ revision: revision + 1 });
  };
  const sdk = client(transport);
  try {
    const session = await sdk.createSession({ partition: target.partition, connection, cookieMode: 'managed', allowedOrigins: ['https://example.com'], timeoutMs: 1000, maxResponseBytes: 1024 });
    const old = await session.stream({ method: 'GET', url: target.url });
    assert.equal(session.info.revision, 5);
    const result = await session.rebindIdentity(connection.identity, abort.signal);
    assert.equal(result.state, 'committed_cleanup_pending');
    assert.equal(result.contextId, 'context-2');
    assert.equal(session.info.revision, 1);
    oldBody.resolve();
    assert.equal(await new Response(old.body).text(), 'ok');
    assert.equal((await old.completion).ok, true);
    assert.equal(session.info.revision, 1);
    await session.setCookies('https://example.com/', ['a=b; Path=/']);
    assert.equal(session.info.revision, 2);
  } finally { oldBody.resolve(); await sdk.close(); }
});

test('an EOF without a terminal success frame is never a successful buffered response', async () => {
  const sdk = client(async (input, init) => new URL(String(input)).pathname === '/capabilities' ? Response.json(caps) : response(await readEnvelope(init), () => []));
  try {
    const result = await sdk.tryRequest(target);
    assert(!result.ok && result.error.code === 'PROTOCOL_ERROR');
  } finally { await sdk.close(); }
});

test('drain preserves an accepted body while expiry cancels an unread body', async () => {
  const tail = Promise.withResolvers<void>();
  const transport: typeof fetch = async (input, init) => new URL(String(input)).pathname === '/capabilities' ? Response.json(caps) : response(await readEnvelope(init), async diag => { await tail.promise; return success(diag); });
  const sdk = client(transport);
  const exchange = await sdk.stream(target);
  const body = new Response(exchange.body).text();
  const closing = sdk.close({ drain: true, timeoutMs: 1000 });
  tail.resolve();
  assert.equal(await body, 'ok');
  await closing;
  assert.equal((await exchange.completion).ok, true);
  const second = client(transport);
  const unread = await second.stream(target);
  await second.close({ drain: true, timeoutMs: 10 });
  const result = await unread.completion;
  assert(!result.ok && result.error.kind === 'client_closed');
});

test('aggregate buffer exhaustion is the observed failure and releases its reservation', async () => {
  let sends = 0;
  let observed: string | undefined;
  const sdk = new Ja3ProxyClient({
    baseUrl: 'http://service.invalid/', token, maxResponseBytes: 1024, limits: { maxBufferedBytes: 3 },
    transport: async (input, init) => {
      if (new URL(String(input)).pathname === '/capabilities') return Response.json(caps);
      return response(await readEnvelope(init), diag => success(diag, ++sends === 1 ? 'ab' : 'a'));
    },
    observer: () => ({ finish(outcome) { observed = outcome.error?.kind; } }),
  });
  try {
    const result = await sdk.tryRequest(target);
    assert(!result.ok && result.error.kind === 'buffer_limit');
    assert.equal(observed, 'buffer_limit');
    assert.equal((await sdk.request(target)).text(), 'a');
  } finally { await sdk.close(); }
});

test('pre-dispatch service failures may omit a TLS profile but response headers must identify it', async () => {
  let started = false;
  const sdk = client(async (input, init) => {
    if (new URL(String(input)).pathname === '/capabilities') return Response.json(caps);
    const envelope = await readEnvelope(init);
    if (!started) {
      return Response.json({
        code: 'BUSY', message: 'private service detail',
        diagnostics: initialDiagnostics(envelope.requestId, envelope.attempt, ''),
      }, { status: 503 });
    }
    const first = metadata(envelope);
    return new Response(frame(1, jsonBytes({
      requestId: envelope.requestId, status: 200, headers: [],
      diagnostics: { ...first.diagnostics, tlsProfile: '' },
    })), { headers: { 'content-type': 'application/vnd.ja3proxy' } });
  });
  try {
    const rejected = await sdk.tryRequest(target);
    assert(!rejected.ok);
    assert.equal(rejected.error.code, 'BUSY');
    assert.equal(rejected.error.delivery, 'not_started');
    assert(!String(rejected.error).includes('private service detail'));
    started = true;
    await assert.rejects(sdk.stream(target), (error: unknown) => error instanceof Ja3ProxyTransportError && error.code === 'PROTOCOL_ERROR');
  } finally { await sdk.close(); }
});
