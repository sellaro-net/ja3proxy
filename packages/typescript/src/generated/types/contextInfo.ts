// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `ContextInfo`'s JSON-Schema
 * via the `definition` "CookieMode".
 */
export type CookieMode = 'external' | 'managed';

export interface ContextInfo {
  contextId: string;
  cookieMode: CookieMode;
  expiresAtMs: number;
  identity: BrowserIdentity;
  partition: string;
  revision: number;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `ContextInfo`'s JSON-Schema
 * via the `definition` "BrowserIdentity".
 */
export interface BrowserIdentity {
  emulateHeaders: boolean;
  tlsProfile: string;
  userAgent?: string | null;
}
