import { Admission, Deadline, Lifetime } from './concurrency.js';
import { localError, safeError } from './errors.js';
import { validatePartition } from './service.js';
import type { SessionHandle } from './sessions.js';
import type { ExchangeObservation, ExchangeObserver, ExchangeStart, ExternalSessionOptions, FetchObserver, FetchOptions, Ja3Diagnostics, RequestOptions, Result, ScopedFetch, SessionRequestOptions, StreamingResponse } from './types.js';

const completions = new WeakMap<Response, Promise<Result<Ja3Diagnostics>>>();
export function getResponseCompletion(response: Response): Promise<Result<Ja3Diagnostics>> | undefined { return completions.get(response); }
function attachCompletion(response: Response, completion: Promise<Result<Ja3Diagnostics>>, url: string): Response {
  completions.set(response, completion);
  Object.defineProperty(response, 'url', { value: url, configurable: true });
  Object.defineProperty(response, 'clone', {
    configurable: true,
    value: () => attachCompletion(Response.prototype.clone.call(response), completion, url),
  });
  return response;
}
export function resolveFetchObserver(observer: FetchObserver, init?: RequestInit): ExchangeObserver;
export function resolveFetchObserver(observer: FetchObserver | undefined, init?: RequestInit): ExchangeObserver | undefined;
export function resolveFetchObserver(observer: FetchObserver | undefined, init?: RequestInit): ExchangeObserver | undefined {
  if (!observer) return undefined;
  return (start: ExchangeStart): ExchangeObservation | void => {
    // Both public callbacks are functions. The URL also carries ExchangeStart fields,
    // so direct observers and URL resolvers are invoked once without probing effects.
    const input = Object.assign(new URL(start.url), start);
    const result = observer(input, init);
    if (typeof result === 'function') return result(start);
    return result;
  };
}
interface ResponseOptions { timeoutMs?: number; maxResponseBytes?: number; attempt?: number; observer?: FetchObserver | undefined }
export async function fetchResponse(input: string | URL | Request, init: RequestInit | undefined, execute: (request: SessionRequestOptions) => Promise<StreamingResponse>, options: ResponseOptions): Promise<Response> {
  let request: Request;
  try {
    const requestInit: RequestInit & { duplex?: 'half' } = { ...init, ...(init?.body instanceof ReadableStream || (input instanceof Request && input.body !== null) ? { duplex: 'half' as const } : {}) };
    request = new Request(input, requestInit);
  } catch { throw localError('INVALID_REQUEST', 'invalid_input'); }
  let exchange: StreamingResponse | undefined;
  try {
    exchange = await execute({ url: request.url, method: request.method, headers: request.headers, body: request.body, signal: request.signal, ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }), ...(options.maxResponseBytes === undefined ? {} : { maxResponseBytes: options.maxResponseBytes }), ...(options.attempt === undefined ? {} : { attempt: options.attempt }), ...(options.observer ? { observer: resolveFetchObserver(options.observer, init) } : {}) });
    const noBody = request.method === 'HEAD' || [204, 205, 304].includes(exchange.metadata.status);
    if (noBody) {
      const reader = exchange.body.getReader();
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          if (next.value.length !== 0) throw localError('PROTOCOL_ERROR');
        }
      } finally { reader.releaseLock(); }
      const result = await exchange.completion;
      if (!result.ok) throw result.error;
    }
    const response = new Response(noBody ? null : exchange.body, { status: exchange.metadata.status, headers: exchange.metadata.headers });
    return attachCompletion(response, exchange.completion, request.url);
  } catch (error) {
    if (exchange) await exchange.close();
    else if (request.body && !request.body.locked) void request.body.cancel().catch(() => undefined);
    throw safeError(error);
  }
}
export interface FetchHost {
  assertOpen(): void;
  stream(options: RequestOptions, deadline?: Deadline): Promise<StreamingResponse>;
  createSession(options: ExternalSessionOptions): Promise<SessionHandle>;
  defaultTimeoutMs: number;
  maxResponseBytes: number;
}
export function createScopedFetch(host: FetchHost, options: FetchOptions, onClose: () => void): ScopedFetch {
  validatePartition(options.partition);
  if (options.context !== undefined && options.context !== 'stateless' && options.context !== 'session') throw localError('INVALID_REQUEST', 'invalid_input');
  const settings = { ...options, timeoutMs: options.timeoutMs ?? host.defaultTimeoutMs, maxResponseBytes: options.maxResponseBytes ?? host.maxResponseBytes, connection: structuredClone(options.connection) };
  const lifetime = new Lifetime();
  const admission = new Admission({ maxConcurrent: 16, maxConcurrentPerPartition: 16, maxQueued: 128, maxQueuedPerPartition: 128 });
  let session: Promise<SessionHandle> | undefined;
  let closing: Promise<void> | undefined;
  const execute = async (request: SessionRequestOptions): Promise<StreamingResponse> => {
    host.assertOpen();
    const operation = lifetime.begin(request.timeoutMs ?? settings.timeoutMs, request.signal);
    let release: (() => void) | undefined;
    let transferred = false;
    try {
      release = await admission.acquire(settings.partition, operation.deadline);
      let exchange: StreamingResponse;
      if (settings.context === 'session') {
        if (!session) {
          const opening = lifetime.begin(settings.timeoutMs);
          session = host.createSession({ partition: settings.partition, connection: settings.connection, cookieMode: 'external', ...(settings.timeoutMs === undefined ? {} : { timeoutMs: settings.timeoutMs }), ...(settings.maxResponseBytes === undefined ? {} : { maxResponseBytes: settings.maxResponseBytes }), signal: opening.deadline.signal });
          void session.then(() => opening.done(), () => opening.done());
        }
        const current = await operation.deadline.race(session);
        exchange = await current.stream({ ...request, signal: operation.deadline.signal }, operation.deadline);
      } else {
        exchange = await host.stream({ ...request, partition: settings.partition, connection: settings.connection, signal: operation.deadline.signal }, operation.deadline);
      }
      const permit = release;
      void exchange.completion.then(() => { permit?.(); operation.done(); });
      transferred = true;
      return exchange;
    } catch (error) { throw safeError(error); }
    finally { if (!transferred) { release?.(); operation.done(); } }
  };
  const close = (): Promise<void> => {
    if (closing) return closing;
    const stopped = lifetime.close();
    const deadline = new Deadline(10_000);
    closing = (async () => {
      await deadline.race(stopped);
      let current: SessionHandle | undefined;
      if (session) {
        try { current = await deadline.race(session); }
        catch (error) { if (deadline.signal.aborted) throw error; /* An open without a known handle has no local cleanup target. */ }
      }
      if (current) await deadline.race(current.close({ timeoutMs: deadline.remaining() }, deadline));
      onClose();
    })().catch(error => {
      closing = undefined;
      throw error;
    }).finally(() => deadline.dispose());
    return closing;
  };
  return Object.assign((input: string | URL | Request, init?: RequestInit) => {
    lifetime.assertOpen();
    return fetchResponse(input, init, execute, settings);
  }, { close, [Symbol.asyncDispose]: close });
}
