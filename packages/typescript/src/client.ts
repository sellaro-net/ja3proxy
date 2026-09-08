import { randomUUID } from 'node:crypto';
import { Admission, BufferBudget, Deadline, Lifetime, timeoutValue } from './concurrency.js';
import { copyDiagnostics, initialDiagnostics, Ja3ProxyTransportError, localError, safeError } from './errors.js';
import { createScopedFetch } from './fetch.js';
import { validateWire } from './generated/validators.js';
import { Observation } from './observation.js';
import { CONTENT_TYPE, copyResponseMetadata, diagnostics, encoder, FrameReader, headersFrom, jsonBytes, nonnegativeInteger, opaque, parseJson, positive, record, responseMetadata, uploadFrames } from './protocol.js';
import { Service, validateConnection, validatePartition } from './service.js';
import { createSession, type SessionHandle } from './sessions.js';
import type { BufferedResponse, Capabilities, ClientOptions, CloseOptions, ConnectionSpec, ExternalSession, ExternalSessionOptions, FetchOptions, Ja3Diagnostics, ManagedSession, ManagedSessionOptions, RequestOptions, RequestStatus, ResponseMetadata, Result, ScopedFetch, SessionOptions, StreamingResponse } from './types.js';

export class Ja3ProxyClient {
  readonly #service: Service;
  private readonly lifetime = new Lifetime();
  private readonly admission: Admission;
  private readonly buffers: BufferBudget;
  private readonly failStreams = new WeakMap<StreamingResponse, (error: Ja3ProxyTransportError) => void>();
  private readonly sessions = new Map<ExternalSession, SessionHandle>();
  private readonly fetchers = new Set<WeakRef<ScopedFetch>>();
  private readonly fetchFinalizer = new FinalizationRegistry<WeakRef<ScopedFetch>>(reference => this.fetchers.delete(reference));
  private readonly observer?: ClientOptions['observer'];
  private readonly defaultTimeoutMs: number;
  private readonly maxResponseBytes: number;
  private closing: Promise<void> | undefined;
  private draining = false;
  constructor(options: ClientOptions) {
    this.#service = new Service(options);
    this.observer = options.observer;
    this.defaultTimeoutMs = timeoutValue(options.defaultTimeoutMs ?? 30_000);
    this.maxResponseBytes = options.maxResponseBytes ?? 16 * 1024 * 1024;
    if (!positive(this.maxResponseBytes)) throw localError('INVALID_REQUEST', 'invalid_input');
    this.admission = new Admission({ maxConcurrent: options.limits?.maxConcurrent ?? 16, maxConcurrentPerPartition: options.limits?.maxConcurrentPerPartition ?? 8, maxQueued: options.limits?.maxQueued ?? 128, maxQueuedPerPartition: options.limits?.maxQueuedPerPartition ?? 32 });
    this.buffers = new BufferBudget(options.limits?.maxBufferedBytes ?? 64 * 1024 * 1024);
  }
  async capabilities(signal?: AbortSignal): Promise<Capabilities> {
    const operation = this.lifetime.begin(this.#service.controlTimeoutMs, signal);
    try { return structuredClone(await operation.deadline.race(this.#service.capabilities(operation.deadline.signal))); }
    finally { operation.done(); }
  }
  async requestStatus(requestId: string, partition: string, signal?: AbortSignal): Promise<RequestStatus> {
    this.lifetime.assertOpen();
    validatePartition(partition);
    if (!opaque(requestId)) throw localError('INVALID_REQUEST', 'invalid_input');
    const operation = this.lifetime.begin(this.#service.controlTimeoutMs, signal);
    try {
      const value = await this.#service.control(`requests/${encodeURIComponent(requestId)}/status`, 'POST', { partition }, operation.deadline.signal);
      if (!validateWire('requestStatus', value) || !record(value) || !diagnostics(value.diagnostics, requestId) || !['queued', 'active', 'complete', 'failed'].includes(String(value.state))) throw localError('PROTOCOL_ERROR');
      if (value.state === 'failed') {
        if (value.error === undefined) throw localError('PROTOCOL_ERROR');
        return { state: 'failed', diagnostics: copyDiagnostics(value.diagnostics), error: this.#service.transportError(value.error, value.diagnostics, false, true) };
      }
      if (value.error !== undefined || (value.state === 'complete' && value.diagnostics.phase !== 'complete')) throw localError('PROTOCOL_ERROR');
      if (value.state !== 'queued' && value.state !== 'active' && value.state !== 'complete') throw localError('PROTOCOL_ERROR');
      return { state: value.state, diagnostics: copyDiagnostics(value.diagnostics) };
    } finally { operation.done(); }
  }
  async cancelRequest(requestId: string, partition: string, signal?: AbortSignal): Promise<void> {
    this.lifetime.assertOpen();
    validatePartition(partition);
    if (!opaque(requestId)) throw localError('INVALID_REQUEST', 'invalid_input');
    const operation = this.lifetime.begin(this.#service.controlTimeoutMs, signal);
    try {
      const value = await this.#service.control(`requests/${encodeURIComponent(requestId)}`, 'DELETE', { partition }, operation.deadline.signal);
      if (!validateWire('requestStatus', value) || !record(value) || !diagnostics(value.diagnostics, requestId)) throw localError('PROTOCOL_ERROR');
    } finally { operation.done(); }
  }
  request(options: RequestOptions): Promise<BufferedResponse> { return this.buffer(this.stream(options)); }
  async tryRequest(options: RequestOptions): Promise<Result<BufferedResponse>> {
    try { return { ok: true, value: await this.request(options) }; }
    catch (error) { return { ok: false, error: safeError(error) }; }
  }
  private async buffer(pending: Promise<StreamingResponse>): Promise<BufferedResponse> {
    const exchange = await pending;
    const reader = exchange.body.getReader();
    const blocks: Uint8Array[] = [];
    let current: Uint8Array = new Uint8Array(0);
    let filled = 0;
    let retained = 0;
    let size = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        let offset = 0;
        while (offset < next.value.length) {
          if (filled === 65_536) { blocks.push(current); current = new Uint8Array(0); filled = 0; }
          if (current.length === 0) {
            const remaining = next.value.subarray(offset);
            this.buffers.reserve(remaining.length * 2, exchange.metadata.diagnostics, false);
            retained += remaining.length * 2;
            current = remaining;
            filled = remaining.length;
            size += remaining.length;
            break;
          }
          if (filled === current.length) {
            const capacity = Math.min(65_536, Math.max(current.length * 2, filled + next.value.length - offset));
            const reservation = (capacity - current.length) * 2;
            this.buffers.reserve(reservation, exchange.metadata.diagnostics, false);
            retained += reservation;
            const grown = new Uint8Array(capacity);
            grown.set(current);
            current = grown;
          }
          const count = Math.min(current.length - filled, next.value.length - offset);
          current.set(next.value.subarray(offset, offset + count), filled);
          filled += count;
          offset += count;
          size += count;
        }
      }
      const completion = await exchange.completion;
      if (!completion.ok) throw completion.error;
      // Capacity was reserved together with each block, including final assembly.
      const body = new Uint8Array(size);
      let offset = 0;
      for (const block of blocks) { body.set(block, offset); offset += block.length; }
      body.set(current.subarray(0, filled), offset);
      const headers: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
      for (const [name, value] of exchange.metadata.headers) (headers[name.toLowerCase()] ??= []).push(value);
      return {
        status: exchange.metadata.status, headers, body, elapsed: completion.value.totalMs, diagnostics: completion.value,
        text() { return new TextDecoder().decode(body); },
        json() { return JSON.parse(new TextDecoder().decode(body)) as unknown; },
        async parseJson<T>(decode: (value: unknown) => T | Promise<T>): Promise<T> { return decode(JSON.parse(new TextDecoder().decode(body)) as unknown); },
      };
    } catch (error) {
      this.failStreams.get(exchange)?.(safeError(error, exchange.metadata.diagnostics));
      await exchange.close();
      const completion = await exchange.completion;
      throw completion.ok ? safeError(error, completion.value) : completion.error;
    } finally { this.buffers.release(retained); reader.releaseLock(); }
  }
  async stream(options: RequestOptions): Promise<StreamingResponse> {
    try { return await this.executeStream(options); }
    catch (error) { throw safeError(error); }
  }
  private async executeStream(options: RequestOptions, connectionHint?: ConnectionSpec, inheritedDeadline?: Deadline): Promise<StreamingResponse> {
    if (!record(options)) throw localError('INVALID_REQUEST', 'invalid_input');
    options = options.connection !== undefined
      ? { ...options, connection: structuredClone(options.connection) }
      : { ...options };
    const requestId = options.requestId ?? randomUUID();
    const attempt = options.attempt ?? 0;
    const connection = options.connection ?? connectionHint;
    const usedProxy = connection?.egress?.mode === 'proxy';
    let diag = initialDiagnostics(requestId, attempt, connection?.identity?.tlsProfile ?? 'unknown');
    const operation = inheritedDeadline
      ? this.lifetime.track(inheritedDeadline, this.draining)
      : this.lifetime.begin(options.timeoutMs ?? this.defaultTimeoutMs, options.signal);
    const { deadline } = operation;
    let release: (() => void) | undefined;
    let releaseReservation: (() => void) | undefined;
    let observation: Observation | undefined;
    let reader: FrameReader | undefined;
    let upload: { stream: ReadableStream<Uint8Array>; cancel(): void; readonly bytes: number } | undefined;
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    let metadata: ResponseMetadata | undefined;
    let finished = false;
    let sent = false;
    let responseBytes = 0;
    let failure: Ja3ProxyTransportError | undefined;
    const terminal = Promise.withResolvers<Result<Ja3Diagnostics>>();
    const updateLocal = (): Ja3Diagnostics => ({ ...diag, totalMs: Math.floor(performance.now() - deadline.started), requestBytes: upload?.bytes ?? 0, responseBytes });
    const finish = (error?: Ja3ProxyTransportError): void => {
      if (finished) return;
      finished = true;
      failure = error;
      deadline.signal.removeEventListener('abort', onAbort);
      if (error) {
        diag = error.diagnostics;
        reader?.cancel();
        deadline.controller.abort();
        try { controller?.error(error); } catch { /* A consumer may already have cancelled its body. */ }
      }
      upload?.cancel();
      release?.();
      releaseReservation?.();
      operation.done();
      observation?.finish({ diagnostics: diag, ...(error ? { error } : {}), ...(metadata ? { metadata } : {}) });
      terminal.resolve(error ? { ok: false, error } : { ok: true, value: { ...diag } });
    };
    const onAbort = () => finish(deadline.error(updateLocal(), usedProxy));
    const normalize = (error: unknown): Ja3ProxyTransportError => failure ?? (error instanceof Ja3ProxyTransportError ? error : deadline.signal.aborted ? deadline.error(updateLocal(), usedProxy) : new Ja3ProxyTransportError(sent ? 'PROTOCOL_ERROR' : 'INVALID_REQUEST', updateLocal(), usedProxy, sent && !metadata ? 'service_unavailable' : undefined));
    deadline.signal.addEventListener('abort', onAbort, { once: true });
    try {
      if (!opaque(requestId) || !nonnegativeInteger(attempt)) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy, 'invalid_input');
      validatePartition(options.partition);
      if ((options.contextId === undefined) === (options.connection === undefined) || (options.contextId !== undefined && !opaque(options.contextId))) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy, 'invalid_input');
      let target: URL;
      let headers: [string, string][];
      try {
        target = new URL(options.url);
        if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.hash || typeof options.method !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(options.method)) throw new Error();
        headers = headersFrom(options.headers);
      } catch { throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy, 'invalid_input'); }
      const method = options.method.toUpperCase();
      const body = typeof options.body === 'string' ? encoder.encode(options.body) : options.body;
      if (body != null && !(body instanceof Uint8Array) && !(body instanceof ReadableStream) && !(typeof body === 'object' && Symbol.asyncIterator in body && typeof body[Symbol.asyncIterator] === 'function')) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy, 'invalid_input');
      if (['GET', 'HEAD'].includes(method) && body != null) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy, 'invalid_input');
      const maximum = options.maxResponseBytes ?? this.maxResponseBytes;
      if (!positive(maximum)) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy, 'invalid_input');
      observation = new Observation({ requestId, partition: options.partition, attempt, url: target.toString(), method, headers, timeoutMs: deadline.timeoutMs, maxResponseBytes: maximum, ...(connection ? { connection } : {}), ...(options.contextId === undefined ? {} : { contextId: options.contextId }) }, [this.observer, options.observer]);
      if (finished) {
        observation.finish({ diagnostics: diag, ...(failure ? { error: failure } : {}) });
        throw failure;
      }
      if (deadline.signal.aborted) throw deadline.error(diag, usedProxy);
      releaseReservation = this.admission.reserve(options.partition, diag, usedProxy);
      const caps = await deadline.race(this.#service.capabilities(deadline.signal), diag, usedProxy);
      this.admission.constrain(caps.limits);
      release = await this.admission.acquire(options.partition, deadline, diag, usedProxy);
      if (finished) { release(); throw failure; }
      diag = { ...diag, queueMs: Math.floor(performance.now() - deadline.started) };
      if (connection) validateConnection(caps, connection);
      if (deadline.timeoutMs > caps.limits.maxTimeoutMs || maximum > caps.limits.maxResponseBytes || headers.length > caps.limits.maxHeaders || headers.reduce((sum, [name, value]) => sum + encoder.encode(name).length + encoder.encode(value).length, 0) > caps.limits.maxHeaderBytes) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy);
      const bodyLength = body instanceof Uint8Array ? body.length : undefined;
      if (bodyLength !== undefined && bodyLength > caps.limits.maxRequestBytes) throw new Ja3ProxyTransportError('BODY_TOO_LARGE', diag, usedProxy);
      const wire = { requestId, partition: options.partition, ...(options.connection ? { connection: options.connection } : { contextId: options.contextId }), url: target.toString(), method, headers, timeoutMs: deadline.remaining(), maxResponseBytes: maximum, attempt, hasBody: body != null, ...(bodyLength === undefined ? {} : { bodyLength }) };
      if (!validateWire('requestMetadata', wire)) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, usedProxy);
      let bytes: Uint8Array;
      try { bytes = jsonBytes(wire, caps.framing.maxMetadataBytes); } catch { throw new Ja3ProxyTransportError('BODY_TOO_LARGE', diag, usedProxy); }
      upload = uploadFrames(bytes, body, caps.limits.maxRequestBytes, caps.framing.maxDataBytes, caps.framing.maxUploadFrames, chunk => observation?.requestChunk(chunk), error => finish(new Ja3ProxyTransportError(error instanceof RangeError ? 'BODY_TOO_LARGE' : 'INVALID_REQUEST', updateLocal(), usedProxy)));
      if (deadline.signal.aborted) throw deadline.error(diag, usedProxy);
      return await observation.run(async () => {
        if (deadline.signal.aborted) throw failure ?? deadline.error(diag, usedProxy);
        const init: RequestInit & { duplex: 'half' } = { method: 'POST', headers: this.#service.headers('request', CONTENT_TYPE), body: upload!.stream, duplex: 'half', redirect: 'manual', cache: 'no-store', signal: deadline.signal };
        if (deadline.signal.aborted) throw failure ?? deadline.error(diag, usedProxy);
        sent = true;
        diag = { ...diag, phase: 'upstream', delivery: 'possibly_sent', ...(options.contextId ? { contextId: options.contextId } : {}) };
        const pending = Promise.resolve(this.#service.transport(this.#service.endpoint('request'), init));
        void pending.then(response => { if (deadline.signal.aborted) void response.body?.cancel().catch(() => undefined); }, () => undefined).catch(() => undefined);
        const response = await deadline.race(pending, diag, usedProxy);
        if (!response.ok) {
          const value = await this.#service.readJson(response, deadline, diag, usedProxy);
          throw this.#service.transportError(value, diag, usedProxy);
        }
        if (response.status !== 200 || response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== CONTENT_TYPE || !response.body) { void response.body?.cancel().catch(() => undefined); throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag, usedProxy); }
        reader = new FrameReader(response.body, caps.framing.maxMetadataBytes, caps.framing.maxDataBytes);
        const first = await deadline.race(reader.next(), diag, usedProxy);
        if (first?.type === 4) {
          const error = this.#service.transportError(parseJson(first.payload), diag, usedProxy, true);
          if (await deadline.race(reader.next(), diag, usedProxy) !== null) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag, usedProxy);
          throw error;
        }
        const value = first?.type === 1 ? parseJson(first.payload) : undefined;
        if (!responseMetadata(value, requestId, attempt) || (options.contextId !== undefined && value.diagnostics.contextId !== options.contextId) || (connection !== undefined && value.diagnostics.tlsProfile !== connection.identity.tlsProfile)) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag, usedProxy);
        metadata = copyResponseMetadata(value);
        diag = metadata.diagnostics;
        observation?.responseHeaders(metadata);
        const bodyless = method === 'HEAD' || [204, 205, 304].includes(value.status);
        const stream = new ReadableStream<Uint8Array>({
          start(value) { controller = value; },
          pull: async current => {
            if (finished) return;
            try {
              const next = await observation!.run(() => deadline.race(reader!.next(), diag, usedProxy));
              if (next?.type === 2) {
                if (bodyless || next.payload.length === 0) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', updateLocal(), usedProxy);
                if (responseBytes + next.payload.length > maximum) throw new Ja3ProxyTransportError('BODY_TOO_LARGE', updateLocal(), usedProxy);
                responseBytes += next.payload.length;
                diag = { ...diag, phase: 'body', responseBytes };
                observation?.responseChunk(next.payload);
                current.enqueue(next.payload);
                return;
              }
              if (next?.type === 4) {
                const error = this.#service.transportError(parseJson(next.payload), updateLocal(), usedProxy, true);
                if (error.delivery !== 'response_started' || await deadline.race(reader!.next(), diag, usedProxy) !== null) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', updateLocal(), usedProxy);
                throw error;
              }
              const complete = next?.type === 3 ? parseJson(next.payload) : undefined;
              if (!diagnostics(complete, requestId, attempt) || complete.phase !== 'complete' || complete.delivery !== 'response_started' || complete.responseBytes !== responseBytes || (options.contextId !== undefined && complete.contextId !== options.contextId) || (metadata?.cookieRevision !== undefined && complete.cookieRevision !== metadata.cookieRevision)) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', updateLocal(), usedProxy);
              if (await deadline.race(reader!.next(), diag, usedProxy) !== null) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', updateLocal(), usedProxy);
              diag = copyDiagnostics(complete);
              finish();
              current.close();
            } catch (error) { finish(normalize(error)); }
          },
          cancel: () => finish(new Ja3ProxyTransportError('CANCELLED', updateLocal(), usedProxy)),
        }, { highWaterMark: 0 });
        if (finished) { controller?.error(failure); throw failure; }
        const close = async () => { finish(new Ja3ProxyTransportError('CANCELLED', updateLocal(), usedProxy)); await terminal.promise; };
        const exchange: StreamingResponse = { metadata: copyResponseMetadata(value), body: stream, completion: terminal.promise, close, [Symbol.asyncDispose]: close };
        this.failStreams.set(exchange, error => finish(new Ja3ProxyTransportError(error.code, updateLocal(), usedProxy, error.kind)));
        return exchange;
      });
    } catch (error) { const normalized = normalize(error); finish(normalized); throw normalized; }
  }
  createFetch(options: FetchOptions): ScopedFetch {
    if (!record(options)) throw localError('INVALID_REQUEST', 'invalid_input');
    this.lifetime.assertOpen();
    let reference: WeakRef<ScopedFetch>;
    const fetcher = createScopedFetch({ assertOpen: () => this.lifetime.assertOpen(), stream: (request, deadline) => this.executeStream(request, undefined, deadline), createSession: settings => this.openSession(settings, true), defaultTimeoutMs: this.defaultTimeoutMs, maxResponseBytes: this.maxResponseBytes }, options, () => {
      this.fetchers.delete(reference);
      this.fetchFinalizer.unregister(fetcher);
    });
    reference = new WeakRef(fetcher);
    this.fetchers.add(reference);
    this.fetchFinalizer.register(fetcher, reference, fetcher);
    return fetcher;
  }
  createSession(options: ManagedSessionOptions): Promise<ManagedSession>;
  createSession(options: ExternalSessionOptions): Promise<ExternalSession>;
  createSession(options: SessionOptions): Promise<ExternalSession | ManagedSession>;
  async createSession(options: SessionOptions): Promise<ExternalSession | ManagedSession> { return (await this.openSession(options)).session; }
  private async openSession(options: SessionOptions, retainOnAbort = false): Promise<SessionHandle> {
    if (!record(options)) throw localError('INVALID_REQUEST', 'invalid_input');
    const operation = this.lifetime.begin(options.timeoutMs ?? this.#service.controlTimeoutMs, options.signal);
    try {
      const owned = await createSession({ service: this.#service, stream: (request, connection, deadline) => this.executeStream(request, connection, deadline), buffer: pending => this.buffer(pending), defaultTimeoutMs: this.defaultTimeoutMs, maxResponseBytes: this.maxResponseBytes }, { ...options, signal: operation.deadline.signal }, value => this.sessions.delete(value));
      // Registration precedes every abort/close branch: the known remote ID must
      // remain owned even if the caller can no longer receive its handle.
      this.sessions.set(owned.session, owned);
      if (this.lifetime.closed) owned.stopAccepting();
      if (this.lifetime.closed || operation.deadline.signal.aborted) {
        if (retainOnAbort) return owned;
        if (!this.lifetime.closed) await owned.close();
        throw operation.deadline.error();
      }
      return owned;
    } catch (error) { throw safeError(error); }
    finally { operation.done(); }
  }
  close(options: CloseOptions = {}): Promise<void> {
    if (!record(options)) return Promise.reject(localError('INVALID_REQUEST', 'invalid_input'));
    if (this.closing) return this.closing;
    const timeoutMs = timeoutValue(options.timeoutMs ?? 10_000);
    if (options.drain !== undefined && typeof options.drain !== 'boolean') return Promise.reject(localError('INVALID_REQUEST', 'invalid_input'));
    this.draining = options.drain === true;
    const deadline = new Deadline(timeoutMs);
    for (const owned of this.sessions.values()) owned.stopAccepting();
    const stopped = this.lifetime.close(options);
    this.closing = (async () => {
      // Creation operations register known contexts before settling. Snapshot only
      // afterwards, so a context completed during close cannot be orphaned.
      try { await deadline.race(stopped); }
      catch (error) {
        // Still stop known session owners below using the expired deadline. With
        // no remote cleanup owed, ordinary drain expiry just cancels local work.
        if (this.sessions.size === 0) await stopped;
        else if (!(error instanceof Ja3ProxyTransportError) || error.code !== 'TIMEOUT') throw error;
      }
      const closeOptions = { ...options, timeoutMs: deadline.remaining() };
      const outcomes = await Promise.allSettled(Array.from(this.sessions.values(), owned => owned.close(closeOptions, deadline)));
      const failed = outcomes.find(outcome => outcome.status === 'rejected');
      if (failed?.status === 'rejected') throw safeError(failed.reason);
      // Parent-owned sessions have succeeded already. Closing their fetch handles
      // cannot retry a failed DELETE within this same explicit close attempt.
      const fetchers = Array.from(this.fetchers, reference => reference.deref()).filter((fetcher): fetcher is ScopedFetch => fetcher !== undefined);
      const handles = await Promise.allSettled(fetchers.map(fetcher => fetcher.close()));
      const failedHandle = handles.find(outcome => outcome.status === 'rejected');
      if (failedHandle?.status === 'rejected') throw safeError(failedHandle.reason);
      await this.#service.close();
      this.fetchers.clear();
    })().catch(error => {
      this.closing = undefined;
      throw error;
    }).finally(() => deadline.dispose());
    return this.closing;
  }
  [Symbol.asyncDispose](): Promise<void> { return this.close(); }
}
