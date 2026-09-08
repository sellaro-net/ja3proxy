# API reference

[Home](../README.md) · [Usage guide](usage.md) · [Configuration](configuration.md)

[Endpoints](#endpoints) · [Requests](#request-metadata) · [Wire format](#wire-format) · [Contexts](#contexts) · [Cookies](#cookies) · [Diagnostics](#diagnostics) · [Errors](#errors)

## Endpoints

All paths are relative to the service root. Every endpoint except `/health`
requires `Authorization: Bearer <JA3_PROXY_TOKEN>`. Unknown paths are authenticated
too. Control requests and responses use JSON; `/request` uses binary framing.

| Method | Path | Purpose | Success |
|---|---|---|---|
| GET | `/health` | Public, non-sensitive liveness | 200 |
| GET | `/capabilities` | Service identity, profiles and operational limits | 200 |
| POST | `/request` | Perform one explicit upstream request | 200 framed stream |
| POST | `/contexts` | Create a scoped connection/cookie context | 201 JSON |
| DELETE | `/contexts/{id}` | Close a context | 204 |
| POST | `/contexts/{id}/cookies` | Select, set, export or import cookies | 200 JSON |
| DELETE | `/requests/{id}` | Cancel queued or active work | 204 |
| POST | `/requests/{id}/status` | Read current or retained terminal status | 200 JSON |

The DELETE endpoints and request-status endpoint take `{ "partition": "demo" }`
as their JSON body. Never place secrets or cookie snapshots in query strings.

### Capabilities

`GET /capabilities` identifies the service with `service: "ja3proxy"` and exposes:

- `build`: the compiled package release identifier.
- `profiles` and `headerDescriptors`: supported profile names and emulated headers.
- `framing`: `contentType`, `maxMetadataBytes`, `maxDataBytes`, `maxUploadFrames`.
- `limits`: raw upload/decoded response sizes, timeouts, headers, concurrency,
  queues, envelope readers, contexts, cookies and request-registry retention.
- `modes`: supported `egress`, `cookies`, `stream` and `cancel` operations.

Validate the service identity, media type and capabilities your client actually
needs. Do not assume the defaults in the configuration guide are the limits of
a particular running instance.

## Request metadata

The first request frame contains this JSON shape:

```json
{
  "requestId": "a-unique-request-id",
  "partition": "demo",
  "connection": {
    "egress": { "mode": "direct" },
    "identity": { "tlsProfile": "chrome_149", "emulateHeaders": true }
  },
  "url": "https://example.com/",
  "method": "GET",
  "headers": [["accept", "text/html"]],
  "hasBody": false,
  "timeoutMs": 30000,
  "maxResponseBytes": 2097152,
  "attempt": 0
}
```

| Field | Requirement |
|---|---|
| `requestId` | Unique opaque identifier, 1–128 printable non-space ASCII bytes. Recent IDs cannot be reused. |
| `partition` | Opaque isolation key, 1–128 printable non-space ASCII bytes. Do not share it across unrelated users/sessions. |
| `connection` / `contextId` | Supply exactly one. A context already fixes its connection identity. |
| `url` | HTTP(S) destination, subject to address and context-origin policies. |
| `method` | HTTP method. Redirects are returned, not followed. |
| `headers` | Required array of `[name, value]` pairs. Repeated headers are supported. |
| `hasBody` | Required boolean. `false` preserves a genuinely bodyless upstream request. |
| `bodyLength` | Optional exact raw byte count; enforced when supplied. |
| `timeoutMs` | Positive total budget including admission, upload and response, within service limits. |
| `maxResponseBytes` | Positive decoded-body cap, no larger than the service limit. |
| `attempt` | Actual caller attempt ordinal, starting at zero. It does not enable retries. |

Unknown input fields are rejected. Bound raw upload bytes, frame count and header
sizes independently; a small decoded-response budget does not change these caps.

### Egress and identity

`connection.egress` is either `{ "mode": "direct" }` or
`{ "mode": "proxy", "url": "http://proxy.example:3128" }`. Proxy URL schemes
are `http`, `https`, `socks4`, `socks4a`, `socks5` and `socks5h`. HTTP(S)/SOCKS5
credentials use URL userinfo; SOCKS4 supports a user ID, not a password.

`identity` contains `tlsProfile`, required `emulateHeaders` and optional fixed
`userAgent`. Discover profiles through `/capabilities`. With header emulation
disabled, caller headers and protocol-required generated fields remain; response
decompression is still active. A request cannot contradict a context's fixed UA.

## Wire format

**Media type:** `application/vnd.ja3proxy`

```text
+------------+----------------------+-------------------+
| kind: u8   | length: u32 big-endian| payload: length B |
+------------+----------------------+-------------------+
```

A frame may cross arbitrary HTTP chunks. Never equate an HTTP read with a frame.
The implementation caps JSON metadata and each data frame at 65,536 bytes; consult
`framing` for the negotiated bounds and maximum upload-frame count.

| Direction | Kind | Payload | Placement |
|---|---:|---|---|
| Request | 1 | UTF-8 JSON request metadata | Exactly once, first |
| Request | 2 | Raw body bytes | Zero or more |
| Request | 3 | Empty payload | Exactly once, last |
| Response | 1 | JSON response metadata | Once, before body/success |
| Response | 2 | Raw decoded upstream bytes | Zero or more |
| Response | 3 | JSON final diagnostics | Successful terminal |
| Response | 4 | JSON transport error | Failed terminal, including before metadata |

### Response metadata

The metadata frame contains `requestId`, upstream `status`, repeated `headers`,
initial `diagnostics`, and optional `cookieRevision`. Header values are pairs,
not an object that loses duplicates. HTTP obs-text response field bytes are
represented as Latin-1 characters. Hop-by-hop headers and stale decompression
framing are removed; HEAD representation metadata is preserved.

### Completion rules

1. Require exactly one terminal frame. EOF alone is never success.
2. Reject duplicate metadata, invalid order, truncation and bytes after terminal.
3. Honor kind 4 even after body bytes have already been delivered.
4. Distinguish service HTTP status, upstream HTTP status and terminal transport outcome.

For example, service HTTP 200 can contain upstream HTTP 429 with a successful
terminal frame. Conversely, upstream HTTP 200 can be followed by a decoded-size
or timeout failure. A file should only be committed after successful terminal
validation; see the [Python example](../examples/request.py).

## Contexts

Create a context with `POST /contexts`:

```json
{
  "partition": "demo",
  "connection": {
    "egress": { "mode": "direct" },
    "identity": { "tlsProfile": "chrome_149", "emulateHeaders": true }
  },
  "cookieMode": "managed",
  "allowedOrigins": ["https://example.com"],
  "ttlMs": 60000
}
```

The reply contains `contextId`, `partition`, `expiresAtMs`, `revision`,
`cookieMode` and `identity`. Use `contextId` instead of `connection` in requests.
`ttlMs` is an optional idle TTL; idle and absolute maximum age are bounded by the
service. Closing/expiry cancels live users and releases connection pools/cookies.

| Mode | Behavior |
|---|---|
| `external` | No cookie storage. The application owns its Cookie/Set-Cookie policy. `allowedOrigins` may be empty. |
| `managed` | The service owns cookie selection and ingestion. Caller Cookie headers conflict. Explicit origins are required. |

Managed origins must share one fixed schemeful first-party site, including
private public-suffix boundaries. `https://api.example.com` and
`https://shop.example.com` may share a context; different schemes, unrelated sites
or separate tenants under `github.io` may not. This is not a cross-site browser
model. A missing/expired managed context is not silently recreated.

## Cookies

`POST /contexts/{id}/cookies` always includes `partition`:

| `operation` | Additional fields | Returned fields |
|---|---|---|
| `select` | `url` | `revision`, `cookies` |
| `set` | `url`, `cookies` as Set-Cookie strings, `expectedRevision` | `revision` |
| `export` | — | `revision`, `snapshot` |
| `import` | `snapshot`, `expectedRevision` | `revision` |

A snapshot has exactly this shape:

```json
{
  "partitionKey": "https://example.com",
  "cookies": [{
    "name": "session", "value": "example-value", "domain": "example.com",
    "path": "/", "secure": true, "httpOnly": true, "hostOnly": true,
    "partitioned": false, "sameSite": "Lax"
  }]
}
```

Records require `name`, `value`, `domain`, `path`, `secure`, `httpOnly`,
`hostOnly` and `partitioned`; `sameSite` (`Strict`, `Lax`, `None`) and absolute
`expiresAtMs` are optional. Import rejects a different `partitionKey`, even for
an empty snapshot. Mutations are atomic and compare `expectedRevision` against
the current revision; response-cookie ingestion may have advanced it.

Domain/path, Secure, expiry, public-suffix and cookie-prefix protections apply.
Partitioned and ordinary cookies have separate keys/deletions but share capacity
limits. `Partitioned` requires Secure and stays bound to the context's first-party
site. Invalid individual upstream cookies are discarded; explicit mutations are
strict, and capacity failures are not hidden. See [cookie examples](usage.md#cookie-sessions).

## Diagnostics

The terminal diagnostics contain:

| Fields | Meaning |
|---|---|
| `requestId`, `attempt` | Correlation with the exact request/attempt |
| `traceId` | Optional validated incoming W3C trace ID |
| `phase` | `queued`, `preparing`, `upstream`, `body`, `complete` |
| `delivery` | `not_started`, `possibly_sent`, `response_started` |
| `queueMs`, `headersMs`, `bodyMs`, `totalMs` | Measured times; unavailable header/body times are null |
| `requestBytes`, `responseBytes` | Counted raw upload and decoded response bytes |
| `tlsProfile` | Selected fingerprint profile |
| `clientReused` | Optional client-reuse observation, **not** a claim about TCP socket reuse |
| `contextId`, `cookieRevision` | Optional scoped state identifiers |

Request status returns `state` (`queued`, `active`, `complete`, `failed`),
`diagnostics`, and `error` on failure. Status/duplicate-ID retention is bounded;
not finding an old request is not proof it was never sent.

A cancellation request signals owned work; final diagnostics are committed only
after execution can no longer send. `possibly_sent` must never be treated as
permission to replay a write. Internal trace headers are not sent to upstream
providers.

## Errors

Errors contain a stable `code`, a safe German `message`, and diagnostics when
available. A stream error uses kind 4; control/envelope errors use JSON HTTP
responses. The HTTP mappings below apply to those JSON error responses, not to
an already-open framed HTTP 200 response.

| Code | HTTP | Interpretation |
|---|---:|---|
| `UNAUTHORIZED` | 401 | Missing/invalid service authentication |
| `INVALID_REQUEST`, `INVALID_PROFILE`, `EGRESS_REQUIRED`, `UNSUPPORTED_CAPABILITY` | 400 | Invalid input or unsupported contract feature |
| `SSRF_BLOCKED` | 400 | Address/origin policy refusal |
| `PROTOCOL_ERROR`, `CANCELLED` | 400 | Malformed/incomplete stream or cancellation |
| `CONTEXT_NOT_FOUND` | 404 | Context unavailable to this owner |
| `CONTEXT_CONFLICT`, `DUPLICATE_REQUEST` | 409 | State/identity/revision conflict or reused request ID |
| `BODY_TOO_LARGE`, `COOKIE_LIMIT` | 413 | Byte/cookie bound exceeded |
| `BUSY`, `CONTEXT_LIMIT` | 429 | Bounded capacity exhausted |
| `DNS_ERROR`, `PROXY_ERROR`, `TLS_ERROR`, `CONNECT_ERROR` | 502 | Transport establishment failure |
| `TIMEOUT` | 504 | Total request budget exhausted |
| `UNKNOWN` | 500 | Internal failure |

Inspect the delivery state before making an application-level retry decision.
There is no hidden retry, redirect or direct-egress fallback inside the service.
