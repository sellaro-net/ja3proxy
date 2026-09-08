import { Admission, Deadline, Lifetime, MAX_TIMEOUT_MS, timeoutValue } from './concurrency.js';
import { initialDiagnostics, Ja3ProxyTransportError, localError } from './errors.js';
import { validateWire } from './generated/validators.js';
import { capabilities, CONTROL_LIMIT, copyCapabilities, diagnostics, errorCode, jsonBytes, nonnegativeInteger, opaque, parseJson, record } from './protocol.js';
import type { Capabilities, ClientOptions, ConnectionSpec, Ja3Diagnostics } from './types.js';

export class Service {
  private readonly base: URL;
  readonly #token: string;
  readonly transport: typeof globalThis.fetch;
  readonly controlTimeoutMs: number;
  private readonly serviceHeaders?: ClientOptions['serviceHeaders'];
  private readonly ttlMs: number;
  private controlLimit = CONTROL_LIMIT;
  private cached: { expires: number; value: Capabilities } | undefined;
  private loading: Promise<Capabilities> | undefined;
  private readonly lifetime = new Lifetime();
  private readonly admission = new Admission({ maxConcurrent: 8, maxConcurrentPerPartition: 8, maxQueued: 128, maxQueuedPerPartition: 128 });
  constructor(options: ClientOptions) {
    try {
      this.base = new URL(options.baseUrl);
      if (!['http:', 'https:'].includes(this.base.protocol) || this.base.username || this.base.password || this.base.search || this.base.hash) throw new Error();
      this.base.pathname = this.base.pathname.replace(/\/+$/, '') + '/';
    } catch { throw localError('INVALID_REQUEST', 'invalid_input'); }
    if (typeof options.token !== 'string' || options.token.length < 32 || /[\s\x00-\x1f\x7f]/.test(options.token)) throw localError('UNAUTHORIZED');
    this.#token = options.token;
    this.transport = options.transport ?? globalThis.fetch;
    if (typeof this.transport !== 'function') throw localError('INVALID_REQUEST', 'invalid_input');
    this.serviceHeaders = options.serviceHeaders;
    this.controlTimeoutMs = timeoutValue(options.controlTimeoutMs ?? 10_000);
    this.ttlMs = options.capabilitiesTtlMs ?? 60_000;
    if (!nonnegativeInteger(this.ttlMs) || this.ttlMs > MAX_TIMEOUT_MS) throw localError('INVALID_REQUEST', 'invalid_input');
  }
  endpoint(path: string): URL { return new URL(path, this.base); }
  headers(path: string, contentType?: string): Headers {
    const headers = new Headers();
    // This hook is a tracing seam, not a second authentication or routing policy.
    try {
      if (this.serviceHeaders) {
        const supplied = this.serviceHeaders(this.endpoint(path).toString());
        void Promise.resolve(supplied).catch(() => undefined);
        const extra = new Headers(supplied as ConstructorParameters<typeof Headers>[0]);
        for (const key of ['traceparent', 'tracestate', 'baggage']) {
          const value = extra.get(key);
          if (value !== null) headers.set(key, value);
        }
      }
    } catch { /* Instrumentation never replaces a transport outcome. */ }
    headers.set('authorization', `Bearer ${this.#token}`);
    if (contentType) headers.set('content-type', contentType);
    return headers;
  }
  async readJson(response: Response, deadline: Deadline, diag = initialDiagnostics('control'), usedProxy = false): Promise<unknown> {
    if (!response.body) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag, usedProxy);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await deadline.race(reader.read(), diag, usedProxy);
        if (next.done) break;
        if (!(next.value instanceof Uint8Array) || size + next.value.length > this.controlLimit) throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag, usedProxy);
        size += next.value.length;
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return parseJson(bytes);
    } finally { void reader.cancel().catch(() => undefined); }
  }
  transportError(value: unknown, fallback: Ja3Diagnostics, usedProxy: boolean, requireDiagnostics = false): Ja3ProxyTransportError {
    if (!validateWire('transportError', value) || !record(value) || !errorCode(value.code)) return new Ja3ProxyTransportError('PROTOCOL_ERROR', fallback, usedProxy);
    if (value.diagnostics !== undefined && !diagnostics(value.diagnostics, fallback.requestId === 'control' ? undefined : fallback.requestId, fallback.requestId === 'control' ? undefined : fallback.attempt)) return new Ja3ProxyTransportError('PROTOCOL_ERROR', fallback, usedProxy);
    if (requireDiagnostics && !diagnostics(value.diagnostics, fallback.requestId, fallback.attempt)) return new Ja3ProxyTransportError('PROTOCOL_ERROR', fallback, usedProxy);
    return new Ja3ProxyTransportError(value.code, diagnostics(value.diagnostics) ? value.diagnostics : fallback, usedProxy);
  }
  async control(path: string, method: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    const operation = this.lifetime.begin(this.controlTimeoutMs, signal);
    const { deadline } = operation;
    const diag = initialDiagnostics('control');
    let release: (() => void) | undefined;
    let received = false;
    try {
      release = await this.admission.acquire('control', deadline, diag);
      let bytes: Uint8Array<ArrayBuffer> | undefined;
      try { bytes = body === undefined ? undefined : jsonBytes(body, this.controlLimit); }
      catch { throw new Ja3ProxyTransportError('BODY_TOO_LARGE', diag); }
      const headers = this.headers(path, bytes ? 'application/json' : undefined);
      if (deadline.signal.aborted) throw deadline.error(diag);
      const request = Promise.resolve(this.transport(this.endpoint(path), {
        method, headers,
        ...(bytes ? { body: bytes } : {}),
        signal: deadline.signal, redirect: 'manual', cache: 'no-store',
      }));
      void request.then(response => { if (deadline.signal.aborted) void response.body?.cancel().catch(() => undefined); }, () => undefined).catch(() => undefined);
      const response = await deadline.race(request, diag);
      received = true;
      if (response.status >= 300 && response.status <= 399) { void response.body?.cancel().catch(() => undefined); throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag); }
      if (response.ok && response.status === 204) { void response.body?.cancel().catch(() => undefined); return undefined; }
      if (response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
        void response.body?.cancel().catch(() => undefined);
        throw new Ja3ProxyTransportError('PROTOCOL_ERROR', diag);
      }
      const value = await this.readJson(response, deadline, diag);
      if (!response.ok) throw this.transportError(value, diag, false);
      return value;
    } catch (error) {
      if (error instanceof Ja3ProxyTransportError) throw error;
      if (deadline.signal.aborted) throw deadline.error(diag);
      throw new Ja3ProxyTransportError(received ? 'PROTOCOL_ERROR' : 'CONNECT_ERROR', diag, false, 'service_unavailable');
    } finally { release?.(); operation.done(); }
  }
  async capabilities(signal?: AbortSignal): Promise<Capabilities> {
    this.lifetime.assertOpen();
    const deadline = new Deadline(this.controlTimeoutMs, signal);
    try {
      if (deadline.signal.aborted) throw deadline.error();
      if (this.cached && this.cached.expires > Date.now()) return this.cached.value;
      if (!this.loading) {
        const loading = this.control('capabilities', 'GET', undefined).then(raw => {
          if (!capabilities(raw)) throw localError('UNSUPPORTED_CAPABILITY');
          this.controlLimit = Math.min(CONTROL_LIMIT, raw.limits.maxControlBytes);
          const value = copyCapabilities(raw);
          this.cached = { value, expires: Date.now() + this.ttlMs };
          return value;
        });
        this.loading = loading;
        void loading.then(() => { if (this.loading === loading) this.loading = undefined; }, () => { if (this.loading === loading) this.loading = undefined; });
      }
      return await deadline.race(this.loading);
    } finally { deadline.dispose(); }
  }
  close(): Promise<void> { this.cached = undefined; return this.lifetime.close(); }
}
export function validatePartition(partition: string): void { if (!opaque(partition)) throw localError('INVALID_REQUEST', 'invalid_input'); }
export function validateConnection(caps: Capabilities, spec: ConnectionSpec): void {
  if (!record(spec) || !record(spec.identity) || !record(spec.egress)) throw localError('INVALID_REQUEST', 'invalid_input');
  const diag = initialDiagnostics('control', 0, spec.identity.tlsProfile);
  if (typeof spec.identity.tlsProfile !== 'string' || !caps.profiles.includes(spec.identity.tlsProfile)) throw new Ja3ProxyTransportError('INVALID_PROFILE', diag, spec.egress.mode === 'proxy');
  if (typeof spec.identity.emulateHeaders !== 'boolean' || (spec.identity.userAgent !== undefined && (typeof spec.identity.userAgent !== 'string' || /[\r\n\0]/.test(spec.identity.userAgent)))) throw new Ja3ProxyTransportError('INVALID_REQUEST', diag);
  let mode = 'direct';
  if (spec.egress.mode === 'proxy') {
    try {
      const proxy = new URL(spec.egress.url);
      mode = proxy.protocol.slice(0, -1);
      if (!['http', 'https', 'socks4', 'socks4a', 'socks5', 'socks5h'].includes(mode) || !proxy.hostname || proxy.hash || proxy.search) throw new Error();
    } catch { throw new Ja3ProxyTransportError('INVALID_REQUEST', diag, true); }
  } else if (spec.egress.mode !== 'direct') throw new Ja3ProxyTransportError('EGRESS_REQUIRED', diag);
  if (!caps.modes.egress.includes(mode)) throw new Ja3ProxyTransportError('UNSUPPORTED_CAPABILITY', diag, spec.egress.mode === 'proxy');
}
