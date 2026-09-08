import type { Ja3Diagnostics, Ja3Delivery, Ja3ErrorCode, Ja3ProxyFailureKind } from './types.js';

const messages: Record<Ja3ErrorCode, string> = {
  UNAUTHORIZED: 'Die JA3Proxy-Dienstanmeldung fehlt oder ist ungültig.',
  INVALID_REQUEST: 'Die JA3Proxy-Anfrage ist ungültig.',
  UNSUPPORTED_CAPABILITY: 'Der JA3Proxy-Dienst unterstützt den erforderlichen Transport nicht.',
  INVALID_PROFILE: 'Das gewählte Browserprofil wird nicht unterstützt.',
  EGRESS_REQUIRED: 'Ein ausdrücklicher Netzwerkausgang ist erforderlich.',
  SSRF_BLOCKED: 'Das Netzwerkziel ist nicht zulässig.',
  BODY_TOO_LARGE: 'Die Übertragung überschreitet die erlaubte Größe.',
  BUSY: 'Der JA3Proxy-Dienst ist ausgelastet.',
  TIMEOUT: 'Die JA3Proxy-Anfrage hat das Zeitlimit überschritten.',
  CANCELLED: 'Die JA3Proxy-Anfrage wurde abgebrochen.',
  DNS_ERROR: 'Der Netzwerkname konnte nicht aufgelöst werden.',
  PROXY_ERROR: 'Die Verbindung über den konfigurierten Proxy ist fehlgeschlagen.',
  TLS_ERROR: 'Die verschlüsselte Verbindung ist fehlgeschlagen.',
  CONNECT_ERROR: 'Die Netzwerkverbindung konnte nicht hergestellt werden.',
  PROTOCOL_ERROR: 'Der JA3Proxy-Dienst hat eine ungültige Übertragung geliefert.',
  CONTEXT_NOT_FOUND: 'Die Transportsitzung ist nicht mehr verfügbar. Eine neue Sitzung muss ausdrücklich geöffnet werden.',
  CONTEXT_CONFLICT: 'Der Zustand der Transportsitzung wurde gleichzeitig verändert.',
  CONTEXT_LIMIT: 'Die erlaubte Anzahl von Transportsitzungen ist erreicht.',
  COOKIE_LIMIT: 'Der erlaubte Cookie-Speicher ist ausgeschöpft.',
  DUPLICATE_REQUEST: 'Diese Anfragekennung wurde bereits verwendet.',
  UNKNOWN: 'Die JA3Proxy-Anfrage ist fehlgeschlagen.',
};
/** Keep only documented diagnostic scalars; unknown wire fields are never retained. */
export function copyDiagnostics(value: Ja3Diagnostics): Ja3Diagnostics {
  return {
    requestId: value.requestId, attempt: value.attempt, phase: value.phase, delivery: value.delivery,
    queueMs: value.queueMs, headersMs: value.headersMs, bodyMs: value.bodyMs, totalMs: value.totalMs,
    requestBytes: value.requestBytes, responseBytes: value.responseBytes, tlsProfile: value.tlsProfile,
    ...(value.traceId === undefined ? {} : { traceId: value.traceId }),
    ...(value.clientReused === undefined ? {} : { clientReused: value.clientReused }),
    ...(value.contextId === undefined ? {} : { contextId: value.contextId }),
    ...(value.cookieRevision === undefined ? {} : { cookieRevision: value.cookieRevision }),
  };
}
export class Ja3ProxyTransportError extends Error {
  readonly code: Ja3ErrorCode;
  readonly kind: Ja3ProxyFailureKind;
  readonly diagnostics: Ja3Diagnostics;
  readonly delivery: Ja3Delivery;
  readonly usedProxy: boolean;
  constructor(code: Ja3ErrorCode, diagnostics: Ja3Diagnostics, usedProxy = false, kind?: Ja3ProxyFailureKind) {
    super(messages[code]);
    this.name = 'Ja3ProxyTransportError';
    this.code = code;
    this.diagnostics = Object.freeze(copyDiagnostics(diagnostics));
    this.delivery = diagnostics.delivery;
    this.usedProxy = usedProxy;
    this.kind = kind ?? (code === 'PROXY_ERROR' ? 'proxy_unreachable' : diagnostics.delivery === 'response_started' ? 'connection_lost' : 'unknown');
    Object.freeze(this);
  }
}
export function isJa3ProxyError(value: unknown): value is Ja3ProxyTransportError { return value instanceof Ja3ProxyTransportError; }
export function initialDiagnostics(requestId = 'local', attempt = 0, tlsProfile = 'unknown'): Ja3Diagnostics {
  return {
    requestId: /^[A-Za-z0-9_.:-]{1,128}$/.test(requestId) ? requestId : 'local',
    attempt: Number.isSafeInteger(attempt) && attempt >= 0 ? attempt : 0,
    tlsProfile: /^[a-z0-9_.]{1,64}$/.test(tlsProfile) ? tlsProfile : 'unknown',
    phase: 'preparing', delivery: 'not_started', queueMs: 0, headersMs: null, bodyMs: null,
    totalMs: 0, requestBytes: 0, responseBytes: 0,
  };
}
export function localError(code: Ja3ErrorCode, kind?: Ja3ProxyFailureKind): Ja3ProxyTransportError {
  return new Ja3ProxyTransportError(code, initialDiagnostics(), false, kind);
}
export function safeError(error: unknown, fallback = initialDiagnostics(), usedProxy = false): Ja3ProxyTransportError {
  return isJa3ProxyError(error) ? error : new Ja3ProxyTransportError('UNKNOWN', fallback, usedProxy);
}
