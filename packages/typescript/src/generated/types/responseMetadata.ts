// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `ResponseMetadata`'s JSON-Schema
 * via the `definition` "Delivery".
 */
export type Delivery = 'not_started' | 'possibly_sent' | 'response_started';
/**
 * This interface was referenced by `ResponseMetadata`'s JSON-Schema
 * via the `definition` "Phase".
 */
export type Phase = 'queued' | 'preparing' | 'upstream' | 'body' | 'complete';

export interface ResponseMetadata {
  cookieRevision?: number | null;
  diagnostics: Diagnostics;
  headers: [string, string][];
  requestId: string;
  status: number;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `ResponseMetadata`'s JSON-Schema
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
