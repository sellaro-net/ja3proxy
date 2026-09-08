// Generated from Rust service DTO schemas. Run contracts:generate; do not edit.

/**
 * This interface was referenced by `Capabilities`'s JSON-Schema
 * via the `definition` "ServiceName".
 */
export type ServiceName = 'ja3proxy';

export interface Capabilities {
  build: string;
  framing: FramingCapabilities;
  headerDescriptors: HeaderDescriptor[];
  limits: CapabilityLimits;
  modes: CapabilityModes;
  profiles: string[];
  service: ServiceName;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `Capabilities`'s JSON-Schema
 * via the `definition` "FramingCapabilities".
 */
export interface FramingCapabilities {
  contentType: string;
  maxDataBytes: number;
  maxMetadataBytes: number;
  maxUploadFrames: number;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `Capabilities`'s JSON-Schema
 * via the `definition` "HeaderDescriptor".
 */
export interface HeaderDescriptor {
  headers: [string, string][];
  tlsProfile: string;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `Capabilities`'s JSON-Schema
 * via the `definition` "CapabilityLimits".
 */
export interface CapabilityLimits {
  contextIdleTtlMs: number;
  contextMaxAgeMs: number;
  contextMaxIdleTtlMs: number;
  envelopeTimeoutMs: number;
  maxAllowedOrigins: number;
  maxConcurrent: number;
  maxConcurrentPerPartition: number;
  maxContexts: number;
  maxContextsPerPartition: number;
  maxControlBytes: number;
  maxCookieBytes: number;
  maxCookieSize: number;
  maxCookies: number;
  maxEnvelopes: number;
  maxHeaderBytes: number;
  maxHeaders: number;
  maxQueued: number;
  maxQueuedPerPartition: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxTimeoutMs: number;
  registryCapacity: number;
  registryTtlMs: number;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `Capabilities`'s JSON-Schema
 * via the `definition` "CapabilityModes".
 */
export interface CapabilityModes {
  cancel: string[];
  cookies: string[];
  egress: string[];
  stream: string[];
  [k: string]: unknown;
}
