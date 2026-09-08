import { MessagePort, workerData } from 'node:worker_threads';
import { Ja3ProxyClient, Ja3ProxyTransportError } from '@sellaro/ja3proxy';
import { initialDiagnostics } from '../errors.js';
import type {
  CloseOptions, ContextInfo, CookieSnapshot, ExternalSession,
  ManagedSession, StreamingResponse,
} from '../types.js';
import {
  config, encodeError, identity, integer, invalid, localError, object, operations, plainResponse,
  request, sessionOptions, sessionRequest, text, uncertainError, url, wire,
} from './ipc.js';
import type { BridgeConfig, Command, Operation, PlainResponse, SerializedError } from './ipc.js';
import type { SyncRequestOptions } from './types.js';

type BatchResult = { ok: true; value: PlainResponse } | { ok: false; error: SerializedError };
interface OwnedSession { session: ExternalSession | ManagedSession; managed: boolean }
interface SessionReply { id: string; info: ContextInfo }

const data = object(workerData);
if (!(data.port instanceof MessagePort) || !(data.signal instanceof SharedArrayBuffer) || data.signal.byteLength !== 8) invalid();
const port = data.port;
const signal = new Int32Array(data.signal);
let activeId = 0;
let stopped = false;
let busy = false;
let client: Ja3ProxyClient;
let settings: BridgeConfig;
const sessions = new Map<string, OwnedSession>();
let sessionSequence = 0;

function reply(id: number, ok: boolean, value: unknown): void {
  port.postMessage(ok ? { id, ok, value } : { id, ok, error: encodeError(value) });
  Atomics.add(signal, 0, 1);
  Atomics.notify(signal, 0);
}
function stop(): void {
  if (stopped) return;
  stopped = true;
  Atomics.store(signal, 1, 2);
  Atomics.add(signal, 0, 1);
  Atomics.notify(signal, 0);
  port.close();
}
function fatal(): void {
  if (stopped) return;
  try { reply(activeId, false, uncertainError('UNKNOWN')); } finally { stop(); process.exitCode = 1; }
  // The parent owns termination; no arbitrary exception text crosses IPC or stderr.
}
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
port.on('messageerror', fatal);
try {
  const raw = object(data.config);
  settings = config({ ...object(raw.client), startupTimeoutMs: raw.startupTimeoutMs,
    operationTimeoutMs: raw.operationTimeoutMs, maxRequestBytes: raw.maxRequestBytes,
    maxBatchRequests: raw.maxBatchRequests, maxBatchBytes: raw.maxBatchBytes,
    maxBatchConcurrency: raw.maxBatchConcurrency });
  client = new Ja3ProxyClient(settings.client);
  Atomics.store(signal, 1, 1);
  reply(0, true, null);
} catch (error) {
  reply(0, false, error);
  stop();
}

function command(value: unknown): Command {
  const input = object(value);
  const operation = operations.find(operation => operation === input.operation);
  if (operation === undefined) return invalid();
  return { id: integer(input.id, 0), timeoutMs: integer(input.timeoutMs, 0, settings.operationTimeoutMs), operation, value: input.value };
}
function owned(value: unknown): { entry: OwnedSession; id: string; value: unknown } {
  const input = object(value);
  const id = text(input.id, 128);
  const entry = sessions.get(id);
  if (entry === undefined) throw localError('CONTEXT_NOT_FOUND');
  return { entry, id, value: input.value };
}
function managed(entry: OwnedSession): ManagedSession {
  if (!entry.managed || !('getCookies' in entry.session)) throw localError('INVALID_REQUEST', 'invalid_input');
  return entry.session;
}
function closeSettings(value: unknown): CloseOptions {
  const input = object(value);
  if (input.drain !== undefined && typeof input.drain !== 'boolean') return invalid();
  return { ...(input.drain === undefined ? {} : { drain: input.drain }),
    timeoutMs: Math.min(integer(input.timeoutMs, settings.operationTimeoutMs), settings.operationTimeoutMs) };
}

/** Reuse the async core with separate payload-total and assembly working-memory budgets. */
async function batch(value: unknown, abort: AbortSignal): Promise<BatchResult[]> {
  const input = object(value);
  if (!Array.isArray(input.requests) || input.requests.length > settings.maxBatchRequests) return invalid();
  const requests = input.requests.map((entry: unknown) => request(entry, settings.maxRequestBytes));
  const concurrency = integer(input.concurrency, 1, settings.maxBatchConcurrency);
  const maxTotalBytes = integer(input.maxTotalBytes, 1, settings.maxBatchBytes);
  const maxWorkingBytes = 2 * maxTotalBytes;
  const output: BatchResult[] = new Array(requests.length);
  let next = 0;
  let payloadBytes = 0;
  let workingBytes = 0;
  async function execute(options: SyncRequestOptions): Promise<BatchResult> {
    let stream: StreamingResponse | undefined;
    let bytes = 0;
    let reservedWorkingBytes = 0;
    let diagnostics = initialDiagnostics(options.requestId, options.attempt, options.connection?.identity.tlsProfile);
    try {
      stream = await client.stream({ ...options, signal: abort });
      diagnostics = stream.metadata.diagnostics;
      const chunks: Uint8Array[] = [];
      const reader = stream.body.getReader();
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (payloadBytes + chunk.value.byteLength > maxTotalBytes || workingBytes + chunk.value.byteLength > maxWorkingBytes) {
            throw new Ja3ProxyTransportError('BODY_TOO_LARGE', { ...diagnostics, phase: 'body', delivery: 'response_started', responseBytes: bytes }, options.connection?.egress.mode === 'proxy', 'buffer_limit');
          }
          payloadBytes += chunk.value.byteLength;
          workingBytes += chunk.value.byteLength;
          reservedWorkingBytes += chunk.value.byteLength;
          bytes += chunk.value.byteLength;
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      const completion = await stream.completion;
      if (!completion.ok) throw completion.error;
      let body = chunks.length === 1 ? chunks[0] : undefined;
      if (body === undefined || body.buffer instanceof SharedArrayBuffer || body.byteOffset !== 0 || body.byteLength !== body.buffer.byteLength) {
        if (workingBytes + bytes > maxWorkingBytes) {
          throw new Ja3ProxyTransportError('BODY_TOO_LARGE', completion.value, options.connection?.egress.mode === 'proxy', 'buffer_limit');
        }
        // Reserve the assembly allocation while source chunks still remain live.
        workingBytes += bytes;
        reservedWorkingBytes += bytes;
        body = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        chunks.length = 0;
        workingBytes -= bytes;
        reservedWorkingBytes -= bytes;
      }
      const headers: Record<string, string[]> = Object.create(null);
      for (const [name, entry] of stream.metadata.headers) (headers[name.toLowerCase()] ??= []).push(entry);
      return { ok: true, value: { status: stream.metadata.status, headers, body, diagnostics: completion.value, elapsed: completion.value.totalMs } };
    } catch (error) {
      payloadBytes -= bytes;
      workingBytes -= reservedWorkingBytes;
      return { ok: false, error: encodeError(error) };
    } finally {
      // close also settles completion and cancels a failed/oversized body before the lane is reused.
      if (stream !== undefined) await stream.close();
    }
  }
  async function lane(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= requests.length) return;
      const options = requests[index];
      if (options === undefined) return invalid();
      if (abort.aborted) output[index] = { ok: false, error: encodeError(uncertainError('TIMEOUT')) };
      else output[index] = await execute(options);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, () => lane()));
  return output;
}

async function dispatch(operation: Operation, value: unknown, abort: AbortSignal): Promise<unknown> {
  switch (operation) {
    case 'request': return plainResponse(await client.request({ ...request(value, settings.maxRequestBytes), signal: abort }));
    case 'tryRequest': {
      const result = await client.tryRequest({ ...request(value, settings.maxRequestBytes), signal: abort });
      return result.ok ? { ok: true, value: plainResponse(result.value) } : { ok: false, error: encodeError(result.error) };
    }
    case 'requestMany': return batch(value, abort);
    case 'capabilities': return client.capabilities(abort);
    case 'requestStatus': {
      const input = object(value);
      const status = await client.requestStatus(text(input.requestId, 128), text(input.partition, 1024), abort);
      return { state: status.state, diagnostics: status.diagnostics,
        ...(status.error === undefined ? {} : { error: encodeError(status.error) }) };
    }
    case 'cancelRequest': {
      const input = object(value);
      await client.cancelRequest(text(input.requestId, 128), text(input.partition, 1024), abort);
      return null;
    }
    case 'createSession': {
      const options = sessionOptions(value);
      const session = options.cookieMode === 'managed'
        ? await client.createSession({ ...options, signal: abort })
        : await client.createSession({ ...options, signal: abort });
      const id = String(++sessionSequence);
      sessions.set(id, { session, managed: options.cookieMode === 'managed' });
      const output: SessionReply = { id, info: session.info };
      return output;
    }
    case 'close':
      await client.close(closeSettings(value));
      sessions.clear();
      return null;
    default: {
      const { entry, id, value: input } = owned(value);
      const execute = async (): Promise<unknown> => {
      switch (operation) {
        case 'sessionRequest': return plainResponse(await entry.session.request({ ...sessionRequest(input, settings.maxRequestBytes), signal: abort }));
        case 'sessionTryRequest':
          try { return { ok: true, value: plainResponse(await entry.session.request({ ...sessionRequest(input, settings.maxRequestBytes), signal: abort })) }; }
          catch (error) { return { ok: false, error: encodeError(error) }; }
        case 'sessionClose': {
          const options = closeSettings(input);
          await entry.session.close(options);
          sessions.delete(id);
          return null;
        }
        case 'getCookies': return managed(entry).getCookies(url(input), abort);
        case 'setCookies': {
          const cookies = object(input);
          if (!Array.isArray(cookies.values) || !cookies.values.every((entry: unknown) => typeof entry === 'string')) return invalid();
          await managed(entry).setCookies(url(cookies.url), cookies.values, abort);
          return null;
        }
        case 'exportCookies': return managed(entry).exportCookies(abort);
        case 'importCookies':
          await managed(entry).importCookies(wire<CookieSnapshot>('cookieSnapshot', input), abort);
          return null;
        case 'rebindIdentity': {
          const session = managed(entry);
          const outcome = await session.rebindIdentity(identity(input), abort);
          return { info: session.info, outcome: outcome.state === 'committed' ? outcome :
            { state: outcome.state, contextId: outcome.contextId, previousContextId: outcome.previousContextId, cleanupError: encodeError(outcome.cleanupError) } };
        }
      }
      };
      try {
        const result = await execute();
        return { info: entry.session.info, result: { ok: true, value: result } };
      }
      catch (error) { return { info: entry.session.info, result: { ok: false, error: encodeError(error) } }; }
    }
  }
}

port.on('message', (value: unknown) => {
  if (stopped) return;
  if (busy) { fatal(); return; }
  let input: Command;
  try { input = command(value); }
  catch { fatal(); return; }
  busy = true;
  activeId = input.id;
  const abort = new AbortController();
  // Worker timers may abort the async core. The parent's hard deadline never depends on them.
  const timer = setTimeout(() => abort.abort(localError('TIMEOUT')), input.timeoutMs);
  void dispatch(input.operation, input.value, abort.signal).then(
    result => {
      reply(input.id, true, result);
      if (input.operation === 'close') stop();
    },
    error => reply(input.id, false, error),
  ).catch(fatal).finally(() => {
    clearTimeout(timer);
    busy = false;
  });
});
