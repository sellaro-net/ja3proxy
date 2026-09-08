// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `CookieReply`'s JSON-Schema
 * via the `definition` "CookieSameSite".
 */
export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface CookieReply {
  cookies?: CookieRecord[] | null;
  revision: number;
  snapshot?: CookieSnapshot | null;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `CookieReply`'s JSON-Schema
 * via the `definition` "CookieRecord".
 */
export interface CookieRecord {
  domain: string;
  expiresAtMs?: number | null;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  partitioned: boolean;
  path: string;
  sameSite?: CookieSameSite | null;
  secure: boolean;
  value: string;
}
/**
 * This interface was referenced by `CookieReply`'s JSON-Schema
 * via the `definition` "CookieSnapshot".
 */
export interface CookieSnapshot {
  cookies: CookieRecord[];
  partitionKey: string;
}
