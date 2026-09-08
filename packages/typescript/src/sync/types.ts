import type {
  ClientOptions, ContextInfo, CookieRecord, CookieSnapshot, Ja3BrowserIdentity, Ja3Diagnostics,
  RebindOutcome, RequestOptions, Result, SessionOptions,
} from '../types.js';

/** Only serializable, buffered inputs can cross the worker boundary. */
export type SyncRequestOptions = Omit<RequestOptions, 'body' | 'signal' | 'observer' | 'connection' | 'contextId'> &
  ({ connection: NonNullable<RequestOptions['connection']>; contextId?: never } |
   { contextId: string; connection?: never }) & { body?: string | Uint8Array | null };
export type SyncSessionRequestOptions = Omit<SyncRequestOptions, 'partition' | 'connection' | 'contextId'>;
export type SyncSessionOptions = Omit<SessionOptions, 'observer' | 'signal' | 'cookieMode' | 'allowedOrigins'> &
  ({ cookieMode: 'external'; allowedOrigins?: readonly string[] } |
   { cookieMode: 'managed'; allowedOrigins: readonly string[] });
export type SyncClientOptions = Omit<ClientOptions, 'transport' | 'observer' | 'serviceHeaders'> & {
  /** Worker construction and initialization deadline; default 10 seconds. */
  startupTimeoutMs?: number;
  /** Hard bridge deadline, including queueing and control operations; default 60 seconds. */
  operationTimeoutMs?: number;
  /** Maximum input body bytes for one operation; default 16 MiB. */
  maxRequestBytes?: number;
  /** Maximum requests per batch; default 128, hard maximum 4096. */
  maxBatchRequests?: number;
  /** Aggregate retained/in-flight batch payload bytes; default 16 MiB.
   * Body assembly has a separate working-memory bound of twice this limit;
   * transport/frame/header overhead is governed by the async core.
   */
  maxBatchBytes?: number;
  /** Maximum concurrent batch operations; default 8, hard maximum 64. */
  maxBatchConcurrency?: number;
};
export interface SyncBatchOptions {
  concurrency?: number;
  /** Payload-total cap; body assembly working memory is bounded to twice this value. */
  maxTotalBytes?: number;
  /** May shorten, but never extend, the client's hard operation deadline. */
  timeoutMs?: number;
}
export interface SyncBufferedResponse {
  status: number;
  headers: Record<string, string[]>;
  body: Uint8Array;
  elapsed: number;
  diagnostics: Ja3Diagnostics;
  text(): string;
  json(): unknown;
  /** Synchronous decoders only; asynchronous decoders are rejected at runtime. */
  parseJson<T>(decode: (value: unknown) => T extends PromiseLike<unknown> ? never : T): T;
}
export interface SyncSession {
  readonly info: ContextInfo;
  request(options: SyncSessionRequestOptions): SyncBufferedResponse;
  tryRequest(options: SyncSessionRequestOptions): Result<SyncBufferedResponse>;
  close(options?: { drain?: boolean; timeoutMs?: number }): void;
  [Symbol.dispose](): void;
}
export interface SyncManagedSession extends SyncSession {
  getCookies(url: string | URL): readonly CookieRecord[];
  setCookies(url: string | URL, values: readonly string[]): void;
  exportCookies(): CookieSnapshot;
  importCookies(snapshot: CookieSnapshot): void;
  rebindIdentity(identity: Ja3BrowserIdentity): RebindOutcome;
}
