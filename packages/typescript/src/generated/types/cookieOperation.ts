// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

export type CookieOperation =
  | {
      operation: 'select';
      partition: string;
      url: string;
    }
  | {
      cookies: string[];
      expectedRevision: number;
      operation: 'set';
      partition: string;
      url: string;
    }
  | {
      operation: 'export';
      partition: string;
    }
  | {
      expectedRevision: number;
      operation: 'import';
      partition: string;
      snapshot: CookieSnapshot;
    };
export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface CookieSnapshot {
  cookies: CookieRecord[];
  partitionKey: string;
}
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
