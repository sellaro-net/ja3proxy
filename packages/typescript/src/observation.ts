import type { ExchangeObservation, ExchangeObserver, ExchangeOutcome, ExchangeStart, ResponseMetadata } from './types.js';

function ignore(value: unknown): void {
  // Even accidentally async callbacks cannot create unhandled rejections.
  try { void Promise.resolve(value).catch(() => undefined); } catch { /* Observation is best effort. */ }
}
export class Observation {
  private readonly observations: ExchangeObservation[] = [];
  private finished = false;
  constructor(start: ExchangeStart, observers: readonly (ExchangeObserver | undefined)[]) {
    for (const observer of new Set(observers)) {
      if (!observer) continue;
      try {
        const snapshot = structuredClone(start);
        if (snapshot.connection?.egress.mode === 'proxy') {
          const url = new URL(snapshot.connection.egress.url);
          url.username = '';
          url.password = '';
          snapshot.connection.egress.url = url.toString();
        }
        const observation = observer(snapshot);
        if (observation && typeof observation === 'object') { ignore(observation); this.observations.push(observation); }
      } catch { /* Observation is isolated from the request. */ }
    }
  }
  run<T>(operation: () => Promise<T>): Promise<T> {
    const invoke = (index: number): Promise<T> => {
      const observation = this.observations[index];
      if (!observation) return Promise.resolve().then(operation);
      let result: Promise<T> | undefined;
      const once = () => result ??= invoke(index + 1);
      try { if (observation.run) ignore(observation.run(once)); } catch { /* The operation, not the hook, owns the outcome. */ }
      return once();
    };
    return invoke(0);
  }
  requestChunk(chunk: Uint8Array): void {
    for (const observation of this.observations) { try { if (observation.requestChunk) ignore(observation.requestChunk(new Uint8Array(chunk))); } catch { /* Observer isolation. */ } }
  }
  responseHeaders(metadata: ResponseMetadata): void {
    for (const observation of this.observations) { try { if (observation.responseHeaders) ignore(observation.responseHeaders(structuredClone(metadata))); } catch { /* Observer isolation. */ } }
  }
  responseChunk(chunk: Uint8Array): void {
    for (const observation of this.observations) { try { if (observation.responseChunk) ignore(observation.responseChunk(new Uint8Array(chunk))); } catch { /* Observer isolation. */ } }
  }
  finish(outcome: ExchangeOutcome): void {
    if (this.finished) return;
    this.finished = true;
    for (const observation of this.observations) {
      try {
        if (observation.finish) ignore(observation.finish({ diagnostics: { ...outcome.diagnostics }, ...(outcome.error ? { error: outcome.error } : {}), ...(outcome.metadata ? { metadata: structuredClone(outcome.metadata) } : {}) }));
      } catch { /* Observer isolation. */ }
    }
    this.observations.length = 0;
  }
}
