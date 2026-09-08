import { initialDiagnostics, Ja3ProxyTransportError, localError } from './errors.js';
import { nonnegativeInteger, positive } from './protocol.js';
import type { CloseOptions, Ja3Diagnostics } from './types.js';

export const MAX_TIMEOUT_MS = 2_147_483_647;
export function timeoutValue(value: number): number {
  if (!positive(value) || value > MAX_TIMEOUT_MS) throw localError('INVALID_REQUEST', 'invalid_input');
  return value;
}
export class Deadline {
  readonly controller = new AbortController();
  readonly started = performance.now();
  readonly signal = this.controller.signal;
  private readonly timer: NodeJS.Timeout;
  private readonly onAbort: () => void;
  timedOut = false;
  constructor(readonly timeoutMs: number, private readonly parent?: AbortSignal) {
    timeoutValue(timeoutMs);
    this.onAbort = () => {
      this.timedOut = parent?.reason instanceof DOMException && parent.reason.name === 'TimeoutError';
      this.controller.abort(this.timedOut ? new DOMException('Das Zeitlimit wurde überschritten.', 'TimeoutError') : parent?.reason instanceof Ja3ProxyTransportError ? parent.reason : undefined);
    };
    this.timer = setTimeout(() => { this.timedOut = true; this.controller.abort(new DOMException('Das Zeitlimit wurde überschritten.', 'TimeoutError')); }, timeoutMs);
    if (parent?.aborted) this.onAbort();
    else parent?.addEventListener('abort', this.onAbort, { once: true });
  }
  dispose(): void { clearTimeout(this.timer); this.parent?.removeEventListener('abort', this.onAbort); }
  remaining(): number { return Math.max(1, Math.floor(this.timeoutMs - (performance.now() - this.started))); }
  error(diag = initialDiagnostics(), usedProxy = false): Ja3ProxyTransportError {
    const reason: unknown = this.signal.reason;
    return new Ja3ProxyTransportError(this.timedOut ? 'TIMEOUT' : 'CANCELLED', { ...diag, totalMs: Math.floor(performance.now() - this.started) }, usedProxy, reason instanceof Ja3ProxyTransportError ? reason.kind : undefined);
  }
  async race<T>(promise: Promise<T>, diag = initialDiagnostics(), usedProxy = false): Promise<T> {
    if (this.signal.aborted) { void promise.catch(() => undefined); throw this.error(diag, usedProxy); }
    const aborted = Promise.withResolvers<never>();
    const listener = () => aborted.reject(this.error(diag, usedProxy));
    this.signal.addEventListener('abort', listener, { once: true });
    try { return await Promise.race([promise, aborted.promise]); }
    finally { this.signal.removeEventListener('abort', listener); }
  }
}
export interface Operation { deadline: Deadline; done(): void; settled: Promise<void> }
export class Lifetime {
  private readonly operations = new Set<Operation>();
  private closing: Promise<void> | undefined;
  closed = false;
  assertOpen(): void { if (this.closed) throw localError('CANCELLED', 'client_closed'); }
  stopAccepting(): void { this.closed = true; }
  begin(timeoutMs: number, signal?: AbortSignal): Operation {
    this.assertOpen();
    return this.register(new Deadline(timeoutMs, signal), true);
  }
  track(deadline: Deadline, alreadyAccepted = false): Operation {
    if (!alreadyAccepted) this.assertOpen();
    return this.register(deadline, false);
  }
  private register(deadline: Deadline, ownsDeadline: boolean): Operation {
    const { promise: settled, resolve } = Promise.withResolvers<void>();
    const operation: Operation = {
      deadline, settled,
      done: () => {
        if (!this.operations.delete(operation)) return;
        if (ownsDeadline) deadline.dispose();
        resolve();
      },
    };
    this.operations.add(operation);
    return operation;
  }
  close(options: CloseOptions = {}): Promise<void> {
    if (this.closing) return this.closing;
    const timeoutMs = timeoutValue(options.timeoutMs ?? 10_000);
    if (options.drain !== undefined && typeof options.drain !== 'boolean') throw localError('INVALID_REQUEST', 'invalid_input');
    this.closed = true;
    this.closing = (async () => {
      const pending = Promise.all(Array.from(this.operations, operation => operation.settled));
      if (options.drain) {
        const elapsed = Promise.withResolvers<void>();
        const timer = setTimeout(elapsed.resolve, timeoutMs);
        await Promise.race([pending, elapsed.promise]);
        clearTimeout(timer);
      }
      for (const operation of this.operations) operation.deadline.controller.abort(localError('CANCELLED', 'client_closed'));
      await pending;
    })();
    return this.closing;
  }
}
interface AdmissionLimits { maxConcurrent: number; maxConcurrentPerPartition: number; maxQueued: number; maxQueuedPerPartition: number }
interface Waiting {
  partition: string; deadline: Deadline; diag: Ja3Diagnostics; usedProxy: boolean;
  resolve: (release: () => void) => void; reject: (error: Ja3ProxyTransportError) => void; abort: () => void;
}
/** Bounded FIFO among eligible partitions; a saturated partition cannot block another. */
export class Admission {
  private active = 0;
  private readonly byPartition = new Map<string, number>();
  private readonly queuedByPartition = new Map<string, number>();
  private readonly waiting = new Set<Waiting>();
  private reserved = 0;
  private readonly reservedByPartition = new Map<string, number>();
  constructor(private limits: AdmissionLimits) {
    if (!positive(limits.maxConcurrent) || !positive(limits.maxConcurrentPerPartition) || !nonnegativeInteger(limits.maxQueued) || !nonnegativeInteger(limits.maxQueuedPerPartition)) throw localError('INVALID_REQUEST', 'invalid_input');
  }
  constrain(limits: AdmissionLimits): void {
    this.limits = {
      maxConcurrent: Math.min(this.limits.maxConcurrent, limits.maxConcurrent),
      maxConcurrentPerPartition: Math.min(this.limits.maxConcurrentPerPartition, limits.maxConcurrentPerPartition),
      maxQueued: Math.min(this.limits.maxQueued, limits.maxQueued),
      maxQueuedPerPartition: Math.min(this.limits.maxQueuedPerPartition, limits.maxQueuedPerPartition),
    };
  }
  /** Bound discovery too, before negotiated transport admission can be applied. */
  reserve(partition: string, diag: Ja3Diagnostics, usedProxy: boolean): () => void {
    const partitionCount = this.reservedByPartition.get(partition) ?? 0;
    if (this.reserved >= this.limits.maxConcurrent + this.limits.maxQueued ||
      partitionCount >= this.limits.maxConcurrentPerPartition + this.limits.maxQueuedPerPartition) {
      throw new Ja3ProxyTransportError('BUSY', { ...diag, phase: 'queued' }, usedProxy, 'queue_full');
    }
    this.reserved++;
    this.reservedByPartition.set(partition, partitionCount + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.reserved--;
      const remaining = this.reservedByPartition.get(partition)! - 1;
      if (remaining === 0) this.reservedByPartition.delete(partition);
      else this.reservedByPartition.set(partition, remaining);
    };
  }
  acquire(partition: string, deadline: Deadline, diag = initialDiagnostics(), usedProxy = false): Promise<() => void> {
    if (deadline.signal.aborted) return Promise.reject(deadline.error(diag, usedProxy));
    if (this.available(partition) && !this.queuedByPartition.has(partition)) return Promise.resolve(this.occupy(partition));
    if (this.waiting.size >= this.limits.maxQueued || (this.queuedByPartition.get(partition) ?? 0) >= this.limits.maxQueuedPerPartition) {
      return Promise.reject(new Ja3ProxyTransportError('BUSY', { ...diag, phase: 'queued' }, usedProxy, 'queue_full'));
    }
    const { promise, resolve, reject } = Promise.withResolvers<() => void>();
    const item: Waiting = {
      partition, deadline, diag, usedProxy, resolve, reject,
      abort: () => {
        if (!this.remove(item)) return;
        reject(deadline.error({ ...diag, phase: 'queued' }, usedProxy));
        this.dispatch();
      },
    };
    this.waiting.add(item);
    this.queuedByPartition.set(partition, (this.queuedByPartition.get(partition) ?? 0) + 1);
    deadline.signal.addEventListener('abort', item.abort, { once: true });
    return promise;
  }
  private available(partition: string): boolean { return this.active < this.limits.maxConcurrent && (this.byPartition.get(partition) ?? 0) < this.limits.maxConcurrentPerPartition; }
  private occupy(partition: string): () => void {
    this.active++;
    this.byPartition.set(partition, (this.byPartition.get(partition) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      const remaining = this.byPartition.get(partition)! - 1;
      if (remaining === 0) this.byPartition.delete(partition); else this.byPartition.set(partition, remaining);
      this.dispatch();
    };
  }
  private remove(item: Waiting): boolean {
    if (!this.waiting.delete(item)) return false;
    item.deadline.signal.removeEventListener('abort', item.abort);
    const remaining = this.queuedByPartition.get(item.partition)! - 1;
    if (remaining === 0) this.queuedByPartition.delete(item.partition); else this.queuedByPartition.set(item.partition, remaining);
    return true;
  }
  private dispatch(): void {
    for (const item of this.waiting) {
      if (!this.available(item.partition)) continue;
      this.remove(item);
      if (item.deadline.signal.aborted) item.reject(item.deadline.error(item.diag, item.usedProxy));
      else item.resolve(this.occupy(item.partition));
    }
  }
}

/** Tracks only SDK-retained buffered bodies, never caller-owned completed responses. */
export class BufferBudget {
  private retained = 0;
  constructor(private readonly limit: number) { if (!positive(limit)) throw localError('INVALID_REQUEST', 'invalid_input'); }
  reserve(bytes: number, diag: Ja3Diagnostics, usedProxy: boolean): void {
    if (this.retained + bytes > this.limit) throw new Ja3ProxyTransportError('BODY_TOO_LARGE', diag, usedProxy, 'buffer_limit');
    this.retained += bytes;
  }
  release(bytes: number): void { this.retained -= bytes; }
}
