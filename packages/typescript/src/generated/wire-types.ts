// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.
import type { RequestMetadata } from './types/requestMetadata.js';
import type { ResponseMetadata } from './types/responseMetadata.js';
import type { Diagnostics } from './types/diagnostics.js';
import type { TransportError } from './types/transportError.js';
import type { ContextInfo } from './types/contextInfo.js';
import type { CookieRecord } from './types/cookieRecord.js';
import type { CookieSnapshot } from './types/cookieSnapshot.js';
import type { Capabilities } from './types/capabilities.js';
import type { CreateContext } from './types/createContext.js';
import type { CookieOperation } from './types/cookieOperation.js';
import type { CookieReply } from './types/cookieReply.js';
import type { RequestStatus } from './types/requestStatus.js';

export type { RequestMetadata } from './types/requestMetadata.js';
export type { ResponseMetadata } from './types/responseMetadata.js';
export type { Diagnostics } from './types/diagnostics.js';
export type { TransportError } from './types/transportError.js';
export type { ContextInfo } from './types/contextInfo.js';
export type { CookieRecord } from './types/cookieRecord.js';
export type { CookieSnapshot } from './types/cookieSnapshot.js';
export type { Capabilities } from './types/capabilities.js';
export type { CreateContext } from './types/createContext.js';
export type { CookieOperation } from './types/cookieOperation.js';
export type { CookieReply } from './types/cookieReply.js';
export type { RequestStatus } from './types/requestStatus.js';

export interface WireContracts {
  requestMetadata: RequestMetadata;
  responseMetadata: ResponseMetadata;
  diagnostics: Diagnostics;
  transportError: TransportError;
  contextInfo: ContextInfo;
  cookieRecord: CookieRecord;
  cookieSnapshot: CookieSnapshot;
  capabilities: Capabilities;
  createContext: CreateContext;
  cookieOperation: CookieOperation;
  cookieReply: CookieReply;
  requestStatus: RequestStatus;
}

export type WireContractName = keyof WireContracts;
