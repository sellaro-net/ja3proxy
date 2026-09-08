import { Ja3ProxyTransportError, isJa3ProxyError } from '@sellaro/ja3proxy';
import { initialDiagnostics } from '../errors.js';
import { validateWire } from '../generated/validators.js';
import { ERROR_CODES } from '../types.js';
import type {
  ClientOptions, ConnectionSpec, Ja3BrowserIdentity, Ja3Diagnostics, Ja3ErrorCode,
  Ja3ProxyFailureKind, Result,
} from '../types.js';
import type {
  SyncBufferedResponse, SyncRequestOptions, SyncSessionOptions,
  SyncSessionRequestOptions,
} from './types.js';

export const MAX_TIMEOUT_MS = 2_147_483_647;
export const MAX_METADATA_BYTES = 1024 * 1024;
export type Operation = 'request' | 'tryRequest' | 'requestMany' | 'capabilities' | 'requestStatus' |
  'cancelRequest' | 'createSession' | 'sessionRequest' | 'sessionTryRequest' | 'sessionClose' |
  'getCookies' | 'setCookies' | 'exportCookies' | 'importCookies' | 'rebindIdentity' | 'close';
export const operations: readonly Operation[] = [
  'request', 'tryRequest', 'requestMany', 'capabilities', 'requestStatus', 'cancelRequest',
  'createSession', 'sessionRequest', 'sessionTryRequest', 'sessionClose', 'getCookies',
  'setCookies', 'exportCookies', 'importCookies', 'rebindIdentity', 'close',
];
export interface Command { id: number; operation: Operation; timeoutMs: number; value: unknown }
export interface SerializedError {
  code: Ja3ErrorCode; kind: Ja3ProxyFailureKind; usedProxy: boolean; diagnostics: Ja3Diagnostics;
}
export interface PlainResponse {
  status: number; headers: Record<string, string[]>; body: Uint8Array; elapsed: number; diagnostics: Ja3Diagnostics;
}
export interface BridgeConfig {
  client: ClientOptions;
  startupTimeoutMs: number; operationTimeoutMs: number; maxRequestBytes: number;
  maxBatchRequests: number; maxBatchBytes: number; maxBatchConcurrency: number;
}
export function localError(code: Ja3ErrorCode, kind?: Ja3ProxyFailureKind): Ja3ProxyTransportError {
  return new Ja3ProxyTransportError(code, initialDiagnostics(), false, kind);
}
export function invalid(): never { throw localError('INVALID_REQUEST', 'invalid_input'); }
export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return invalid();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.getOwnPropertyDescriptor(value, key)?.enumerable || !('value' in Object.getOwnPropertyDescriptor(value, key)!)) return invalid();
  }
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid();
}
export function text(value: unknown, max = MAX_METADATA_BYTES): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return invalid();
  return value;
}
export function integer(value: unknown, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const number = value === undefined ? fallback : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0 || number > maximum) return invalid();
  return number;
}
export function url(value: unknown): string {
  try {
    const parsed = new URL(value instanceof URL ? value.href : text(value));
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return invalid();
    return parsed.href;
  } catch { return invalid(); }
}
export function identity(value: unknown): Ja3BrowserIdentity {
  const input = object(value);
  keys(input, ['tlsProfile', 'emulateHeaders', 'userAgent']);
  if (typeof input.emulateHeaders !== 'boolean') return invalid();
  return { tlsProfile: text(input.tlsProfile, 64), emulateHeaders: input.emulateHeaders,
    ...(input.userAgent === undefined ? {} : { userAgent: text(input.userAgent, 8192) }) };
}
export function connection(value: unknown): ConnectionSpec {
  const input = object(value);
  keys(input, ['egress', 'identity']);
  const egress = object(input.egress);
  keys(egress, ['mode', 'url']);
  if (egress.mode === 'direct' && egress.url === undefined) return { egress: { mode: 'direct' }, identity: identity(input.identity) };
  if (egress.mode !== 'proxy') return invalid();
  // The async core owns proxy scheme/credential validation. Never place this URL in errors.
  return { egress: { mode: 'proxy', url: text(egress.url, 8192) }, identity: identity(input.identity) };
}
function headers(value: unknown): [string, string][] | undefined {
  if (value === undefined) return undefined;
  let pairs: [string, string][];
  if (value instanceof Headers) pairs = [...value.entries()];
  else if (Array.isArray(value)) {
    pairs = value.map((entry: unknown) => {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') return invalid();
      return [entry[0], entry[1]];
    });
  } else {
    pairs = Object.entries(object(value)).map(([name, entry]) => {
      if (typeof entry !== 'string') return invalid();
      return [name, entry];
    });
  }
  if (pairs.length > 4096 || pairs.reduce((size, [name, entry]) => size + Buffer.byteLength(name) + Buffer.byteLength(entry), 0) > MAX_METADATA_BYTES) invalid();
  try { new Headers(pairs); } catch { return invalid(); }
  return pairs;
}
/** Keep adjacent caller bytes and shared ownership out of structured-clone payloads. */
export function compactBytes(value: Uint8Array): Uint8Array {
  if (value.buffer instanceof SharedArrayBuffer || value.byteOffset !== 0 || value.byteLength !== value.buffer.byteLength) {
    return new Uint8Array(value);
  }
  return value;
}
export function sessionRequest(value: unknown, maxBytes: number): SyncSessionRequestOptions {
  const input = object(value);
  keys(input, ['url', 'method', 'headers', 'body', 'timeoutMs', 'maxResponseBytes', 'attempt', 'requestId']);
  const body = input.body;
  if (body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof Uint8Array)) return invalid();
  if ((typeof body === 'string' ? Buffer.byteLength(body) : body?.byteLength ?? 0) > maxBytes) throw localError('BODY_TOO_LARGE', 'buffer_limit');
  if (input.attempt !== undefined && (typeof input.attempt !== 'number' || !Number.isSafeInteger(input.attempt) || input.attempt < 0)) return invalid();
  const convertedHeaders = headers(input.headers);
  return {
    url: url(input.url), method: text(input.method, 64),
    ...(convertedHeaders === undefined ? {} : { headers: convertedHeaders }),
    ...(body === undefined ? {} : { body: body instanceof Uint8Array ? compactBytes(body) : body }),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: integer(input.timeoutMs, 1, MAX_TIMEOUT_MS) }),
    ...(input.maxResponseBytes === undefined ? {} : { maxResponseBytes: integer(input.maxResponseBytes, 1) }),
    ...(input.attempt === undefined ? {} : { attempt: input.attempt }),
    ...(input.requestId === undefined ? {} : { requestId: text(input.requestId, 128) }),
  };
}
export function request(value: unknown, maxBytes: number): SyncRequestOptions {
  const input = object(value);
  const { partition, connection: spec, contextId, ...rest } = input;
  const common = { ...sessionRequest(rest, maxBytes), partition: text(partition, 1024) };
  if (spec !== undefined && contextId === undefined) return { ...common, connection: connection(spec) };
  if (contextId !== undefined && spec === undefined) return { ...common, contextId: text(contextId, 256) };
  return invalid();
}
export function sessionOptions(value: unknown): SyncSessionOptions {
  const input = object(value);
  keys(input, ['partition', 'connection', 'cookieMode', 'allowedOrigins', 'ttlMs', 'timeoutMs', 'maxResponseBytes']);
  let allowedOrigins: string[] | undefined;
  if (input.allowedOrigins !== undefined) {
    if (!Array.isArray(input.allowedOrigins) || input.allowedOrigins.length > 4096) return invalid();
    allowedOrigins = input.allowedOrigins.map((entry: unknown) => url(entry));
  }
  const common = { partition: text(input.partition, 1024), connection: connection(input.connection),
    ...(input.ttlMs === undefined ? {} : { ttlMs: integer(input.ttlMs, 1, MAX_TIMEOUT_MS) }),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: integer(input.timeoutMs, 1, MAX_TIMEOUT_MS) }),
    ...(input.maxResponseBytes === undefined ? {} : { maxResponseBytes: integer(input.maxResponseBytes, 1) }) };
  if (input.cookieMode === 'managed' && allowedOrigins !== undefined && allowedOrigins.length > 0) return { ...common, cookieMode: 'managed', allowedOrigins };
  if (input.cookieMode === 'external') return { ...common, cookieMode: 'external', ...(allowedOrigins === undefined ? {} : { allowedOrigins }) };
  return invalid();
}
export function config(value: unknown): BridgeConfig {
  const input = object(value);
  keys(input, ['baseUrl', 'token', 'limits', 'controlTimeoutMs', 'capabilitiesTtlMs', 'defaultTimeoutMs', 'maxResponseBytes',
    'startupTimeoutMs', 'operationTimeoutMs', 'maxRequestBytes', 'maxBatchRequests', 'maxBatchBytes', 'maxBatchConcurrency']);
  const client: ClientOptions = { baseUrl: url(input.baseUrl), token: text(input.token, 16384) };
  for (const key of ['controlTimeoutMs', 'defaultTimeoutMs', 'maxResponseBytes'] as const) {
    if (input[key] !== undefined) client[key] = integer(input[key], 1, key === 'maxResponseBytes' ? Number.MAX_SAFE_INTEGER : MAX_TIMEOUT_MS);
  }
  if (input.capabilitiesTtlMs !== undefined) {
    if (input.capabilitiesTtlMs === 0) client.capabilitiesTtlMs = 0;
    else client.capabilitiesTtlMs = integer(input.capabilitiesTtlMs, 1, MAX_TIMEOUT_MS);
  }
  if (input.limits !== undefined) {
    const limits = object(input.limits);
    keys(limits, ['maxConcurrent', 'maxConcurrentPerPartition', 'maxQueued', 'maxQueuedPerPartition', 'maxBufferedBytes']);
    const converted: NonNullable<ClientOptions['limits']> = {};
    for (const key of ['maxConcurrent', 'maxConcurrentPerPartition', 'maxQueued', 'maxQueuedPerPartition', 'maxBufferedBytes'] as const) {
      if (limits[key] !== undefined) {
        if ((key === 'maxQueued' || key === 'maxQueuedPerPartition') && limits[key] === 0) converted[key] = 0;
        else converted[key] = integer(limits[key], 1);
      }
    }
    client.limits = converted;
  }
  return { client,
    startupTimeoutMs: integer(input.startupTimeoutMs, 10_000, MAX_TIMEOUT_MS),
    operationTimeoutMs: integer(input.operationTimeoutMs, 60_000, MAX_TIMEOUT_MS),
    maxRequestBytes: integer(input.maxRequestBytes, 16 * 1024 * 1024),
    maxBatchRequests: integer(input.maxBatchRequests, 128, 4096),
    maxBatchBytes: integer(input.maxBatchBytes, 16 * 1024 * 1024, Math.floor(Number.MAX_SAFE_INTEGER / 2)),
    maxBatchConcurrency: integer(input.maxBatchConcurrency, 8, 64) };
}
export function encodeError(value: unknown): SerializedError {
  const error = isJa3ProxyError(value) ? value : localError('UNKNOWN', 'worker_unavailable');
  const diagnostics = error.diagnostics;
  return { code: error.code, kind: error.kind, usedProxy: error.usedProxy, diagnostics: {
    requestId: diagnostics.requestId, attempt: diagnostics.attempt, phase: diagnostics.phase,
    delivery: diagnostics.delivery, queueMs: diagnostics.queueMs, headersMs: diagnostics.headersMs,
    bodyMs: diagnostics.bodyMs, totalMs: diagnostics.totalMs, requestBytes: diagnostics.requestBytes,
    responseBytes: diagnostics.responseBytes, tlsProfile: diagnostics.tlsProfile,
    ...(diagnostics.traceId === undefined ? {} : { traceId: diagnostics.traceId }),
    ...(diagnostics.clientReused === undefined ? {} : { clientReused: diagnostics.clientReused }),
    ...(diagnostics.contextId === undefined ? {} : { contextId: diagnostics.contextId }),
    ...(diagnostics.cookieRevision === undefined ? {} : { cookieRevision: diagnostics.cookieRevision }),
  } };
}
export function wire<T>(name: Parameters<typeof validateWire>[0], value: unknown): T {
  if (!validateWire(name, value)) throw localError('PROTOCOL_ERROR');
  return value as T;
}
export function decodeError(value: unknown): Ja3ProxyTransportError {
  const input = object(value);
  const code = ERROR_CODES.find(code => code === input.code);
  const kinds: readonly Ja3ProxyFailureKind[] = ['proxy_unreachable', 'service_unavailable', 'connection_lost', 'unknown', 'client_closed', 'queue_full', 'buffer_limit', 'invalid_input', 'worker_unavailable'];
  const kind = kinds.find(kind => kind === input.kind);
  if (code === undefined || kind === undefined || typeof input.usedProxy !== 'boolean') throw localError('PROTOCOL_ERROR');
  return new Ja3ProxyTransportError(code, wire<Ja3Diagnostics>('diagnostics', input.diagnostics), input.usedProxy, kind);
}
export function plainResponse(value: PlainResponse): PlainResponse {
  return { status: value.status, headers: value.headers, body: compactBytes(value.body), elapsed: value.elapsed, diagnostics: value.diagnostics };
}
export function response(value: unknown): SyncBufferedResponse {
  const input = object(value);
  if (typeof input.status !== 'number' || !Number.isInteger(input.status) || input.status < 100 || input.status > 599 ||
      !(input.body instanceof Uint8Array) || typeof input.elapsed !== 'number' || !Number.isFinite(input.elapsed) || input.elapsed < 0) throw localError('PROTOCOL_ERROR');
  const headerObject = object(input.headers);
  const restoredHeaders: Record<string, string[]> = Object.create(null);
  for (const [name, entries] of Object.entries(headerObject)) {
    if (!Array.isArray(entries) || !entries.every((entry: unknown) => typeof entry === 'string')) throw localError('PROTOCOL_ERROR');
    restoredHeaders[name] = entries;
  }
  const body = input.body;
  return { status: input.status, headers: restoredHeaders, body, elapsed: input.elapsed,
    diagnostics: wire<Ja3Diagnostics>('diagnostics', input.diagnostics),
    text() { return new TextDecoder().decode(body); },
    json(): unknown { return JSON.parse(this.text()); },
    parseJson<T>(decode: (value: unknown) => T extends PromiseLike<unknown> ? never : T): T {
      if (typeof decode !== 'function') return invalid();
      const result = decode(this.json());
      if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
        // Consume a rejected native promise so misuse does not become an unhandled rejection.
        if (result instanceof Promise) void result.catch(() => {});
        return invalid();
      }
      return result;
    } };
}
export function result(value: unknown): Result<SyncBufferedResponse> {
  const input = object(value);
  if (input.ok === true) return { ok: true, value: response(input.value) };
  if (input.ok === false) return { ok: false, error: decodeError(input.error) };
  throw localError('PROTOCOL_ERROR');
}
export function uncertainError(code: 'TIMEOUT' | 'UNKNOWN'): Ja3ProxyTransportError {
  return new Ja3ProxyTransportError(code, { ...initialDiagnostics(), delivery: 'possibly_sent' }, false, 'worker_unavailable');
}
