import type { ExchangeObservation, ExchangeObserver, ExchangeOutcome, ExchangeReferences, ExchangeStart, ResponseMetadata } from './types.js';

const MAX_REFERENCES = 16;
const referenceKey = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const controlCharacter = /\p{Cc}/u;

function ignore(value: unknown): void {
  // Even accidentally async callbacks cannot create unhandled rejections.
  try { void Promise.resolve(value).catch(() => undefined); } catch { /* Observation is best effort. */ }
}
/** Copies a valid, non-empty reference set once; any invalid entry drops the whole set. */
function copyReferences(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.length > MAX_REFERENCES) return undefined;
  for (const [key, text] of entries) {
    if (!referenceKey.test(key) || typeof text !== 'string' || text.length === 0 || text.length > 256 || controlCharacter.test(text)) return undefined;
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
export class Observation {
  private readonly observations: ExchangeObservation[] = [];
  private finished = false;
  /** Frozen snapshot taken when the observers returned; later observer sets win on equal keys. */
  readonly references: ExchangeReferences | undefined;
  constructor(start: ExchangeStart, observers: readonly (ExchangeObserver | undefined)[]) {
    let references: Record<string, string> | undefined;
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
        if (observation && typeof observation === 'object') {
          ignore(observation);
          this.observations.push(observation);
          const supplied = copyReferences(observation.references);
          const merged = supplied && { ...references, ...supplied };
          // A set that would exceed the bound is dropped, like any other invalid set.
          if (merged && Object.keys(merged).length <= MAX_REFERENCES) references = merged;
        }
      } catch { /* Observation is isolated from the request. */ }
    }
    this.references = references && Object.freeze(references);
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
