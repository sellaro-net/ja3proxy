import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Start an actual Rust service separately with ALLOW_PRIVATE_IPS=true for this
// controlled origin. Required: JA3_PROXY_URL, JA3_PROXY_TOKEN. Docker Desktop:
// JA3_SMOKE_ORIGIN_HOST=host.docker.internal. Host networking: 127.0.0.1.
// Optional: JA3_SMOKE_ORIGIN_PORT/BIND, JA3_SMOKE_TLS_PROFILE. Never uses a mock
// service or public upstream. The selected service must reach the origin host.
assert.ok(process.env.JA3_PROXY_URL, 'JA3_PROXY_URL must name the real Rust service.');
assert.ok(process.env.JA3_PROXY_TOKEN, 'JA3_PROXY_TOKEN must be explicitly supplied.');
const baseUrl = process.env.JA3_PROXY_URL.replace(/\/$/, '');
const token = process.env.JA3_PROXY_TOKEN;
const require = createRequire(import.meta.url);
const installed = process.env.JA3_SDK_INSTALLED === 'true';
const cjs = process.env.JA3_SDK_MODULE_MODE === 'cjs';
const sdk = cjs ? require(installed ? '@sellaro/ja3proxy' : '../dist/index.cjs') : await import(installed ? '@sellaro/ja3proxy' : '../dist/index.js');
const otherRoot = cjs ? await import(installed ? '@sellaro/ja3proxy' : '../dist/index.js') : require(installed ? '@sellaro/ja3proxy' : '../dist/index.cjs');
const syncSdk = cjs ? require(installed ? '@sellaro/ja3proxy/sync' : '../dist/sync/index.cjs') : await import(installed ? '@sellaro/ja3proxy/sync' : '../dist/sync/index.js');
const { Ja3ProxyClient, getResponseCompletion, isJa3ProxyError } = sdk;
const { Ja3ProxySyncClient } = syncSdk;
const originProcess = fork(fileURLToPath(new URL('./interop-origin.mjs', import.meta.url)), [], {
  stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key))),
});
const originReady = await Promise.race([
  once(originProcess, 'message'),
  once(originProcess, 'exit').then(() => { throw new Error('Interop origin exited before readiness.'); }),
  new Promise((_, reject) => { const timeout = setTimeout(() => reject(new Error('Interop origin readiness timed out.')), 10_000); timeout.unref(); }),
]);
const origin = `http://${process.env.JA3_SMOKE_ORIGIN_HOST ?? '127.0.0.1'}:${originReady[0].port}`;
const partition = `sdk-smoke-${randomUUID()}`;
const client = new Ja3ProxyClient({ baseUrl, token, defaultTimeoutMs: 10_000 });
let sync;
let managed;
let imported;
try {
  assert.equal((await fetch(`${baseUrl}/capabilities`, { signal: AbortSignal.timeout(5000) })).status, 401, 'Rust API must reject missing authentication.');
  const invalid = new Ja3ProxyClient({ baseUrl, token: 'invalid-explicit-credential-32-characters' });
  try { await assert.rejects(invalid.capabilities(), error => isJa3ProxyError(error) && error.code === 'UNAUTHORIZED'); }
  finally { await invalid.close(); }
  const capabilities = await client.capabilities();
  assert.equal(capabilities.service, 'ja3proxy');
  assert.equal(capabilities.framing.contentType, 'application/vnd.ja3proxy');
  const profile = process.env.JA3_SMOKE_TLS_PROFILE ?? 'chrome_120';
  assert.ok(capabilities.profiles.includes(profile), 'Configured smoke TLS profile must be advertised.');
  const connection = { egress: { mode: 'direct' }, identity: { tlsProfile: profile, emulateHeaders: false } };
  const request = { partition, connection, method: 'GET', timeoutMs: 10_000 };
  const expected = Uint8Array.from({ length: 196_613 }, (_, index) => index % 251);
  async function* upload() {
    yield expected.subarray(0, 65_537);
    yield expected.subarray(65_537, 131_074);
    yield expected.subarray(131_074);
  }
  const echoed = await client.request({ ...request, url: `${origin}/echo`, method: 'POST', body: upload() });
  assert.equal(echoed.status, 200);
  assert.deepEqual(echoed.body, expected, 'Binary streaming upload must preserve bytes beyond frame boundaries.');
  assert.equal(echoed.diagnostics.phase, 'complete');
  const stream = await client.stream({ ...request, url: `${origin}/stream` });
  const chunks = [];
  for await (const chunk of stream.body) chunks.push(chunk);
  const finished = await stream.completion;
  assert.equal(finished.ok, true, 'Success requires an authenticated terminal success frame.');
  assert.deepEqual(new Uint8Array(Buffer.concat(chunks)), expected);
  assert.equal(finished.value.responseBytes, expected.length);

  // Headers and initial body bytes succeed, but the terminal limit failure must
  // still reject consumption and remain observable on completion.
  const limited = await client.stream({ ...request, url: `${origin}/oversize`, maxResponseBytes: 1024 });
  await assert.rejects(async () => { for await (const _chunk of limited.body) { /* consume to terminal */ } }, error => isJa3ProxyError(error) && error.code === 'BODY_TOO_LARGE');
  const failed = await limited.completion;
  assert.equal(failed.ok, false);
  assert.equal(failed.error.code, 'BODY_TOO_LARGE');
  assert.equal(failed.error.delivery, 'response_started');
  assert.ok(failed.error instanceof otherRoot.Ja3ProxyTransportError, 'Opposite module format must recognize the real Rust terminal error.');

  managed = await client.createSession({ partition, connection, cookieMode: 'managed', allowedOrigins: [origin] });
  await managed.request({ url: `${origin}/cookies/set`, method: 'GET' });
  assert.equal((await managed.request({ url: `${origin}/cookies`, method: 'GET' })).text(), 'smoke=server');
  assert.equal((await managed.getCookies(`${origin}/`)).find(cookie => cookie.name === 'smoke')?.value, 'server');
  const snapshot = await managed.exportCookies();
  imported = await client.createSession({ partition, connection, cookieMode: 'managed', allowedOrigins: [origin] });
  await imported.importCookies(snapshot);
  assert.equal((await imported.request({ url: `${origin}/cookies`, method: 'GET' })).text(), 'smoke=server');
  await managed.setCookies(`${origin}/`, ['smoke=client; Path=/; HttpOnly']);
  assert.equal((await managed.request({ url: `${origin}/cookies`, method: 'GET' })).text(), 'smoke=client');
  assert.equal((await imported.request({ url: `${origin}/cookies`, method: 'GET' })).text(), 'smoke=server', 'Imported jars must remain isolated.');

  const fetcher = client.createFetch({ partition, connection });
  try {
    const response = await fetcher(`${origin}/stream`);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);
    const completion = otherRoot.getResponseCompletion(response);
    assert.ok(completion, 'Opposite module format must recognize completion of the real Rust response.');
    assert.equal(completion, getResponseCompletion(response));
    assert.equal((await completion).ok, true);
  } finally { await fetcher.close(); }

  const requestId = randomUUID();
  const pending = await client.stream({ ...request, url: `${origin}/slow`, requestId });
  await client.cancelRequest(requestId, partition);
  await assert.rejects(async () => { for await (const _chunk of pending.body) { /* consume cancellation */ } }, error => isJa3ProxyError(error) && error.code === 'CANCELLED');
  const cancelled = await pending.completion;
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.code, 'CANCELLED');
  const status = await client.requestStatus(requestId, partition);
  assert.equal(status.state, 'failed');
  assert.equal(status.error.code, 'CANCELLED');

  // This call genuinely blocks the caller: origin lives in its own process and
  // the Rust service and packaged async worker must complete independently.
  sync = new Ja3ProxySyncClient({ baseUrl, token, defaultTimeoutMs: 10_000 });
  assert.equal(sync.capabilities().service, 'ja3proxy');
  const ownedBytes = expected.slice();
  const syncEcho = sync.request({ ...request, url: `${origin}/echo`, method: 'POST', body: ownedBytes });
  assert.deepEqual(syncEcho.body, expected);
  assert.deepEqual(ownedBytes, expected, 'Sync transfer must not detach caller-owned bytes.');
  const many = sync.requestMany([
    { ...request, url: `${origin}/stream` },
    { ...request, url: `${origin}/echo`, method: 'POST', body: new Uint8Array([0, 128, 255]) },
  ]);
  assert.equal(many[0].ok, true);
  assert.deepEqual(many[0].value.body, expected);
  assert.equal(many[1].ok, true);
  assert.deepEqual(many[1].value.body, new Uint8Array([0, 128, 255]));
  console.log(`Real Rust interop passed (${cjs ? 'CJS' : 'ESM'}): auth, binary upload/download, terminal failure, managed cookie isolation/import, fetch completion, cancellation/status, sync worker/batch.`);
} finally {
  try {
    sync?.close();
    const closed = await Promise.allSettled([imported?.close(), managed?.close(), client.close()]);
    const failure = closed.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  } finally {
    if (originProcess.exitCode === null && originProcess.signalCode === null) {
      const exited = once(originProcess, 'exit');
      if (originProcess.connected) originProcess.send('close');
      const kill = setTimeout(() => originProcess.kill(), 3000);
      kill.unref();
      await exited;
      clearTimeout(kill);
    }
  }
}
