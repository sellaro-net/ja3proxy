// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `RequestMetadata`'s JSON-Schema
 * via the `definition` "Egress".
 */
export type Egress =
  | {
      mode: 'direct';
    }
  | {
      mode: 'proxy';
      url: string;
    };

export interface RequestMetadata {
  attempt: number;
  bodyLength?: number | null;
  connection?: ConnectionSpec | null;
  contextId?: string | null;
  hasBody: boolean;
  headers: [string, string][];
  maxResponseBytes: number;
  method: string;
  partition: string;
  requestId: string;
  timeoutMs: number;
  url: string;
}
/**
 * This interface was referenced by `RequestMetadata`'s JSON-Schema
 * via the `definition` "ConnectionSpec".
 */
export interface ConnectionSpec {
  egress: Egress;
  identity: BrowserIdentity;
}
/**
 * This interface was referenced by `RequestMetadata`'s JSON-Schema
 * via the `definition` "BrowserIdentity".
 */
export interface BrowserIdentity {
  emulateHeaders: boolean;
  tlsProfile: string;
  userAgent?: string | null;
}
