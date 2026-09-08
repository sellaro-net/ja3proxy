import { validateWire } from './generated/validators.js';
import { copyDiagnostics } from './errors.js';
import type { Capabilities, ContextInfo, CookieRecord, CookieSnapshot, HeadersInput, Ja3Diagnostics, Ja3ErrorCode, RequestBody, ResponseMetadata } from './types.js';
import { ERROR_CODES } from './types.js';

export const CONTENT_TYPE = 'application/vnd.ja3proxy';
export const FRAME_LIMIT = 65_536;
export const CONTROL_LIMIT = 1024 * 1024;
export const encoder = new TextEncoder();
export function record<T>(value: T): value is T & Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function positive(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
export function nonnegativeInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
export function opaque(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value); }
export function headerPairs(value: unknown): value is [string, string][] {
  return Array.isArray(value) && value.every((pair: unknown) => Array.isArray(pair) && pair.length === 2 &&
    typeof pair[0] === 'string' && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(pair[0]) &&
    typeof pair[1] === 'string' && !/[\r\n\0]/.test(pair[1]));
}
export function headersFrom(value: HeadersInput | undefined): [string, string][] {
  const pairs: unknown = value === undefined ? [] : value instanceof Headers ? Array.from(value.entries()) : Array.isArray(value) ? value.map(pair => [...pair]) : Object.entries(value);
  if (!headerPairs(pairs)) throw new TypeError('Ungültige Anfrageheader.');
  return pairs.filter(([name]) => !['traceparent', 'tracestate', 'baggage'].includes(name.toLowerCase()));
}
export function diagnostics(value: unknown, requestId?: string, attempt?: number): value is Ja3Diagnostics {
  if (!validateWire('diagnostics', value) || !record(value)) return false;
  return opaque(value.requestId) && (requestId === undefined || value.requestId === requestId) &&
    (attempt === undefined || value.attempt === attempt) &&
    typeof value.tlsProfile === 'string' && (value.tlsProfile === '' ? value.delivery === 'not_started' : /^[a-z0-9_.]{1,64}$/.test(value.tlsProfile)) &&
    (value.traceId === undefined || (typeof value.traceId === 'string' && /^(?!0{32}$)[a-f0-9]{32}$/.test(value.traceId))) &&
    (value.contextId === undefined || opaque(value.contextId)) &&
    (value.clientReused === undefined || typeof value.clientReused === 'boolean') &&
    (value.cookieRevision === undefined || nonnegativeInteger(value.cookieRevision));
}
export function responseMetadata(value: unknown, requestId: string, attempt: number): value is ResponseMetadata {
  return validateWire('responseMetadata', value) && record(value) && value.requestId === requestId &&
    typeof value.status === 'number' && value.status >= 200 && value.status <= 599 && headerPairs(value.headers) &&
    diagnostics(value.diagnostics, requestId, attempt) && value.diagnostics.delivery === 'response_started' &&
    (value.cookieRevision === undefined || nonnegativeInteger(value.cookieRevision));
}
export function errorCode(value: unknown): value is Ja3ErrorCode { return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value); }
export function contextInfo(value: unknown): value is ContextInfo {
  return validateWire('contextInfo', value) && record(value) && opaque(value.contextId) && opaque(value.partition) &&
    record(value.identity) && typeof value.identity.tlsProfile === 'string' && /^[a-z0-9_.]{1,64}$/.test(value.identity.tlsProfile) &&
    (value.identity.userAgent === undefined || (typeof value.identity.userAgent === 'string' && !/[\r\n\0]/.test(value.identity.userAgent)));
}
export function cookieRecords(value: unknown): value is CookieRecord[] {
  return Array.isArray(value) && value.every((cookie: unknown) => validateWire('cookieRecord', cookie) && record(cookie) && cookie.sameSite !== null && cookie.expiresAtMs !== null);
}
export function cookieSnapshot(value: unknown): value is CookieSnapshot {
  return validateWire('cookieSnapshot', value) && record(value) && typeof value.partitionKey === 'string' &&
    value.partitionKey.length > 0 && value.partitionKey.length <= 2048 && cookieRecords(value.cookies);
}
export function capabilities(value: unknown): value is Capabilities {
  if (!validateWire('capabilities', value) || !record(value)) return false;
  const raw = value as unknown as Capabilities;
  return raw.service === 'ja3proxy' && raw.build.length > 0 && raw.profiles.length > 0 &&
    raw.profiles.every(profile => /^[a-z0-9_.]{1,64}$/.test(profile)) &&
    raw.headerDescriptors.every(item => raw.profiles.includes(item.tlsProfile) && headerPairs(item.headers)) &&
    raw.framing.contentType === CONTENT_TYPE && positive(raw.framing.maxMetadataBytes) && raw.framing.maxMetadataBytes <= FRAME_LIMIT &&
    positive(raw.framing.maxDataBytes) && raw.framing.maxDataBytes <= FRAME_LIMIT && positive(raw.framing.maxUploadFrames) &&
    Object.entries(raw.limits).every(([key, limit]) => key === 'maxQueued' || key === 'maxQueuedPerPartition' ? nonnegativeInteger(limit) : positive(limit)) &&
    raw.modes.stream.includes('upload') && raw.modes.stream.includes('download') &&
    raw.modes.cancel.includes('request') && raw.modes.cancel.includes('stream-drop');
}

export function copyResponseMetadata(value: ResponseMetadata): ResponseMetadata {
  return {
    requestId: value.requestId, status: value.status, headers: value.headers.map(([name, content]) => [name, content]),
    diagnostics: copyDiagnostics(value.diagnostics),
    ...(value.cookieRevision === undefined ? {} : { cookieRevision: value.cookieRevision }),
  };
}
export function copyContextInfo(value: ContextInfo): ContextInfo {
  return {
    contextId: value.contextId, partition: value.partition, expiresAtMs: value.expiresAtMs,
    revision: value.revision, cookieMode: value.cookieMode,
    identity: { tlsProfile: value.identity.tlsProfile, emulateHeaders: value.identity.emulateHeaders, ...(value.identity.userAgent === undefined ? {} : { userAgent: value.identity.userAgent }) },
  };
}
export function copyCapabilities(value: Capabilities): Capabilities {
  const limits = value.limits;
  return {
    service: value.service, build: value.build, profiles: [...value.profiles],
    headerDescriptors: value.headerDescriptors.map(item => ({ tlsProfile: item.tlsProfile, headers: item.headers.map(([name, content]) => [name, content]) })),
    framing: { contentType: value.framing.contentType, maxMetadataBytes: value.framing.maxMetadataBytes, maxDataBytes: value.framing.maxDataBytes, maxUploadFrames: value.framing.maxUploadFrames },
    modes: { egress: [...value.modes.egress], cookies: [...value.modes.cookies], stream: [...value.modes.stream], cancel: [...value.modes.cancel] },
    limits: {
      maxRequestBytes: limits.maxRequestBytes, maxResponseBytes: limits.maxResponseBytes, maxTimeoutMs: limits.maxTimeoutMs,
      maxControlBytes: limits.maxControlBytes, maxHeaders: limits.maxHeaders, maxHeaderBytes: limits.maxHeaderBytes,
      maxConcurrent: limits.maxConcurrent, maxConcurrentPerPartition: limits.maxConcurrentPerPartition,
      maxQueued: limits.maxQueued, maxQueuedPerPartition: limits.maxQueuedPerPartition,
      maxContexts: limits.maxContexts, maxContextsPerPartition: limits.maxContextsPerPartition,
      contextIdleTtlMs: limits.contextIdleTtlMs, contextMaxIdleTtlMs: limits.contextMaxIdleTtlMs, contextMaxAgeMs: limits.contextMaxAgeMs,
      maxCookies: limits.maxCookies, maxCookieBytes: limits.maxCookieBytes,
      maxEnvelopes: limits.maxEnvelopes, envelopeTimeoutMs: limits.envelopeTimeoutMs,
      maxCookieSize: limits.maxCookieSize, maxAllowedOrigins: limits.maxAllowedOrigins,
      registryCapacity: limits.registryCapacity, registryTtlMs: limits.registryTtlMs,
    },
  };
}
export function parseJson(bytes: Uint8Array): unknown { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
export function jsonBytes(value: unknown, limit = FRAME_LIMIT): Uint8Array<ArrayBuffer> {
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > limit) throw new RangeError('Metadaten überschreiten die erlaubte Größe.');
  return bytes;
}
export function frame(type: number, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(5 + payload.length);
  bytes[0] = type;
  new DataView(bytes.buffer).setUint32(1, payload.length, false);
  bytes.set(payload, 5);
  return bytes;
}

/** One bounded frame, with backpressure all the way to the service body. */
export class FrameReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private chunk: Uint8Array = new Uint8Array(0);
  private offset = 0;
  constructor(body: ReadableStream<Uint8Array>, private readonly metadataLimit: number, private readonly dataLimit: number) { this.reader = body.getReader(); }
  cancel(): void {
    this.chunk = new Uint8Array(0);
    try { void this.reader.cancel().catch(() => undefined); } catch { /* A released or replaced reader cannot delay cancellation. */ }
  }
  private async exact(length: number, allowEof = false): Promise<Uint8Array | null> {
    const bytes = new Uint8Array(length);
    let written = 0;
    while (written < length) {
      if (this.offset === this.chunk.length) {
        const next = await this.reader.read();
        if (next.done) {
          this.chunk = new Uint8Array(0);
          this.reader.releaseLock();
          if (allowEof && written === 0) return null;
          throw new Error('Die Übertragung ist unvollständig.');
        }
        if (!(next.value instanceof Uint8Array)) throw new Error('Ungültiger Übertragungsrahmen.');
        this.chunk = next.value;
        this.offset = 0;
        if (!this.chunk.length) continue;
      }
      const count = Math.min(length - written, this.chunk.length - this.offset);
      bytes.set(this.chunk.subarray(this.offset, this.offset + count), written);
      this.offset += count;
      written += count;
    }
    return bytes;
  }
  async next(): Promise<{ type: number; payload: Uint8Array } | null> {
    const header = await this.exact(5, true);
    if (header === null) return null;
    const type = header[0]!;
    const length = new DataView(header.buffer).getUint32(1, false);
    if (![1, 2, 3, 4].includes(type) || length > (type === 2 ? this.dataLimit : this.metadataLimit)) throw new Error('Ungültiger Übertragungsrahmen.');
    const payload = await this.exact(length);
    if (payload === null) throw new Error('Die Übertragung ist unvollständig.');
    return { type, payload };
  }
}

export function uploadFrames(metadata: Uint8Array, body: RequestBody | undefined, maxBytes: number, maxData: number, maxFrames: number, onChunk: (chunk: Uint8Array) => void, onError: (error: unknown) => void): { stream: ReadableStream<Uint8Array>; cancel(): void; readonly bytes: number } {
  const source = typeof body === 'string' ? encoder.encode(body) : body;
  const reader = source instanceof ReadableStream ? source.getReader() : undefined;
  const iterator = source != null && !(source instanceof Uint8Array) && !(source instanceof ReadableStream) ? source[Symbol.asyncIterator]() : undefined;
  let pending = source instanceof Uint8Array ? source : new Uint8Array(0);
  let offset = 0;
  let stage = 0;
  let ended = false;
  let sourceEnded = reader === undefined && iterator === undefined;
  let frames = 0;
  let emptyReads = 0;
  let bytes = 0;
  const cancel = () => {
    if (ended && sourceEnded) return;
    ended = true;
    pending = new Uint8Array(0);
    try { if (reader) void reader.cancel().catch(() => undefined); } catch { /* Cancellation cannot replace the transport outcome. */ }
    try { if (iterator?.return) void Promise.resolve(iterator.return()).catch(() => undefined); } catch { /* Iterator cleanup is caller-controlled. */ }
  };
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (ended) { controller.close(); return; }
      try {
        if (stage === 0) { stage = 1; controller.enqueue(frame(1, metadata)); return; }
        while (offset === pending.length && !sourceEnded) {
          const next = reader ? await reader.read() : await iterator!.next();
          if (ended) return;
          if (next.done) { sourceEnded = true; reader?.releaseLock(); break; }
          if (!(next.value instanceof Uint8Array)) throw new TypeError('Ungültiger Anfragerumpf.');
          if (next.value.length === 0) {
            if (++emptyReads >= maxFrames) throw new RangeError('Zu viele leere Anfragerahmen.');
          } else emptyReads = 0;
          pending = next.value;
          offset = 0;
        }
        if (offset < pending.length) {
          const chunk = pending.subarray(offset, Math.min(pending.length, offset + maxData));
          if (bytes + chunk.length > maxBytes || ++frames >= maxFrames) throw new RangeError('Anfragerumpf zu groß.');
          bytes += chunk.length;
          onChunk(chunk);
          offset += chunk.length;
          controller.enqueue(frame(2, chunk));
        } else {
          ended = true;
          pending = new Uint8Array(0);
          controller.enqueue(frame(3, new Uint8Array(0)));
          controller.close();
        }
      } catch (error) { onError(error); controller.error(error); cancel(); }
    },
    cancel,
  }, { highWaterMark: 0 });
  return { stream, cancel, get bytes() { return bytes; } };
}
