import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { inspect } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Ja3ProxyTransportError, isJa3ProxyError } from '@sellaro/ja3proxy';
import { Ja3ProxySyncClient } from '@sellaro/ja3proxy/sync';
import type { SyncRequestOptions } from '@sellaro/ja3proxy/sync';

// Deliberately separate from the test thread: a same-thread HTTP fixture would deadlock
// any genuine synchronous implementation. This fixture exercises the real async core.
const fixtureSource = String.raw`
const { parentPort } = require('node:worker_threads');
const { createServer } = require('node:http');
const contexts = new Map();
const deleteAttempts = new Map();
let sequence = 0;
let active = 0;
let maximum = 0;
let waiting = [];
const token = 'sync-fixture-token-0123456789-0123456789';
const caps = {
  service: 'ja3proxy', build: 'sync-fixture', profiles: ['chrome_149'],
  headerDescriptors: [{tlsProfile: 'chrome_149', headers: [['user-agent', 'fixture']]}],
  framing: {contentType: 'application/vnd.ja3proxy', maxMetadataBytes: 65536, maxDataBytes: 65536, maxUploadFrames: 65536},
  limits: {maxRequestBytes: 16777216, maxResponseBytes: 16777216, maxTimeoutMs: 60000,
    maxControlBytes: 1048576, maxHeaders: 256, maxHeaderBytes: 32768,
    maxConcurrent: 64, maxConcurrentPerPartition: 64, maxQueued: 256, maxQueuedPerPartition: 256,
    maxEnvelopes: 256, envelopeTimeoutMs: 60000, maxContexts: 4096, maxContextsPerPartition: 256,
    contextIdleTtlMs: 60000, contextMaxIdleTtlMs: 3600000, contextMaxAgeMs: 86400000,
    maxCookies: 4096, maxCookieBytes: 1048576, maxCookieSize: 4096, maxAllowedOrigins: 128,
    registryCapacity: 4096, registryTtlMs: 60000},
  modes: {egress: ['direct', 'http', 'https', 'socks5'], cookies: ['external', 'managed'], stream: ['upload', 'download'], cancel: ['request', 'stream-drop']}
};
function frame(type, value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  const prefix = Buffer.alloc(5); prefix[0] = type; prefix.writeUInt32BE(body.length, 1);
  return Buffer.concat([prefix, body]);
}
function json(response, value, status = 200) { response.writeHead(status, {'content-type':'application/json'}); response.end(JSON.stringify(value)); }
function diagnostics(meta, size, phase = 'complete') {
  return {requestId: meta.requestId, attempt: meta.attempt, phase, delivery: 'response_started',
    queueMs: 0, headersMs: 1, bodyMs: 1, totalMs: 2, requestBytes: meta.bodyLength || 0,
    responseBytes: size, tlsProfile: 'chrome_149', ...(meta.contextId ? {contextId: meta.contextId} : {})};
}
const server = createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + token) return json(res, {code:'UNAUTHORIZED', message:'secret-never-forwarded'}, 401);
  if (req.url === '/capabilities') return json(res, caps);
  if (req.url === '/metrics') return json(res, {active, maximum, contextIds: [...contexts.keys()], deleteAttempts: Object.fromEntries(deleteAttempts)});
  const chunks = []; for await (const chunk of req) chunks.push(chunk); const body = Buffer.concat(chunks);
  if (req.url === '/contexts' && req.method === 'POST') {
    const input = JSON.parse(body.toString()); const contextId = 'fixture-' + (++sequence);
    const info = {contextId, partition: input.partition, expiresAtMs: Date.now()+60000, revision: 0, cookieMode: input.cookieMode, identity: input.connection.identity};
    contexts.set(contextId, {info, cookies: [], deleteFailures: input.partition.startsWith('cleanup-retry-') ? 1 : 0}); return json(res, info);
  }
  const contextPath = /^\/contexts\/([^/]+)(\/cookies)?$/.exec(req.url);
  if (contextPath) {
    const context = contexts.get(contextPath[1]);
    if (!context) return json(res, {code:'CONTEXT_NOT_FOUND',message:'gone'}, 404);
    if (req.method === 'DELETE') {
      deleteAttempts.set(contextPath[1], (deleteAttempts.get(contextPath[1]) || 0) + 1);
      if (context.deleteFailures > 0) {
        context.deleteFailures--;
        return json(res, {code:'UNKNOWN', message:'transient cleanup failure'}, 503);
      }
      contexts.delete(contextPath[1]); res.writeHead(204); res.end(); return;
    }
    const input = JSON.parse(body.toString());
    if (input.operation === 'set') {
      context.cookies = input.cookies.map(value => { const [name,...rest] = value.split('='); return {name, value: rest.join('=').split(';')[0], domain: 'example.com', path:'/', secure:true, httpOnly:false, hostOnly:true, partitioned:false}; });
      context.info.revision++;
    }
    if (input.operation === 'import') { context.cookies = input.snapshot.cookies; context.info.revision++; }
    return json(res, {revision: context.info.revision,
      ...(input.operation === 'select' ? {cookies: context.cookies} : {}),
      ...(input.operation === 'export' ? {snapshot: {partitionKey: context.info.partition, cookies: context.cookies}} : {})});
  }
  if (req.url !== '/request') return json(res, {}, 404);
  const length = body.readUInt32BE(1); const meta = JSON.parse(body.subarray(5,5+length).toString());
  const target = new URL(meta.url);
  if (target.pathname === '/hang') return;
  const payload = target.pathname === '/bytes' ? Buffer.alloc(Number(target.searchParams.get('size')), 120) : Buffer.from(JSON.stringify({url:meta.url, headers:meta.headers, body:body.subarray(10+length, body.length-5).toString()}));
  active++; maximum = Math.max(maximum, active);
  const finish = () => {
    active--;
    res.writeHead(200, {'content-type':'application/vnd.ja3proxy'});
    res.write(frame(1, {requestId:meta.requestId, status:200, headers:[['content-type','application/json'],['set-cookie','a=1'],['set-cookie','b=2']], diagnostics:diagnostics(meta, 0, 'upstream')}));
    const chunkSize = Number(target.searchParams.get('chunk')) || 65536;
    for (let offset = 0; offset < payload.length; offset += chunkSize) res.write(frame(2, payload.subarray(offset, offset + chunkSize)));
    if (target.pathname === '/terminal-failure') res.end(frame(4, {code:'PROXY_ERROR', message:'proxy://user:password@secret', diagnostics:diagnostics(meta,payload.length,'body')}));
    else if (target.pathname === '/missing-terminal') res.end();
    else res.end(frame(3, diagnostics(meta,payload.length)));
  };
  // An explicit two-request barrier proves concurrency without guessed sleeps.
  if (target.pathname === '/delayed' && target.searchParams.get('a') !== '2') {
    waiting.push(finish);
    if (waiting.length === 2) { const ready = waiting; waiting = []; ready.forEach(done => done()); }
  } else finish();
});
server.listen(0, '127.0.0.1', () => parentPort.postMessage({baseUrl:'http://127.0.0.1:' + server.address().port}));
`;
let fixture: Worker;
let baseUrl: string;
const token = 'sync-fixture-token-0123456789-0123456789';
const connection = { egress: { mode: 'direct' as const }, identity: { tlsProfile: 'chrome_149', emulateHeaders: false } };
const requestOptions = (path = '/echo'): SyncRequestOptions => ({ partition: 'sync-test', connection, url: `https://example.com${path}`, method: 'GET' });

before(async () => {
  fixture = new Worker(fixtureSource, { eval: true, execArgv: [] });
  const [message] = await once(fixture, 'message');
  assert.equal(typeof message.baseUrl, 'string');
  baseUrl = message.baseUrl;
});
after(async () => { await fixture.terminate(); });

test('buffered sync calls retain caller buffers, URL/header semantics and real response methods', () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token });
  const bytes = new TextEncoder().encode('caller-owned');
  const response = client.request({ ...requestOptions(), method: 'POST', url: new URL('https://example.com/echo'), headers: new Headers({ 'x-sync': 'kept' }), body: bytes });
  assert.equal(response instanceof Promise, false);
  assert.equal(new TextDecoder().decode(bytes), 'caller-owned');
  assert.deepEqual(response.headers['set-cookie'], ['a=1', 'b=2']);
  assert.deepEqual(response.json(), { url: 'https://example.com/echo', headers: [['x-sync', 'kept']], body: 'caller-owned' });
  assert.equal(response.parseJson(value => { assert.equal(typeof value, 'object'); return 'decoded'; }), 'decoded');
  assert.equal(response.diagnostics.phase, 'complete');
  assert.equal(client.capabilities().service, 'ja3proxy');
});

test('terminal failure restores root SDK error identity without forwarding sensitive server text', () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token });
  const result = client.tryRequest(requestOptions('/terminal-failure'));
  assert.equal(result.ok, false);
  if (result.ok) assert.fail('terminal failure must not become a response');
  assert.ok(result.error instanceof Ja3ProxyTransportError);
  assert.ok(isJa3ProxyError(result.error));
  assert.equal(result.error.code, 'PROXY_ERROR');
  assert.equal(result.error.delivery, 'response_started');
  assert.doesNotMatch(inspect(result.error), /password|secret|proxy:\/\//);
  const truncated = client.tryRequest(requestOptions('/missing-terminal'));
  assert.equal(truncated.ok, false);
  if (!truncated.ok) assert.equal(truncated.error.code, 'PROTOCOL_ERROR');
});

test('batch lanes run concurrently, preserve order and bound aggregate response bytes', async () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token, maxBatchConcurrency: 2 });
  const result = client.requestMany([requestOptions('/delayed?a=0'), requestOptions('/delayed?a=1'), requestOptions('/delayed?a=2')], { concurrency: 2 });
  assert.deepEqual(result.map(entry => entry.ok ? JSON.parse(entry.value.text()).url : entry.error.code), [
    'https://example.com/delayed?a=0', 'https://example.com/delayed?a=1', 'https://example.com/delayed?a=2',
  ]);
  const metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.maximum, 2);
  const bounded = client.requestMany([requestOptions('/bytes?size=6&chunk=3'), requestOptions('/bytes?size=6&chunk=3')], { concurrency: 2, maxTotalBytes: 8 });
  assert.equal(bounded.filter(entry => entry.ok).length, 1);
  const failed = bounded.find(entry => !entry.ok);
  assert.ok(failed && !failed.ok);
  assert.equal(failed.error.code, 'BODY_TOO_LARGE');
  assert.equal(bounded.reduce((total, entry) => total + (entry.ok ? entry.value.body.byteLength : 0), 0), 6);
  assert.equal(client.request(requestOptions('/bytes?size=2')).body.byteLength, 2);
});

test('batch ingress bounds reject excess count and combined input bodies before transfer', () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token, maxBatchRequests: 2, maxRequestBytes: 4 });
  assert.throws(() => client.requestMany([requestOptions(), requestOptions(), requestOptions()]), error => isJa3ProxyError(error) && error.kind === 'invalid_input');
  const input = { ...requestOptions(), method: 'POST', body: new Uint8Array([1, 2, 3]) };
  assert.throws(() => client.requestMany([input, input]), error => isJa3ProxyError(error) && error.code === 'BODY_TOO_LARGE');
  assert.deepEqual([...input.body], [1, 2, 3]);
});

test('close clamps oversized requested budgets while still deleting remote contexts', async () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token, operationTimeoutMs: 1000 });
  const session = client.createSession({ partition: 'close-budget', connection, cookieMode: 'external' });
  const sessionId = session.info.contextId;
  session.close({ timeoutMs: 2000 });
  session.close();
  let metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(sessionId), false);
  const remaining = client.createSession({ partition: 'close-budget', connection, cookieMode: 'external' });
  const remainingId = remaining.info.contextId;
  client.close({ timeoutMs: 2000 });
  metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(remainingId), false);
});

test('a failed session close blocks new work but retains its handle for explicit cleanup', async () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token });
  const session = client.createSession({ partition: 'cleanup-retry-session', connection, cookieMode: 'external' });
  const id = session.info.contextId;
  assert.throws(() => session.close(), isJa3ProxyError);
  assert.throws(() => session.request({ url: 'https://example.com', method: 'GET' }), error => isJa3ProxyError(error) && error.kind === 'client_closed');
  let metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(id), true);
  assert.equal(metrics.deleteAttempts[id], 1);
  session.close();
  metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(id), false);
  assert.equal(metrics.deleteAttempts[id], 2);
  assert.equal(client.capabilities().service, 'ja3proxy');
});

test('a failed client close preserves healthy worker cleanup but permanently rejects new work', async () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token });
  const session = client.createSession({ partition: 'cleanup-retry-client', connection, cookieMode: 'external' });
  const id = session.info.contextId;
  assert.throws(() => client.close(), isJa3ProxyError);
  assert.throws(() => client.capabilities(), error => isJa3ProxyError(error) && error.kind === 'client_closed');
  assert.throws(() => session.request({ url: 'https://example.com', method: 'GET' }), error => isJa3ProxyError(error) && error.kind === 'client_closed');
  let metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(id), true);
  assert.equal(metrics.deleteAttempts[id], 1);
  client.close();
  session.close();
  metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(id), false);
  assert.equal(metrics.deleteAttempts[id], 2);
  client.close();
});

test('an owned session can finish explicit cleanup after its client close failed', async () => {
  using client = new Ja3ProxySyncClient({ baseUrl, token });
  const session = client.createSession({ partition: 'cleanup-retry-owned', connection, cookieMode: 'external' });
  const id = session.info.contextId;
  assert.throws(() => client.close(), isJa3ProxyError);
  session.close();
  client.close();
  const metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(id), false);
  assert.equal(metrics.deleteAttempts[id], 2);
});

test('a healthy worker retained for failed cleanup does not keep the process alive', async () => {
  const program = `
import { Ja3ProxySyncClient } from '@sellaro/ja3proxy/sync';
import { isJa3ProxyError } from '@sellaro/ja3proxy';
const client = new Ja3ProxySyncClient(${JSON.stringify({ baseUrl, token })});
const session = client.createSession(${JSON.stringify({ partition: 'cleanup-retry-exit', connection, cookieMode: 'external' })});
let failed = false;
try { client.close(); } catch (error) { if (!isJa3ProxyError(error)) throw error; failed = true; }
if (!failed) throw new Error('Expected the controlled cleanup failure.');
globalThis.retainedClient = client;
console.log(JSON.stringify({ id: session.info.contextId }));
`;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  const output: unknown = JSON.parse(child.stdout);
  assert.ok(output !== null && typeof output === 'object' && 'id' in output && typeof output.id === 'string');
  const metrics = await fetch(`${baseUrl}/metrics`, { headers: { authorization: `Bearer ${token}` } }).then(response => response.json());
  assert.equal(metrics.contextIds.includes(output.id), true);
  assert.equal(metrics.deleteAttempts[output.id], 1);
  const cleanup = await fetch(`${baseUrl}/contexts/${output.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ partition: 'cleanup-retry-exit' }),
  });
  assert.equal(cleanup.status, 204);
});

test('managed sessions remain worker-owned, refresh revision and retain cookies through rebind', () => {
  using first = new Ja3ProxySyncClient({ baseUrl, token });
  using second = new Ja3ProxySyncClient({ baseUrl, token });
  const privateConnection = { ...connection, egress: { mode: 'proxy' as const, url: 'http://fixture-user:fixture-password@127.0.0.1:9' } };
  using session = first.createSession({ partition: 'session-test', connection: privateConnection, cookieMode: 'managed', allowedOrigins: ['https://example.com'] });
  using other = second.createSession({ partition: 'session-test', connection, cookieMode: 'managed', allowedOrigins: ['https://example.com'] });
  assert.notEqual(session.info.contextId, other.info.contextId);
  session.setCookies('https://example.com', ['session=one']);
  assert.equal(session.info.revision, 1);
  assert.equal(session.getCookies(new URL('https://example.com'))[0]?.value, 'one');
  assert.deepEqual(other.getCookies('https://example.com'), []);
  const snapshot = session.exportCookies();
  const previousContextId = session.info.contextId;
  const rebound = session.rebindIdentity({ ...connection.identity, userAgent: 'new-identity' });
  assert.equal(rebound.state, 'committed');
  assert.equal(rebound.previousContextId, previousContextId);
  assert.notEqual(session.info.contextId, previousContextId);
  assert.deepEqual(session.exportCookies().cookies, snapshot.cookies);
  const visible = JSON.stringify({ first, session }) + inspect(first) + inspect(session);
  assert.doesNotMatch(visible, new RegExp(token));
  assert.doesNotMatch(visible, /fixture-password|fixture-user/);
  session.close();
  assert.throws(() => session.request({ url: 'https://example.com', method: 'GET' }), error => isJa3ProxyError(error) && error.kind === 'client_closed');
});

test('nonserializable inputs fail safely and a hard timeout invalidates the worker', () => {
  const client = new Ja3ProxySyncClient({ baseUrl, token, operationTimeoutMs: 200 });
  // Runtime checks defend JS callers too, not just declaration-file consumers.
  assert.throws(() => Reflect.construct(Ja3ProxySyncClient, [{ baseUrl, token, observer() {} }]), error => isJa3ProxyError(error) && error.kind === 'invalid_input');
  assert.throws(() => Reflect.apply(client.request, client, [{ ...requestOptions(), signal: new AbortController().signal }]), error => isJa3ProxyError(error) && error.kind === 'invalid_input');
  assert.throws(() => Reflect.apply(client.request, client, [{ ...requestOptions(), body: new ReadableStream() }]), error => isJa3ProxyError(error) && error.kind === 'invalid_input');
  // A real wall-clock bound is essential here: fake main-thread timers cannot run while Atomics.wait blocks.
  const started = performance.now();
  const result = client.tryRequest(requestOptions('/hang'));
  assert.equal(result.ok, false);
  if (!result.ok) { assert.equal(result.error.code, 'TIMEOUT'); assert.equal(result.error.delivery, 'possibly_sent'); }
  assert.ok(performance.now() - started < 5000);
  assert.throws(() => client.capabilities(), isJa3ProxyError);
  client.close();
  client.close();
});
