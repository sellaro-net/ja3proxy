import { MessageChannel, receiveMessageOnPort, Worker } from 'node:worker_threads';
import type { MessagePort } from 'node:worker_threads';
import { isJa3ProxyError } from '@sellaro/ja3proxy';
import type { Ja3ProxyTransportError } from '@sellaro/ja3proxy';
import type {
  Capabilities, CloseOptions, ContextInfo, CookieRecord, CookieSnapshot, Ja3BrowserIdentity,
  Ja3Diagnostics, RebindOutcome, RequestStatus, Result,
} from '../types.js';
import {
  config, decodeError, identity, integer, invalid, keys, localError, MAX_METADATA_BYTES, MAX_TIMEOUT_MS,
  object, request, response, result, sessionOptions, sessionRequest, text, uncertainError, url, wire,
} from './ipc.js';
import type { BridgeConfig, Operation } from './ipc.js';
import type {
  SyncBatchOptions, SyncBufferedResponse, SyncClientOptions, SyncManagedSession, SyncRequestOptions,
  SyncSession, SyncSessionOptions, SyncSessionRequestOptions,
} from './types.js';

export type {
  SyncBatchOptions, SyncBufferedResponse, SyncClientOptions, SyncManagedSession, SyncRequestOptions,
  SyncSession, SyncSessionOptions, SyncSessionRequestOptions,
} from './types.js';

function closeOptions(value: CloseOptions | undefined, maximum: number): CloseOptions {
  const input = object(value ?? {});
  keys(input, ['drain', 'timeoutMs']);
  if (input.drain !== undefined && typeof input.drain !== 'boolean') return invalid();
  return { ...(input.drain === undefined ? {} : { drain: input.drain }),
    timeoutMs: Math.min(integer(input.timeoutMs, maximum, MAX_TIMEOUT_MS), maximum) };
}

/** A Node-only blocking facade. Never call it against a server running on the same event loop. */
export class Ja3ProxySyncClient {
  readonly #config: BridgeConfig;
  readonly #worker: Worker;
  readonly #port: MessagePort;
  readonly #signal: Int32Array;
  #sequence = 0;
  #closing = false;
  #closed = false;
  #cleanupComplete = false;
  #failure: Ja3ProxyTransportError | undefined;

  constructor(options: SyncClientOptions) {
    this.#config = config(options);
    const { port1, port2 } = new MessageChannel();
    this.#port = port1;
    this.#signal = new Int32Array(new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT));
    try {
      // The build emits each worker beside its entry, never relative to process.cwd().
      const ownUrl = import.meta.url;
      this.#worker = new Worker(new URL(ownUrl.endsWith('.cjs') ? './worker.cjs' : './worker.js', ownUrl), {
        workerData: { port: port2, signal: this.#signal.buffer, config: this.#config },
        transferList: [port2], execArgv: [],
      });
    } catch {
      port1.close();
      port2.close();
      throw localError('UNKNOWN', 'worker_unavailable');
    }
    // Event listeners remain installed through termination; errors must never escape unhandled.
    this.#worker.on('error', () => {
      this.#failure ??= uncertainError('UNKNOWN');
      Atomics.store(this.#signal, 1, 2);
      Atomics.add(this.#signal, 0, 1);
      Atomics.notify(this.#signal, 0);
    });
    this.#worker.on('exit', () => {
      if (!this.#closed) this.#failure ??= uncertainError('UNKNOWN');
      Atomics.store(this.#signal, 1, 2);
      Atomics.add(this.#signal, 0, 1);
      Atomics.notify(this.#signal, 0);
    });
    this.#worker.unref();
    this.#port.unref();
    try { this.#receive(0, this.#config.startupTimeoutMs, false); }
    catch (error) { this.#release(); throw error; }
  }

  #release(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#port.close();
    // terminate() is deliberately not awaited by a synchronous API. The port is released now.
    void this.#worker.terminate().catch(() => {});
  }

  #receive(id: number, timeoutMs: number, dispatched: boolean): unknown {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const generation = Atomics.load(this.#signal, 0);
      const received = receiveMessageOnPort(this.#port);
      if (received !== undefined) {
        const packet = object(received.message);
        if (packet.id !== id || typeof packet.ok !== 'boolean') {
          this.#failure = localError('PROTOCOL_ERROR');
          this.#release();
          throw this.#failure;
        }
        if (packet.ok) return packet.value;
        const error = decodeError(packet.error);
        if (error.kind === 'worker_unavailable' || Atomics.load(this.#signal, 1) === 2) {
          this.#failure = error;
          this.#release();
        }
        throw error;
      }
      if (this.#failure !== undefined || Atomics.load(this.#signal, 1) === 2) {
        this.#failure ??= dispatched ? uncertainError('UNKNOWN') : localError('UNKNOWN', 'worker_unavailable');
        this.#release();
        throw this.#failure;
      }
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        this.#failure = dispatched ? uncertainError('TIMEOUT') : localError('TIMEOUT', 'worker_unavailable');
        this.#release();
        throw this.#failure;
      }
      // A notification can race the receive above. Waiting on the old generation then
      // returns immediately once, rather than losing that wake-up. No timers or spinning.
      Atomics.wait(this.#signal, 0, generation, remaining);
    }
  }

  #call(operation: Operation, value: unknown, timeoutMs = this.#config.operationTimeoutMs): unknown {
    if (this.#closed) throw this.#failure ?? localError('CANCELLED', 'client_closed');
    if (this.#closing && operation !== 'close' && operation !== 'sessionClose') throw localError('CANCELLED', 'client_closed');
    const id = ++this.#sequence;
    const deadline = Math.min(timeoutMs, this.#config.operationTimeoutMs);
    try {
      // No input buffers appear in a transferList: callers retain ownership of their bytes.
      this.#port.postMessage({ id, operation, value, timeoutMs: deadline });
    } catch {
      this.#failure = localError('UNKNOWN', 'worker_unavailable');
      this.#release();
      throw this.#failure;
    }
    return this.#receive(id, deadline, true);
  }

  request(options: SyncRequestOptions): SyncBufferedResponse {
    return response(this.#call('request', request(options, this.#config.maxRequestBytes)));
  }
  tryRequest(options: SyncRequestOptions): Result<SyncBufferedResponse> {
    try { return result(this.#call('tryRequest', request(options, this.#config.maxRequestBytes))); }
    catch (error) {
      return { ok: false, error: isJa3ProxyError(error) ? error : localError('INVALID_REQUEST', 'invalid_input') };
    }
  }
  requestMany(options: readonly SyncRequestOptions[], batch: SyncBatchOptions = {}): Result<SyncBufferedResponse>[] {
    if (!Array.isArray(options) || options.length > this.#config.maxBatchRequests) return invalid();
    const input = object(batch);
    keys(input, ['concurrency', 'maxTotalBytes', 'timeoutMs']);
    const concurrency = integer(input.concurrency, this.#config.maxBatchConcurrency, this.#config.maxBatchConcurrency);
    const maxTotalBytes = integer(input.maxTotalBytes, this.#config.maxBatchBytes, this.#config.maxBatchBytes);
    const timeoutMs = integer(input.timeoutMs, this.#config.operationTimeoutMs, this.#config.operationTimeoutMs);
    let inputBytes = 0;
    const requests = options.map(value => {
      const converted = request(value, this.#config.maxRequestBytes);
      inputBytes += typeof converted.body === 'string' ? Buffer.byteLength(converted.body) : converted.body?.byteLength ?? 0;
      if (inputBytes > this.#config.maxRequestBytes) throw localError('BODY_TOO_LARGE', 'buffer_limit');
      return converted;
    });
    const output = this.#call('requestMany', { requests, concurrency, maxTotalBytes }, timeoutMs);
    if (!Array.isArray(output) || output.length !== requests.length) throw localError('PROTOCOL_ERROR');
    return output.map(result);
  }
  capabilities(): Capabilities { return wire<Capabilities>('capabilities', this.#call('capabilities', null)); }
  requestStatus(requestId: string, partition: string): RequestStatus {
    const output = object(this.#call('requestStatus', { requestId: text(requestId, 128), partition: text(partition, 1024) }));
    if (output.state !== 'queued' && output.state !== 'active' && output.state !== 'complete' && output.state !== 'failed') throw localError('PROTOCOL_ERROR');
    return { state: output.state, diagnostics: wire<Ja3Diagnostics>('diagnostics', output.diagnostics),
      ...(output.error === undefined ? {} : { error: decodeError(output.error) }) };
  }
  cancelRequest(requestId: string, partition: string): void {
    this.#call('cancelRequest', { requestId: text(requestId, 128), partition: text(partition, 1024) });
  }
  createSession(options: SyncSessionOptions & { cookieMode: 'managed' }): SyncManagedSession;
  createSession(options: SyncSessionOptions & { cookieMode: 'external' }): SyncSession;
  createSession(options: SyncSessionOptions): SyncSession | SyncManagedSession;
  createSession(options: SyncSessionOptions): SyncSession | SyncManagedSession {
    const converted = sessionOptions(options);
    const output = object(this.#call('createSession', converted));
    const id = text(output.id, 128);
    const info = wire<ContextInfo>('contextInfo', output.info);
    const invoke = (operation: Operation, value: unknown, timeoutMs?: number) => {
      // A successful parent close already deleted every owned remote context.
      if (operation === 'sessionClose' && this.#cleanupComplete) return { cleanupComplete: true };
      return this.#call(operation, { id, value }, timeoutMs);
    };
    const maxRequestBytes = this.#config.maxRequestBytes;
    const operationTimeoutMs = this.#config.operationTimeoutMs;
    return converted.cookieMode === 'managed'
      ? new RemoteManagedSession(info, invoke, maxRequestBytes, operationTimeoutMs)
      : new RemoteSession(info, invoke, maxRequestBytes, operationTimeoutMs);
  }
  close(options?: CloseOptions): void {
    if (this.#closed) return;
    const converted = closeOptions(options, this.#config.operationTimeoutMs);
    this.#closing = true;
    this.#call('close', converted, converted.timeoutMs);
    this.#cleanupComplete = true;
    this.#release();
  }
  [Symbol.dispose](): void { this.close(); }
}

type Invoke = (operation: Operation, value: unknown, timeoutMs?: number) => unknown;
class RemoteSession implements SyncSession {
  #info: ContextInfo;
  #closing = false;
  #closed = false;
  readonly #invoke: Invoke;
  readonly #maxRequestBytes: number;
  readonly #operationTimeoutMs: number;
  constructor(info: ContextInfo, invoke: Invoke, maxRequestBytes: number, operationTimeoutMs: number) {
    this.#info = info; this.#invoke = invoke; this.#maxRequestBytes = maxRequestBytes;
    this.#operationTimeoutMs = operationTimeoutMs;
  }
  get info(): ContextInfo { return structuredClone(this.#info); }
  protected updateInfo(info: unknown): void { this.#info = wire<ContextInfo>('contextInfo', info); }
  protected invoke(operation: Operation, value: unknown, timeoutMs?: number): unknown {
    if (this.#closed) throw localError('CANCELLED', 'client_closed');
    if (this.#closing && operation !== 'sessionClose') throw localError('CANCELLED', 'client_closed');
    const output = object(this.#invoke(operation, value, timeoutMs));
    if (operation === 'sessionClose' && output.cleanupComplete === true) return;
    const outcome = object(output.result);
    this.updateInfo(output.info);
    if (outcome.ok === true) return outcome.value;
    if (outcome.ok === false) throw decodeError(outcome.error);
    throw localError('PROTOCOL_ERROR');
  }
  request(options: SyncSessionRequestOptions): SyncBufferedResponse {
    return response(this.invoke('sessionRequest', sessionRequest(options, this.#maxRequestBytes)));
  }
  tryRequest(options: SyncSessionRequestOptions): Result<SyncBufferedResponse> {
    try { return result(this.invoke('sessionTryRequest', sessionRequest(options, this.#maxRequestBytes))); }
    catch (error) { return { ok: false, error: isJa3ProxyError(error) ? error : localError('INVALID_REQUEST', 'invalid_input') }; }
  }
  close(options?: CloseOptions): void {
    if (this.#closed) return;
    const converted = closeOptions(options, this.#operationTimeoutMs);
    this.#closing = true;
    this.invoke('sessionClose', converted, converted.timeoutMs);
    this.#closed = true;
  }
  [Symbol.dispose](): void { this.close(); }
}
class RemoteManagedSession extends RemoteSession implements SyncManagedSession {
  getCookies(value: string | URL): readonly CookieRecord[] {
    const output = this.invoke('getCookies', url(value));
    if (!Array.isArray(output)) throw localError('PROTOCOL_ERROR');
    return output.map(entry => wire<CookieRecord>('cookieRecord', entry));
  }
  setCookies(value: string | URL, values: readonly string[]): void {
    if (!Array.isArray(values) || values.length > 4096 || values.some(entry => typeof entry !== 'string') ||
        values.reduce((size, entry) => size + Buffer.byteLength(entry), 0) > MAX_METADATA_BYTES) return invalid();
    this.invoke('setCookies', { url: url(value), values: [...values] });
  }
  exportCookies(): CookieSnapshot { return wire<CookieSnapshot>('cookieSnapshot', this.invoke('exportCookies', null)); }
  importCookies(snapshot: CookieSnapshot): void {
    const input = object(snapshot);
    keys(input, ['partitionKey', 'cookies']);
    if (!Array.isArray(input.cookies) || input.cookies.length > 4096) return invalid();
    let bytes = 0;
    const cookies = input.cookies.map((value: unknown) => {
      const cookie = object(value);
      keys(cookie, ['name', 'value', 'domain', 'path', 'secure', 'httpOnly', 'hostOnly', 'partitioned', 'sameSite', 'expiresAtMs']);
      for (const field of Object.values(cookie)) {
        if (field !== undefined && typeof field !== 'string' && typeof field !== 'boolean' && typeof field !== 'number') return invalid();
        if (typeof field === 'string') bytes += Buffer.byteLength(field);
      }
      if (bytes > MAX_METADATA_BYTES) throw localError('BODY_TOO_LARGE', 'buffer_limit');
      return wire<CookieRecord>('cookieRecord', { ...cookie });
    });
    this.invoke('importCookies', wire<CookieSnapshot>('cookieSnapshot', { partitionKey: text(input.partitionKey, 1024), cookies }));
  }
  rebindIdentity(value: Ja3BrowserIdentity): RebindOutcome {
    const output = object(this.invoke('rebindIdentity', identity(value)));
    const outcome = object(output.outcome);
    const previousContextId = text(outcome.previousContextId, 256);
    const contextId = text(outcome.contextId, 256);
    this.updateInfo(output.info);
    if (outcome.state === 'committed') return { state: 'committed', previousContextId, contextId };
    if (outcome.state === 'committed_cleanup_pending') return { state: 'committed_cleanup_pending', previousContextId, contextId, cleanupError: decodeError(outcome.cleanupError) };
    throw localError('PROTOCOL_ERROR');
  }
}
