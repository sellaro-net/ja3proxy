// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `CookieSnapshot`'s JSON-Schema
 * via the `definition` "CookieSameSite".
 */
export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface CookieSnapshot {
  cookies: CookieRecord[];
  partitionKey: string;
}
/**
 * This interface was referenced by `CookieSnapshot`'s JSON-Schema
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
