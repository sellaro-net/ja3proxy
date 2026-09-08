import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test, { type TestContext } from 'node:test';
import { Ja3ProxyClient, Ja3ProxyTransportError } from '../src/index.js';
import { initialDiagnostics } from '../src/errors.js';
import { capabilities, FrameReader, frame, jsonBytes, parseJson, record } from '../src/protocol.js';
import type { Capabilities, ClientOptions, ConnectionSpec, RequestOptions } from '../src/types.js';

const raw: unknown = JSON.parse(await readFile(new URL('../../../contracts/fixtures/wire.json', import.meta.url), 'utf8'));
assert(record(raw) && Array.isArray(raw.fixtures));
const fixture: unknown = raw.fixtures.find((value: unknown) => record(value) && value.contract === 'capabilities' && value.valid === true);
assert(record(fixture) && capabilities(fixture.value));
const caps: Capabilities = { ...fixture.value, limits: { ...fixture.value.limits, maxConcurrent: 1, maxConcurrentPerPartition: 1, maxQueued: 8, maxQueuedPerPartition: 8 } };
const connection: ConnectionSpec = { egress: { mode: 'direct' }, identity: { tlsProfile: caps.profiles[0]!, emulateHeaders: false } };
const target: RequestOptions = { partition: 'lifetime', connection, method: 'GET', url: 'https://example.com/', timeoutMs: 1000, maxResponseBytes: 1024 };
const options = { baseUrl: 'http://service.invalid', token: 'explicit-test-service-token-0123456789', defaultTimeoutMs: 1000, controlTimeoutMs: 1000, maxResponseBytes: 1024 };
interface Incoming { requestId: string; attempt: number; timeoutMs: number; contextId?: string; body: Uint8Array }
async function envelope(init: RequestInit | undefined): Promise<Incoming> {
  assert(init?.body instanceof ReadableStream);
  const reader = new FrameReader(init.body, 65_536, 65_536);
  const first = await reader.next();
  assert(first?.type === 1);
  const metadata = parseJson(first.payload);
  assert(record(metadata) && typeof metadata.requestId === 'string' && typeof metadata.attempt === 'number' && typeof metadata.timeoutMs === 'number');
  const pieces: Uint8Array[] = [];
  while (true) {
    const next = await reader.next();
    if (next?.type === 3) break;
    assert(next?.type === 2);
    pieces.push(next.payload);
  }
  return { requestId: metadata.requestId, attempt: metadata.attempt, timeoutMs: metadata.timeoutMs, ...(typeof metadata.contextId === 'string' ? { contextId: metadata.contextId } : {}), body: Buffer.concat(pieces) };
}
function framed(incoming: Incoming): Response {
  const diagnostics = { ...initialDiagnostics(incoming.requestId, incoming.attempt, connection.identity.tlsProfile), phase: 'body' as const, delivery: 'response_started' as const, headersMs: 1, requestBytes: incoming.body.length, ...(incoming.contextId ? { contextId: incoming.contextId } : {}) };
  const data = new TextEncoder().encode('ok');
  return new Response(new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(frame(1, jsonBytes({ requestId: incoming.requestId, status: 200, headers: [], diagnostics })));
    controller.enqueue(frame(2, data));
    controller.enqueue(frame(3, jsonBytes({ ...diagnostics, phase: 'complete', bodyMs: 1, totalMs: 2, responseBytes: data.length })));
    controller.close();
  } }), { headers: { 'content-type': 'application/vnd.ja3proxy' } });
}
function rig(settings: { failDeletes?: number; beforeCapabilities?: Promise<void>; onContextResponse?: (response: Response) => Response } = {}) {
  let requests = 0;
  let capabilityRequests = 0;
  let deletes = 0;
  let creates = 0;
  const uploaded: Uint8Array[] = [];
  const transport: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/capabilities') {
      capabilityRequests++;
      await settings.beforeCapabilities;
      return Response.json(caps);
    }
    if (path === '/contexts') {
      assert(init?.body instanceof Uint8Array);
      const command = parseJson(init.body);
      assert(record(command) && record(command.connection));
      const response = Response.json({ contextId: `context-${++creates}`, partition: target.partition, cookieMode: 'external', identity: command.connection.identity, revision: 0, expiresAtMs: Date.now() + 30_000 });
      return settings.onContextResponse ? settings.onContextResponse(response) : response;
    }
    if (path.startsWith('/contexts/') && init?.method === 'DELETE') {
      if (++deletes <= (settings.failDeletes ?? 0)) throw new Error('simulated unavailable service');
      return new Response(null, { status: 204 });
    }
    assert.equal(path, '/request');
    requests++;
    const incoming = await envelope(init);
    uploaded.push(incoming.body);
    return framed(incoming);
  };
  return { transport, uploaded, get requests() { return requests; }, get deletes() { return deletes; }, get creates() { return creates; }, get capabilityRequests() { return capabilityRequests; } };
}
const sessionOptions = { partition: target.partition, connection, cookieMode: 'external' as const, timeoutMs: 1000, maxResponseBytes: 1024 };

test('cold capability negotiation applies service admission before either concurrent request dispatches', async () => {
  const remote = rig();
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport, limits: { maxConcurrent: 8, maxConcurrentPerPartition: 8 } });
  try {
    const firstPending = sdk.stream(target);
    const second = sdk.tryRequest(target);
    const first = await firstPending;
    await nextTurn();
    assert.equal(remote.requests, 1, 'the unread first body must retain the only negotiated slot');
    await first.close();
    assert.equal((await second).ok, true);
    assert.equal(remote.requests, 2);
  } finally { await sdk.close(); }
});

test('pending capability discovery is bounded and an aborted preparation frees capacity', async () => {
  const gate = Promise.withResolvers<void>();
  const remote = rig({ beforeCapabilities: gate.promise });
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport, limits: { maxConcurrent: 1, maxConcurrentPerPartition: 1, maxQueued: 1, maxQueuedPerPartition: 1 } });
  const abort = new AbortController();
  const first = sdk.tryRequest({ ...target, signal: abort.signal });
  const second = sdk.tryRequest(target);
  try {
    const overflow = await sdk.tryRequest(target);
    assert(!overflow.ok && overflow.error.code === 'BUSY');
    assert.equal(remote.requests, 0);
    assert.equal(remote.capabilityRequests, 1);
    abort.abort();
    const cancelled = await first;
    assert(!cancelled.ok && cancelled.error.code === 'CANCELLED');
    const replacement = sdk.tryRequest(target);
    gate.resolve();
    assert.equal((await second).ok, true);
    assert.equal((await replacement).ok, true);
  } finally { gate.resolve(); await sdk.close(); await Promise.all([first, second]); }
});

test('explicit session close can retry remote deletion without reopening the session', async () => {
  const remote = rig({ failDeletes: 1 });
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const session = await sdk.createSession(sessionOptions);
  await assert.rejects(session.close(), Ja3ProxyTransportError);
  assert.equal(remote.deletes, 1);
  await assert.rejects(session.request({ method: 'GET', url: target.url }), Ja3ProxyTransportError);
  await session.close();
  assert.equal(remote.deletes, 2);
  await sdk.close();
  assert.equal(remote.deletes, 2);
});

test('client close retains a failed fetch-owned context and does not retry DELETE through its fetcher in the same attempt', async () => {
  const remote = rig({ failDeletes: 1 });
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const fetcher = sdk.createFetch({ partition: target.partition, connection, context: 'session' });
  assert.equal(await (await fetcher(target.url)).text(), 'ok');
  await assert.rejects(sdk.close(), Ja3ProxyTransportError);
  assert.equal(remote.deletes, 1);
  await sdk.close();
  await fetcher.close();
  assert.equal(remote.deletes, 2);
});

test('fetch owner close retains its failed cleanup for an explicit retry', async () => {
  const remote = rig({ failDeletes: 1 });
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const fetcher = sdk.createFetch({ partition: target.partition, connection, context: 'session' });
  await (await fetcher(target.url)).text();
  await assert.rejects(fetcher.close(), Ja3ProxyTransportError);
  assert.equal(remote.deletes, 1);
  await fetcher.close();
  assert.equal(remote.deletes, 2);
  await sdk.close();
  assert.equal(remote.deletes, 2);
});

test('an expired session drain reports cleanup pending and a later explicit close deletes the retained context', async () => {
  const remote = rig();
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const session = await sdk.createSession(sessionOptions);
  const stream = await session.stream({ method: 'GET', url: target.url });
  await assert.rejects(session.close({ drain: true, timeoutMs: 5 }), (error: unknown) => error instanceof Ja3ProxyTransportError && error.code === 'TIMEOUT');
  assert.equal((await stream.completion).ok, false);
  assert.equal(remote.deletes, 0);
  await sdk.close();
  assert.equal(remote.deletes, 1);
});

test('a context whose validated response arrives during client close stays owned even when initial cleanup fails', async () => {
  const started = Promise.withResolvers<void>();
  let sdk: Ja3ProxyClient;
  let closing: Promise<void> | undefined;
  const remote = rig({ failDeletes: 1, onContextResponse(response) {
    assert(response.body);
    const body = response.body;
    const getReader = body.getReader.bind(body);
    Object.defineProperty(body, 'getReader', { value() {
      const reader = getReader();
      const cancel = reader.cancel.bind(reader);
      Object.defineProperty(reader, 'cancel', { value() {
        // Service JSON has already been decoded; interrupt before createSession's
        // promise continuation hands the known context back to its caller.
        closing ??= sdk.close();
        void closing.catch(() => undefined);
        started.resolve();
        return cancel();
      } });
      return reader;
    } });
    return response;
  } });
  sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const opening = sdk.createSession(sessionOptions).then(value => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
  await started.promise;
  await assert.rejects(closing!, Ja3ProxyTransportError);
  assert.equal((await opening).ok, false);
  assert.equal(remote.creates, 1);
  assert.equal(remote.deletes, 1);
  await sdk.close();
  assert.equal(remote.deletes, 2);
});

test('mutating observer chunks cannot change a Buffer upload or the caller-owned bytes', async () => {
  const remote = rig();
  const source = Buffer.from('body');
  const observer: ClientOptions['observer'] = () => ({ requestChunk(chunk) { chunk.fill(0); } });
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport, observer });
  try {
    await sdk.request({ ...target, method: 'POST', body: source });
    assert.equal(source.toString(), 'body');
    assert.equal(new TextDecoder().decode(remote.uploaded[0]), 'body');
  } finally { await sdk.close(); }
});

test('invalid close options leave both client and session usable', async () => {
  const remote = rig();
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const session = await sdk.createSession(sessionOptions);
  try {
    await assert.rejects(Reflect.apply(session.close, session, [{ drain: 'invalid' }]), Ja3ProxyTransportError);
    assert.equal((await session.request({ method: 'GET', url: target.url })).text(), 'ok');
    await assert.rejects(Reflect.apply(sdk.close, sdk, [{ drain: 'invalid' }]), Ja3ProxyTransportError);
    assert.equal((await sdk.request(target)).text(), 'ok');
    assert.equal(remote.deletes, 0);
  } finally { await sdk.close(); }
  assert.equal(remote.deletes, 1);
});

test('client drain synchronously rejects new session exchanges while preserving its accepted body', async () => {
  const remote = rig();
  const sdk = new Ja3ProxyClient({ ...options, transport: remote.transport });
  const session = await sdk.createSession(sessionOptions);
  const first = await session.stream({ method: 'GET', url: target.url });
  const closing = sdk.close({ drain: true, timeoutMs: 1000 });
  void closing.catch(() => undefined);
  let started = 0;
  const late = session.request({ method: 'GET', url: target.url, observer: () => { started++; } })
    .then(value => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
  try {
    assert.equal(started, 0, 'a closed session must not initiate another observed exchange');
    const result = await late;
    assert(!result.ok && result.error instanceof Ja3ProxyTransportError && result.error.kind === 'client_closed');
    assert.equal(await new Response(first.body).text(), 'ok');
    await closing;
    assert.equal(remote.requests, 1);
    assert.equal(remote.deletes, 1);
  } finally { await first.close(); await closing.catch(() => undefined); await sdk.close(); }
});

async function delayedSessionDeadline(context: TestContext, mode: 'managed' | 'lazy-external'): Promise<void> {
  let clock = 0;
  context.mock.method(performance, 'now', () => clock);
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const blocked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const dispatched = Promise.withResolvers<void>();
  let serverExpired = false;
  let requests = 0;
  const sdk = new Ja3ProxyClient({
    ...options, controlTimeoutMs: 5000,
    transport: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === '/capabilities') return Response.json(caps);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (path === '/contexts') {
        assert(init?.body instanceof Uint8Array);
        const command = parseJson(init.body);
        assert(record(command) && record(command.connection));
        if (mode === 'lazy-external') { blocked.resolve(); await release.promise; }
        return Response.json({ contextId: 'delayed-context', partition: target.partition, cookieMode: command.cookieMode, identity: command.connection.identity, revision: 0, expiresAtMs: Date.now() + 30_000 });
      }
      if (path.endsWith('/cookies')) {
        blocked.resolve();
        await release.promise;
        return Response.json({ revision: 1 });
      }
      assert.equal(path, '/request');
      requests++;
      const incoming = await envelope(init);
      const terminal = Promise.withResolvers<Response>();
      // Model the service's real deadline, not an echo of a submitted timeout
      // field. It must expire at the same absolute time as its caller.
      setTimeout(() => {
        serverExpired = true;
        const diagnostics = {
          ...initialDiagnostics(incoming.requestId, incoming.attempt, connection.identity.tlsProfile),
          phase: 'upstream', delivery: 'possibly_sent', totalMs: incoming.timeoutMs,
          contextId: incoming.contextId,
        };
        terminal.resolve(new Response(frame(4, jsonBytes({ code: 'TIMEOUT', message: 'timeout', diagnostics })), { headers: { 'content-type': 'application/vnd.ja3proxy' } }));
      }, incoming.timeoutMs);
      dispatched.resolve();
      return terminal.promise;
    },
  });
  let mutation: Promise<void> | undefined;
  try {
    let pending: Promise<Response>;
    if (mode === 'managed') {
      const session = await sdk.createSession({ ...sessionOptions, cookieMode: 'managed', allowedOrigins: ['https://example.com'] });
      mutation = session.setCookies('https://example.com/', ['a=b; Path=/']);
      await blocked.promise;
      pending = session.fetch(target.url);
      const expired = session.request({ method: 'GET', url: target.url, timeoutMs: 250 })
        .then(value => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
      clock = 250;
      context.mock.timers.tick(250);
      const queued = await expired;
      assert(!queued.ok && queued.error instanceof Ja3ProxyTransportError);
      assert.equal(queued.error.code, 'TIMEOUT');
      assert.equal(queued.error.diagnostics.totalMs, 250);
      assert.equal(requests, 0, 'expired cookie-serialization waiters must not dispatch');
    } else {
      const fetcher = sdk.createFetch({ partition: target.partition, connection, context: 'session', timeoutMs: 1000 });
      pending = fetcher(target.url);
      await blocked.promise;
    }
    const result = pending.then(value => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
    const advance = 400 - clock;
    clock = 400;
    context.mock.timers.tick(advance);
    release.resolve();
    await mutation;
    await dispatched.promise;
    clock = 1000;
    context.mock.timers.tick(600);
    const outcome = await result;
    assert(!outcome.ok && outcome.error instanceof Ja3ProxyTransportError);
    assert.equal(outcome.error.code, 'TIMEOUT');
    assert.equal(outcome.error.diagnostics.totalMs, 1000);
    assert.equal(serverExpired, true, 'service lifetime cannot extend 400ms beyond the original request deadline');
    assert.equal(requests, 1);
  } finally { release.resolve(); await mutation; await sdk.close(); }
}

test('managed session fetch preserves total deadline and elapsed time across cookie serialization', async context => {
  await delayedSessionDeadline(context, 'managed');
});

test('lazy external fetch preserves its original deadline through context creation and session dispatch', async context => {
  await delayedSessionDeadline(context, 'lazy-external');
});
