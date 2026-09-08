import type { Ja3ProxyTransportError } from './errors.js';
import type * as Wire from './generated/wire-types.js';

type Fields<T> = { [Key in keyof T as string extends Key ? never : number extends Key ? never : Key]: T[Key] };
export type Result<T, E = Ja3ProxyTransportError> = { ok: true; value: T } | { ok: false; error: E };
export type Ja3BrowserIdentity = Omit<Wire.ContextInfo['identity'], 'userAgent'> & { userAgent?: NonNullable<Wire.ContextInfo['identity']['userAgent']> };
export type ConnectionSpec = Omit<NonNullable<Wire.RequestMetadata['connection']>, 'identity'> & { identity: Ja3BrowserIdentity };
export type Ja3Egress = ConnectionSpec['egress'];
export type Ja3Diagnostics = Omit<Fields<Wire.Diagnostics>, 'traceId' | 'clientReused' | 'contextId' | 'cookieRevision'> & {
  traceId?: NonNullable<Wire.Diagnostics['traceId']>;
  clientReused?: NonNullable<Wire.Diagnostics['clientReused']>;
  contextId?: NonNullable<Wire.Diagnostics['contextId']>;
  cookieRevision?: NonNullable<Wire.Diagnostics['cookieRevision']>;
};
export type Ja3Delivery = Ja3Diagnostics['delivery'];
export const ERROR_CODES = ['UNAUTHORIZED', 'INVALID_REQUEST', 'UNSUPPORTED_CAPABILITY', 'INVALID_PROFILE', 'EGRESS_REQUIRED', 'SSRF_BLOCKED', 'BODY_TOO_LARGE', 'BUSY', 'TIMEOUT', 'CANCELLED', 'DNS_ERROR', 'PROXY_ERROR', 'TLS_ERROR', 'CONNECT_ERROR', 'PROTOCOL_ERROR', 'CONTEXT_NOT_FOUND', 'CONTEXT_CONFLICT', 'CONTEXT_LIMIT', 'COOKIE_LIMIT', 'DUPLICATE_REQUEST', 'UNKNOWN'] as const;
export type Ja3ErrorCode = Wire.TransportError['code'];
export type Ja3ProxyFailureKind = 'proxy_unreachable' | 'service_unavailable' | 'connection_lost' | 'unknown' | 'client_closed' | 'queue_full' | 'buffer_limit' | 'invalid_input' | 'worker_unavailable';
export type CookieRecord = Omit<Wire.CookieRecord, 'sameSite' | 'expiresAtMs'> & {
  sameSite?: NonNullable<Wire.CookieRecord['sameSite']>;
  expiresAtMs?: NonNullable<Wire.CookieRecord['expiresAtMs']>;
};
export type CookieSnapshot = Omit<Wire.CookieSnapshot, 'cookies'> & { cookies: CookieRecord[] };
export type ContextInfo = Omit<Fields<Wire.ContextInfo>, 'identity'> & { identity: Ja3BrowserIdentity };
export type Capabilities = Omit<Fields<Wire.Capabilities>, 'service'> & { service: 'ja3proxy' };
export type ResponseMetadata = Omit<Fields<Wire.ResponseMetadata>, 'diagnostics' | 'cookieRevision'> & {
  diagnostics: Ja3Diagnostics; cookieRevision?: NonNullable<Wire.ResponseMetadata['cookieRevision']>;
};
export type RequestStatus = Omit<Fields<Wire.RequestStatus>, 'state' | 'error' | 'diagnostics'> & {
  state: 'queued' | 'active' | 'complete' | 'failed'; diagnostics: Ja3Diagnostics; error?: Ja3ProxyTransportError;
};
export interface ExchangeStart {
  requestId: string; partition: string; attempt: number; url: string; method: string;
  headers: readonly (readonly [string, string])[]; connection?: ConnectionSpec; contextId?: string;
  timeoutMs: number; maxResponseBytes: number;
}
export interface ExchangeOutcome { diagnostics: Ja3Diagnostics; error?: Ja3ProxyTransportError; metadata?: ResponseMetadata }
export interface ExchangeObservation {
  run?<T>(operation: () => Promise<T>): Promise<T>;
  requestChunk?(chunk: Uint8Array): void;
  responseHeaders?(metadata: ResponseMetadata): void;
  responseChunk?(chunk: Uint8Array): void;
  finish?(outcome: ExchangeOutcome): void;
}
export type ExchangeObserver = (start: ExchangeStart) => ExchangeObservation | void;
export type HeadersInput = Headers | Record<string, string> | readonly (readonly [string, string])[];
export interface ClientOptions {
  baseUrl: string; token: string; transport?: typeof globalThis.fetch;
  serviceHeaders?: (url: string) => HeadersInput; observer?: ExchangeObserver;
  limits?: { maxConcurrent?: number; maxConcurrentPerPartition?: number; maxQueued?: number; maxQueuedPerPartition?: number; maxBufferedBytes?: number };
  controlTimeoutMs?: number; capabilitiesTtlMs?: number; defaultTimeoutMs?: number; maxResponseBytes?: number;
}
export type RequestBody = string | Uint8Array | ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null;
export interface SessionRequestOptions {
  url: string | URL; method: string; headers?: HeadersInput;
  body?: RequestBody; timeoutMs?: number; maxResponseBytes?: number; attempt?: number; requestId?: string;
  signal?: AbortSignal; observer?: ExchangeObserver;
}
export type RequestOptions = SessionRequestOptions & { partition: string } & (
  { connection: ConnectionSpec; contextId?: never } | { contextId: string; connection?: never }
);
export interface BufferedResponse {
  status: number; headers: Record<string, string[]>; body: Uint8Array; elapsed: number; diagnostics: Ja3Diagnostics;
  text(): string; json(): unknown; parseJson<T>(decode: (value: unknown) => T | Promise<T>): Promise<T>;
}
export interface StreamingResponse {
  metadata: ResponseMetadata; body: ReadableStream<Uint8Array>; completion: Promise<Result<Ja3Diagnostics>>;
  close(): Promise<void>; [Symbol.asyncDispose](): Promise<void>;
}
export type FetchObserver = ExchangeObserver | ((url: URL, init?: RequestInit) => ExchangeObserver | undefined);
export interface FetchOptions {
  partition: string; connection: ConnectionSpec; timeoutMs?: number; maxResponseBytes?: number; attempt?: number;
  context?: 'stateless' | 'session'; observer?: FetchObserver;
}
export type ScopedFetch = ((input: string | URL | Request, init?: RequestInit) => Promise<Response>) & {
  close(): Promise<void>; [Symbol.asyncDispose](): Promise<void>;
};
interface SessionOptionsBase {
  partition: string; connection: ConnectionSpec; ttlMs?: number; timeoutMs?: number; maxResponseBytes?: number;
  observer?: FetchObserver; signal?: AbortSignal;
}
export type ExternalSessionOptions = SessionOptionsBase & { cookieMode: 'external'; allowedOrigins?: readonly string[] };
export type ManagedSessionOptions = SessionOptionsBase & { cookieMode: 'managed'; allowedOrigins: readonly string[] };
export type SessionOptions = ExternalSessionOptions | ManagedSessionOptions;
export interface CloseOptions { drain?: boolean; timeoutMs?: number }
export interface ExternalSession {
  readonly info: ContextInfo; readonly fetch: ScopedFetch;
  request(options: SessionRequestOptions): Promise<BufferedResponse>;
  stream(options: SessionRequestOptions): Promise<StreamingResponse>;
  close(options?: CloseOptions): Promise<void>; [Symbol.asyncDispose](): Promise<void>;
}
export type RebindOutcome = {
  state: 'committed'; previousContextId: string; contextId: string;
} | {
  state: 'committed_cleanup_pending'; previousContextId: string; contextId: string; cleanupError: Ja3ProxyTransportError;
};
export interface ManagedSession extends ExternalSession {
  getCookies(url: string, signal?: AbortSignal): Promise<readonly CookieRecord[]>;
  setCookies(url: string, values: readonly string[], signal?: AbortSignal): Promise<void>;
  exportCookies(signal?: AbortSignal): Promise<CookieSnapshot>;
  importCookies(snapshot: CookieSnapshot, signal?: AbortSignal): Promise<void>;
  rebindIdentity(identity: Ja3BrowserIdentity, signal?: AbortSignal): Promise<RebindOutcome>;
}
