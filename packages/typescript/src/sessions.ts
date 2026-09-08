import { Admission, Deadline, Lifetime, timeoutValue } from './concurrency.js';
import { Ja3ProxyTransportError, localError, safeError } from './errors.js';
import { fetchResponse, resolveFetchObserver } from './fetch.js';
import { validateWire } from './generated/validators.js';
import { contextInfo, cookieRecords, cookieSnapshot, copyContextInfo, headersFrom, nonnegativeInteger, positive, record } from './protocol.js';
import { Service, validateConnection, validatePartition } from './service.js';
import type { BufferedResponse, CloseOptions, ConnectionSpec, ContextInfo, CookieRecord, CookieSnapshot, ExternalSession, Ja3BrowserIdentity, ManagedSession, RebindOutcome, RequestOptions, ScopedFetch, SessionOptions, SessionRequestOptions, StreamingResponse } from './types.js';

export interface SessionHost {
  service: Service;
  stream(options: RequestOptions, connection?: ConnectionSpec, deadline?: Deadline): Promise<StreamingResponse>;
  buffer(stream: Promise<StreamingResponse>): Promise<BufferedResponse>;
  defaultTimeoutMs: number;
  maxResponseBytes: number;
}
export interface SessionHandle {
  session: ExternalSession | ManagedSession;
  close(options?: CloseOptions, deadline?: Deadline): Promise<void>;
  stopAccepting(): void;
  stream(options: SessionRequestOptions, deadline?: Deadline): Promise<StreamingResponse>;
}
function normalizedOrigins(origins: readonly string[], managed: boolean): string[] {
  if (!Array.isArray(origins) || (managed && origins.length === 0)) throw localError('INVALID_REQUEST', 'invalid_input');
  return Array.from(new Set(origins.map(value => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
      return url.origin;
    } catch { throw localError('INVALID_REQUEST', 'invalid_input'); }
  })));
}
async function openContext(service: Service, options: SessionOptions, signal?: AbortSignal): Promise<ContextInfo> {
  validatePartition(options.partition);
  const caps = await service.capabilities(signal);
  validateConnection(caps, options.connection);
  if (!caps.modes.cookies.includes(options.cookieMode)) throw localError('UNSUPPORTED_CAPABILITY');
  if (options.ttlMs !== undefined && (!positive(options.ttlMs) || options.ttlMs > caps.limits.contextMaxIdleTtlMs)) throw localError('INVALID_REQUEST', 'invalid_input');
  const request = { partition: options.partition, connection: options.connection, cookieMode: options.cookieMode, allowedOrigins: options.allowedOrigins ?? [], ...(options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs }) };
  if (!validateWire('createContext', request)) throw localError('INVALID_REQUEST', 'invalid_input');
  const value = await service.control('contexts', 'POST', request, signal);
  if (!contextInfo(value) || value.partition !== options.partition || value.cookieMode !== options.cookieMode || value.identity.tlsProfile !== options.connection.identity.tlsProfile || value.identity.emulateHeaders !== options.connection.identity.emulateHeaders || value.identity.userAgent !== options.connection.identity.userAgent) throw localError('PROTOCOL_ERROR');
  return copyContextInfo(value);
}
interface CookieReply { revision: number; cookies?: CookieRecord[]; snapshot?: CookieSnapshot }

export async function createSession(host: SessionHost, options: SessionOptions, onClose: (session: ExternalSession) => void): Promise<SessionHandle> {
  const { service } = host;
  const managed = options.cookieMode === 'managed';
  if (!managed && options.cookieMode !== 'external') throw localError('INVALID_REQUEST', 'invalid_input');
  const allowedOrigins = normalizedOrigins(options.allowedOrigins ?? [], managed);
  let connection = structuredClone(options.connection);
  const settings: SessionOptions = managed ? { ...options, connection, cookieMode: 'managed', allowedOrigins } : { ...options, connection, cookieMode: 'external', allowedOrigins };
  const caps = await service.capabilities(options.signal);
  const timeoutMs = timeoutValue(options.timeoutMs ?? host.defaultTimeoutMs);
  const maximum = options.maxResponseBytes ?? host.maxResponseBytes;
  if (!positive(maximum) || maximum > caps.limits.maxResponseBytes || timeoutMs > caps.limits.maxTimeoutMs) throw localError('INVALID_REQUEST', 'invalid_input');
  let info = await openContext(service, settings, options.signal);
  const lifetime = new Lifetime();
  const stopAccepting = () => lifetime.stopAccepting();
  const serial = new Admission({ maxConcurrent: 1, maxConcurrentPerPartition: 1, maxQueued: caps.limits.maxQueued, maxQueuedPerPartition: caps.limits.maxQueuedPerPartition });
  const cleanup = new Set<string>([info.contextId]);
  let lost = false;
  let closing: Promise<void> | undefined;
  let session: ExternalSession | ManagedSession;
  const assertUsable = () => {
    lifetime.assertOpen();
    if (lost) throw localError('CONTEXT_NOT_FOUND');
  };
  const markLost = (error: unknown, contextId: string) => {
    if (info.contextId === contextId && error instanceof Ja3ProxyTransportError && error.code === 'CONTEXT_NOT_FOUND') lost = true;
  };
  const applyRevision = (value: number, contextId = info.contextId) => {
    if (info.contextId !== contextId) return;
    if (!nonnegativeInteger(value) || value < info.revision) throw localError('CONTEXT_CONFLICT');
    info = { ...info, revision: value };
  };
  const removeContext = async (id: string, signal?: AbortSignal): Promise<void> => {
    try {
      const value = await service.control(`contexts/${encodeURIComponent(id)}`, 'DELETE', { partition: options.partition }, signal);
      if (value !== undefined) throw localError('PROTOCOL_ERROR');
      cleanup.delete(id);
    } catch (error) {
      if (error instanceof Ja3ProxyTransportError && error.code === 'CONTEXT_NOT_FOUND') { cleanup.delete(id); return; }
      cleanup.add(id);
      throw error;
    }
  };
  const cookies = async (command: Record<string, unknown>, signal: AbortSignal, id = info.contextId): Promise<CookieReply> => {
    const request = { partition: options.partition, ...command };
    if (!validateWire('cookieOperation', request)) throw localError('INVALID_REQUEST', 'invalid_input');
    const value = await service.control(`contexts/${encodeURIComponent(id)}/cookies`, 'POST', request, signal);
    if (!validateWire('cookieReply', value) || !record(value) || !nonnegativeInteger(value.revision)) throw localError('PROTOCOL_ERROR');
    if (value.cookies !== undefined && !cookieRecords(value.cookies)) throw localError('PROTOCOL_ERROR');
    if (value.snapshot !== undefined && !cookieSnapshot(value.snapshot)) throw localError('PROTOCOL_ERROR');
    return value as unknown as CookieReply;
  };
  const mutate = async <T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    assertUsable();
    const owned = lifetime.begin(service.controlTimeoutMs, signal);
    let release: (() => void) | undefined;
    let id = info.contextId;
    try {
      release = await serial.acquire(options.partition, owned.deadline);
      if (lost) throw localError('CONTEXT_NOT_FOUND');
      if (owned.deadline.signal.aborted) throw owned.deadline.error();
      id = info.contextId;
      // Each control operation obeys this signal. Racing the entire transaction
      // would erase a committed rebind when cancellation arrives during cleanup.
      return await operation(owned.deadline.signal);
    } catch (error) { markLost(error, id); throw safeError(error); }
    finally { release?.(); owned.done(); }
  };
  const exportSnapshot = async (signal: AbortSignal): Promise<CookieSnapshot> => {
    const reply = await cookies({ operation: 'export' }, signal);
    if (!reply.snapshot || reply.cookies !== undefined) throw localError('PROTOCOL_ERROR');
    applyRevision(reply.revision);
    return reply.snapshot;
  };
  const stream = async (request: SessionRequestOptions, inheritedDeadline?: Deadline): Promise<StreamingResponse> => {
    assertUsable();
    const owned = inheritedDeadline ? lifetime.track(inheritedDeadline) : lifetime.begin(request.timeoutMs ?? timeoutMs, request.signal);
    let release: (() => void) | undefined;
    let transferred = false;
    let current = info;
    try {
      if (managed) release = await serial.acquire(options.partition, owned.deadline);
      if (lost) throw localError('CONTEXT_NOT_FOUND');
      if (owned.deadline.signal.aborted) throw owned.deadline.error();
      current = info;
      const headers = headersFrom(request.headers);
      if (managed && headers.some(([name]) => name.toLowerCase() === 'cookie')) throw localError('INVALID_REQUEST', 'invalid_input');
      const userAgent = connection.identity.userAgent;
      if (userAgent !== undefined) {
        const values = headers.filter(([name]) => name.toLowerCase() === 'user-agent');
        if (values.some(([, value]) => value !== userAgent)) throw localError('CONTEXT_CONFLICT');
        if (values.length === 0) headers.push(['user-agent', userAgent]);
      }
      const exchange = await host.stream({ ...request, headers, partition: options.partition, contextId: current.contextId, timeoutMs: request.timeoutMs ?? timeoutMs, maxResponseBytes: request.maxResponseBytes ?? maximum, signal: owned.deadline.signal, ...(request.observer ? {} : options.observer ? { observer: resolveFetchObserver(options.observer) } : {}) }, connection, owned.deadline);
      try {
        if (exchange.metadata.diagnostics.contextId !== current.contextId || (managed && (!nonnegativeInteger(exchange.metadata.cookieRevision) || exchange.metadata.cookieRevision < current.revision))) throw localError('PROTOCOL_ERROR');
        if (exchange.metadata.cookieRevision !== undefined) applyRevision(exchange.metadata.cookieRevision, current.contextId);
      } catch (error) { await exchange.close(); throw error; }
      void exchange.completion.then(result => {
        if (!result.ok) markLost(result.error, current.contextId);
        owned.done();
      });
      transferred = true;
      return exchange;
    } catch (error) { markLost(error, current.contextId); throw safeError(error); }
    finally { release?.(); if (!transferred) owned.done(); }
  };
  const close = (closeOptions: CloseOptions = {}, sharedDeadline?: Deadline): Promise<void> => {
    if (!record(closeOptions)) return Promise.reject(localError('INVALID_REQUEST', 'invalid_input'));
    if (closing) return sharedDeadline ? sharedDeadline.race(closing) : closing;
    if (closeOptions.drain !== undefined && typeof closeOptions.drain !== 'boolean') return Promise.reject(localError('INVALID_REQUEST', 'invalid_input'));
    const deadline = sharedDeadline ?? new Deadline(closeOptions.timeoutMs ?? service.controlTimeoutMs);
    const stopped = lifetime.close(closeOptions);
    closing = (async () => {
      await stopped;
      if (deadline.signal.aborted) throw deadline.error();
      const outcomes = await Promise.allSettled(Array.from(cleanup, id => removeContext(id, deadline.signal)));
      const failed = outcomes.find(outcome => outcome.status === 'rejected');
      if (failed?.status === 'rejected') throw safeError(failed.reason);
      onClose(session);
    })().catch(error => {
      closing = undefined;
      throw error;
    }).finally(() => { if (!sharedDeadline) deadline.dispose(); });
    return closing;
  };
  const fetcher: ScopedFetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    assertUsable();
    return fetchResponse(input, init, request => stream(request), { timeoutMs, maxResponseBytes: maximum, observer: options.observer });
  }, { close: () => close(), [Symbol.asyncDispose]: () => close() });
  const external: ExternalSession = {
    get info() { return structuredClone(info); }, fetch: fetcher,
    request: request => host.buffer(stream(request)), stream, close,
    [Symbol.asyncDispose]: () => close(),
  };
  if (!managed) { session = external; return { session, close, stopAccepting, stream }; }
  const managedSession: ManagedSession = {
    ...external,
    get info() { return structuredClone(info); },
    getCookies: (url, signal) => mutate(async active => {
      const reply = await cookies({ operation: 'select', url }, active);
      if (!reply.cookies || reply.snapshot !== undefined) throw localError('PROTOCOL_ERROR');
      applyRevision(reply.revision);
      return reply.cookies;
    }, signal),
    setCookies: (url, values, signal) => mutate(async active => {
      if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) throw localError('INVALID_REQUEST', 'invalid_input');
      const expectedRevision = info.revision;
      const reply = await cookies({ operation: 'set', url, cookies: values, expectedRevision }, active);
      if (reply.revision !== expectedRevision + 1 || reply.cookies !== undefined || reply.snapshot !== undefined) throw localError('PROTOCOL_ERROR');
      applyRevision(reply.revision);
    }, signal),
    exportCookies: signal => mutate(exportSnapshot, signal),
    importCookies: (snapshot, signal) => mutate(async active => {
      if (!cookieSnapshot(snapshot)) throw localError('INVALID_REQUEST', 'invalid_input');
      const expectedRevision = info.revision;
      const reply = await cookies({ operation: 'import', snapshot, expectedRevision }, active);
      if (reply.revision !== expectedRevision + 1 || reply.cookies !== undefined || reply.snapshot !== undefined) throw localError('PROTOCOL_ERROR');
      applyRevision(reply.revision);
    }, signal),
    rebindIdentity: (identity: Ja3BrowserIdentity, signal?: AbortSignal): Promise<RebindOutcome> => mutate<RebindOutcome>(async active => {
      const nextConnection: ConnectionSpec = { egress: { ...connection.egress }, identity: { ...identity } };
      validateConnection(caps, nextConnection);
      const snapshot = await exportSnapshot(active);
      const next = await openContext(service, { ...settings, cookieMode: 'managed', allowedOrigins, connection: nextConnection }, active);
      cleanup.add(next.contextId);
      let imported: CookieReply;
      try {
        imported = await cookies({ operation: 'import', snapshot, expectedRevision: next.revision }, active, next.contextId);
        if (imported.revision !== next.revision + 1 || imported.cookies !== undefined || imported.snapshot !== undefined) throw localError('PROTOCOL_ERROR');
        if (active.aborted) throw localError('CANCELLED');
      } catch (error) {
        cleanup.add(next.contextId);
        // A failed staging import has no cutover. Cleanup failure cannot imply rollback.
        await removeContext(next.contextId, active).catch(() => undefined);
        throw error;
      }
      const previousContextId = info.contextId;
      info = { ...next, revision: imported.revision };
      connection = nextConnection;
      cleanup.add(previousContextId);
      // From this point cancellation or deletion failure must report a committed cutover.
      try {
        await removeContext(previousContextId, active);
        return { state: 'committed', previousContextId, contextId: info.contextId };
      } catch (error) {
        return { state: 'committed_cleanup_pending', previousContextId, contextId: info.contextId, cleanupError: safeError(error) };
      }
    }, signal),
  };
  session = managedSession;
  return { session, close, stopAccepting, stream };
}
