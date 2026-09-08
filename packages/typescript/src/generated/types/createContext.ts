// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `CreateContext`'s JSON-Schema
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
/**
 * This interface was referenced by `CreateContext`'s JSON-Schema
 * via the `definition` "CookieMode".
 */
export type CookieMode = 'external' | 'managed';

export interface CreateContext {
  allowedOrigins: string[];
  connection: ConnectionSpec;
  cookieMode: CookieMode;
  partition: string;
  ttlMs?: number | null;
}
/**
 * This interface was referenced by `CreateContext`'s JSON-Schema
 * via the `definition` "ConnectionSpec".
 */
export interface ConnectionSpec {
  egress: Egress;
  identity: BrowserIdentity;
}
/**
 * This interface was referenced by `CreateContext`'s JSON-Schema
 * via the `definition` "BrowserIdentity".
 */
export interface BrowserIdentity {
  emulateHeaders: boolean;
  tlsProfile: string;
  userAgent?: string | null;
}
