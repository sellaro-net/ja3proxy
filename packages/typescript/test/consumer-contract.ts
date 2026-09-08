import { Ja3ProxyClient, type ConnectionSpec, type BufferedResponse, type Result } from '@sellaro/ja3proxy';
import { Ja3ProxySyncClient, type SyncBufferedResponse } from '@sellaro/ja3proxy/sync';
import type { Ja3ProxyClient as ImportedClient } from '@sellaro/ja3proxy' with { 'resolution-mode': 'import' };
import type { Ja3ProxyClient as RequiredClient } from '@sellaro/ja3proxy' with { 'resolution-mode': 'require' };

// Private fields make independently emitted class declarations incompatible:
// import and require must refer to one canonical nominal client type.
function mixedModuleTypes(imported: ImportedClient, required: RequiredClient) {
  const acceptedByRequire: RequiredClient = imported;
  const acceptedByImport: ImportedClient = required;
  return [acceptedByRequire, acceptedByImport];
}
void mixedModuleTypes;

const connection: ConnectionSpec = { egress: { mode: 'direct' }, identity: { tlsProfile: 'chrome_120', emulateHeaders: false } };
const client = new Ja3ProxyClient({ baseUrl: 'http://127.0.0.1:8080', token: 'explicit-credential' });
const options = { partition: 'consumer', url: new URL('https://example.com'), method: 'GET', connection };
const response: Promise<BufferedResponse> = client.request(options);
const result: Promise<Result<BufferedResponse>> = client.tryRequest(options);
void response;
void result;

// A request must choose exactly one explicit connection or existing context.
// @ts-expect-error Missing connection/context must not imply direct egress.
client.request({ partition: 'consumer', url: 'https://example.com', method: 'GET' });
// @ts-expect-error A context and an ad-hoc connection cannot both be supplied.
client.request({ ...options, contextId: 'context-id' });
// @ts-expect-error Credentials may not default from an application environment.
new Ja3ProxyClient({ baseUrl: 'http://127.0.0.1:8080' });
// @ts-expect-error Managed cookies must have an explicit origin boundary.
client.createSession({ partition: 'consumer', connection, cookieMode: 'managed' });

async function sessionContract() {
  const external = await client.createSession({ partition: 'consumer', connection, cookieMode: 'external' });
  // @ts-expect-error An external-cookie context must not expose the managed jar.
  await external.exportCookies();
  const managed = await client.createSession({ partition: 'consumer', connection, cookieMode: 'managed', allowedOrigins: ['https://example.com'] });
  await managed.setCookies('https://example.com/', ['a=b; Secure; Path=/']);
  const snapshot = await managed.exportCookies();
  await managed.importCookies(snapshot);
  const buffered = await managed.request({ url: 'https://example.com', method: 'GET' });
  // @ts-expect-error Unvalidated JSON cannot be claimed to have application fields.
  const unsafe: { id: number } = buffered.json();
  void unsafe;
  const parsed: { id: number } = await buffered.parseJson(value => {
    if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'number') throw new Error('Invalid application payload');
    return { id: value.id };
  });
  return parsed;
}
void sessionContract;

const sync = new Ja3ProxySyncClient({ baseUrl: 'http://127.0.0.1:8080', token: 'explicit-credential' });
const buffered: SyncBufferedResponse = sync.request(options);
void buffered;
// @ts-expect-error Functions cannot cross the synchronous worker boundary.
new Ja3ProxySyncClient({ baseUrl: 'http://127.0.0.1:8080', token: 'explicit-credential', transport: fetch });
// @ts-expect-error Observers cannot cross the synchronous worker boundary.
new Ja3ProxySyncClient({ baseUrl: 'http://127.0.0.1:8080', token: 'explicit-credential', observer: () => {} });
// @ts-expect-error Signals cannot be synchronously transferred to a worker.
sync.request({ ...options, signal: new AbortController().signal });
// @ts-expect-error Sync upload inputs must be finite buffered values.
sync.request({ ...options, body: new ReadableStream<Uint8Array>() });
// @ts-expect-error Synchronous JSON decoding cannot return a promise.
buffered.parseJson(async value => value);
