// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `TransportError`'s JSON-Schema
 * via the `definition` "ErrorCode".
 */
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_CAPABILITY'
  | 'INVALID_PROFILE'
  | 'EGRESS_REQUIRED'
  | 'SSRF_BLOCKED'
  | 'BODY_TOO_LARGE'
  | 'BUSY'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'DNS_ERROR'
  | 'PROXY_ERROR'
  | 'TLS_ERROR'
  | 'CONNECT_ERROR'
  | 'PROTOCOL_ERROR'
  | 'CONTEXT_NOT_FOUND'
  | 'CONTEXT_CONFLICT'
  | 'CONTEXT_LIMIT'
  | 'COOKIE_LIMIT'
  | 'DUPLICATE_REQUEST'
  | 'UNKNOWN';
/**
 * This interface was referenced by `TransportError`'s JSON-Schema
 * via the `definition` "Delivery".
 */
export type Delivery = 'not_started' | 'possibly_sent' | 'response_started';
/**
 * This interface was referenced by `TransportError`'s JSON-Schema
 * via the `definition` "Phase".
 */
export type Phase = 'queued' | 'preparing' | 'upstream' | 'body' | 'complete';

export interface TransportError {
  code: ErrorCode;
  diagnostics?: Diagnostics | null;
  message: string;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `TransportError`'s JSON-Schema
 * via the `definition` "Diagnostics".
 */
export interface Diagnostics {
  attempt: number;
  bodyMs: number | null;
  clientReused?: boolean | null;
  contextId?: string | null;
  cookieRevision?: number | null;
  delivery: Delivery;
  headersMs: number | null;
  phase: Phase;
  queueMs: number;
  requestBytes: number;
  requestId: string;
  responseBytes: number;
  tlsProfile: string;
  totalMs: number;
  traceId?: string | null;
  [k: string]: unknown;
}
