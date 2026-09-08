# ja3proxy

An authenticated Rust HTTP transport with reproducible browser TLS/HTTP/2
profiles, scoped connection contexts, optional first-party cookie sessions and
bounded binary streaming. Version 2 replaces the former JSON `/request` API;
there is no legacy fallback or duplicated text/Base64 response body.

[Repository](https://github.com/sellaro-net/ja3proxy) ·
[CI and images](https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml) ·
[Report a vulnerability privately](https://github.com/sellaro-net/ja3proxy/security/advisories/new)

## Operating contract

- Independently deployable; not part of the Sellaro monorepo.
- Rust **1.98.1** is selected by `rust-toolchain.toml`; `Cargo.lock` fixes dependencies.
- `wreq`, `wreq-util` and the structured `btls` error boundary are upgraded together.
  The narrowly patched, exact `wreq` source is in `vendor/wreq`. Its upstream
  checksum, changed files and upgrade requirements are recorded in
  [`transport-v2-provenance.json`](vendor/wreq/transport-v2-provenance.json).
  Do not remove the patch during a dependency refresh: it enforces socket-bound
  address checks and cancellation ownership, not merely a DNS preflight.
- No automatic upstream redirects, hidden HTTP retries or fallback to direct egress.
  Application retry/idempotency decisions remain with the caller.
- Images use `ghcr.io/sellaro-net/ja3proxy`, native `linux/amd64` and `linux/arm64`
  manifests, provenance and an SBOM. Runtime is non-root; the executable is
  root-owned and runs with a read-only filesystem and dropped capabilities.

## Authentication and network boundary

Every `/v2` route requires `Authorization: Bearer <JA3_PROXY_TOKEN>`. Configure
exactly one of `JA3_PROXY_TOKEN` or `JA3_PROXY_TOKEN_FILE`; missing, ambiguous or
invalid configuration aborts startup. Use a dedicated, randomly generated
secret of at least 32 printable ASCII characters, never a Sellaro session,
NextAuth or provider credential. The file variant accepts one trailing newline.
A mounted secret must be readable by the runtime's non-root user.

Bearer authentication does not replace network isolation or TLS between hosts.
Do not expose this service as a public proxy. Only `/health` is unauthenticated.
The caller supplies an opaque `partition`; context and request identifiers are
also bound to that partition and the authenticated service principal.

Private/special-purpose target and proxy addresses are blocked by default.
Direct connections, HTTP/HTTPS CONNECT and SOCKS4/4a/5/5h use checked numeric
addresses while retaining the original HTTP Host, TLS SNI and certificate
verification. Mixed public/private DNS answers fail closed. Remote proxy DNS
cannot bypass the target check. `ALLOW_PRIVATE_IPS=true` deliberately expands
this boundary and belongs only in a trusted, network-restricted environment.

Never log proxy credentials, bearer tokens, cookie snapshots or private bodies.
Use the private vulnerability-reporting channel. Public repository visibility
is not a project license grant: this repository has no project `LICENSE` file.
Vendored third-party code retains its own license terms.

## Local development and containers

Native builds require C/C++, CMake, Go and Clang/libclang. The Docker build
installs these dependencies and the selected compiler patch release explicitly;
keep builder and runtime on the same Debian release.

```sh
export JA3_PROXY_TOKEN="$(openssl rand -hex 32)"
cargo run --locked
```

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

For local evaluation, build the repository rather than assuming a published
version-2 image is already available:

```sh
docker build -t ja3proxy-v2-local .
docker run --rm --read-only --cap-drop ALL \
  --security-opt no-new-privileges \
  -e JA3_PROXY_TOKEN \
  -p 127.0.0.1:8080:8080 \
  ja3proxy-v2-local
```

For deployment, select the complete immutable reference from a verified publish.
A repository URL does not prove registry visibility or pull permission. The old
`ghcr.io/tentoxa/ja3proxy` package is a separate artifact; never transplant its
digest into the new namespace. Coordinate the version-2 service, client and
secret rollout. Existing deployment image pins are not changed by this feature.

## Version-2 API

`GET /health` is non-sensitive liveness. Authenticated `GET /v2/capabilities`
returns the actual profile identifiers, header descriptors, framing limits,
timeout/body/context/queue limits and implemented modes. Negotiate this endpoint
instead of copying a profile list or guessing service compatibility.

```sh
curl --fail http://127.0.0.1:8080/v2/capabilities \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN"
```

### Binary request and response

`POST /v2/request` uses `Content-Type: application/vnd.ja3proxy.v2`. Each frame
has a one-byte kind, a four-byte unsigned big-endian payload length, then its
payload. JSON metadata and individual binary frames are each capped at 65,536
bytes; upload-frame count and total raw/decoded bytes have separate bounds.

| Direction | Kind | Payload |
|---|---:|---|
| Request | 1 | UTF-8 JSON request metadata, exactly once and first |
| Request | 2 | Raw body bytes, zero or more frames |
| Request | 3 | Empty upload terminator; no following bytes |
| Response | 1 | JSON upstream status, repeated headers and initial diagnostics |
| Response | 2 | Raw decoded upstream bytes |
| Response | 3 | JSON final diagnostics; successful terminal |
| Response | 4 | JSON typed transport error with diagnostics; failure terminal |

A response requires exactly one terminal frame. Unexpected EOF, trailing frames
and malformed framing are errors. A kind-4 failure may be the first frame or
follow already streamed bytes. Service HTTP 200 is not upstream success: use the
metadata's upstream status, and consume the terminal outcome. Authentication,
invalid-envelope and control errors can instead return bounded JSON with a
non-2xx service HTTP status.

Request metadata fields use camelCase:

| Field | Contract |
|---|---|
| `requestId`, `partition` | Required opaque identifiers, at most 128 characters |
| `contextId` / `connection` | Exactly one; no implicit default connection |
| `connection.egress` | `{ "mode": "direct" }` or `{ "mode": "proxy", "url": "…" }` |
| `connection.identity` | Canonical `tlsProfile`, required `emulateHeaders`, optional fixed `userAgent` |
| `url`, `method` | HTTP(S) destination and HTTP method |
| `headers` | Array of `[name, value]` pairs; repeated fields are preserved |
| `hasBody` | Required boolean; false means no upstream request body |
| `bodyLength` | Optional exact raw byte count, enforced when supplied |
| `timeoutMs` | Required positive total queue/transfer budget within negotiated limits |
| `maxResponseBytes` | Required decoded-body limit within the server limit |
| `attempt` | Required real nonnegative caller attempt ordinal |

`emulateHeaders: false` disables emulated header defaults, not protocol-required
headers or response decompression. Unsupported profiles and inconsistent fixed
user agents fail explicitly. Hop-by-hop and stale decompression framing headers
are removed; valid repeated headers, HEAD representation metadata and HTTP
obs-text response bytes remain representable.

### Contexts and cookies

`POST /v2/contexts` accepts `partition`, `connection`, `cookieMode`
(`external` or `managed`), `allowedOrigins`, and optional bounded `ttlMs`.
HTTP 201 returns `contextId`, `partition`, `expiresAtMs`, `revision`, `cookieMode`
and `identity`. `DELETE /v2/contexts/{id}` takes JSON `{ "partition": "…" }`.
Closing/expiring a context releases its pool and secrets, including losing
speculative connectors. Context loss never silently recreates a cookie session.

Managed mode requires explicit origins sharing one fixed **schemeful first-party
site**, using the public suffix list including private suffixes. It is not a
cross-site browser or JavaScript runtime. Domain, path, Secure, expiry,
public-suffix and cookie-prefix rules are enforced; caller Cookie headers conflict
with managed ownership. Selection and response-cookie application are serialized.
External mode never stores cookies and is appropriate for durable application jars.

`POST /v2/contexts/{id}/cookies` always includes `partition`:

| `operation` | Additional input | Result |
|---|---|---|
| `select` | `url` | `revision`, matching cookie records |
| `set` | `url`, `cookies` (Set-Cookie strings), `expectedRevision` | New revision |
| `export` | — | `revision`, snapshot |
| `import` | `snapshot`, `expectedRevision` | New revision |

Records preserve `name`, `value`, `domain`, `path`, `secure`, `httpOnly`,
`hostOnly`, required `partitioned`, optional `sameSite` and absolute
`expiresAtMs`. Snapshots are `{ version: 1, partitionKey, cookies }`;
`partitionKey` is the fixed `scheme://registrable-domain` (exact IP/host fallback).
Import rejects another partition key, even for an empty snapshot. Mutations are
atomic and revision-CAS guarded.

Partitioned and ordinary cookies have separate keys and deletions but share the
same count/byte limits. This preserves Cloudflare's
[`cf_clearance` with `SameSite=None; Secure; Partitioned`](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).
Invalid individual upstream cookies are discarded under RFC ingestion rules;
explicit control mutations remain strict, and capacity errors stay visible.
An identity change requires a fresh context and explicit snapshot transfer; it
cannot retain an incompatible pooled connection.

### Cancellation and diagnostics

`DELETE /v2/requests/{requestId}` and
`POST /v2/requests/{requestId}/status` take JSON `{ "partition": "…" }`.
Queue/transfer deadlines, caller cancellation and stream drop cancel owned work.
Bounded recent IDs prevent duplicate execution rather than replaying a request.

Diagnostics include request/attempt IDs, validated incoming W3C `traceId`, phase,
queue/header/body/total elapsed times, byte counts, selected profile and optional
context/cookie revision. `clientReused` reports client reuse, not guessed TCP
socket reuse. Delivery is `not_started`, `possibly_sent` or `response_started`;
`possibly_sent` is **not** permission to retry a write. Cancellation does not
freeze a premature `not_started` result while execution can still send bytes.

Errors carry a stable `code`, safe German `message` and diagnostics. Notable
classes include `BUSY`, `TIMEOUT`, `CANCELLED`, `SSRF_BLOCKED`, `BODY_TOO_LARGE`,
`CONTEXT_NOT_FOUND`, `CONTEXT_CONFLICT` and `COOKIE_LIMIT`. Internal trace headers
are correlated in the service but never forwarded to third-party destinations.

## Configuration

Defaults below are binary defaults; negotiated capabilities describe the running
instance. Invalid or incoherent limits abort startup.

| Variable | Default | Purpose |
|---|---:|---|
| `JA3_PROXY_TOKEN` / `JA3_PROXY_TOKEN_FILE` | Required, exclusive | Dedicated service authentication |
| `PORT` | `8080` | Listening port |
| `LOG_LEVEL` | `info` | Structured log verbosity |
| `MAX_CONCURRENT` / `MAX_CONCURRENT_PER_PARTITION` | `100` / `4` | Active transfer bounds |
| `MAX_QUEUED` / `MAX_QUEUED_PER_PARTITION` | `256` / `16` | Pending admission bounds |
| `MAX_ENVELOPES` | `128` | Concurrent envelope readers |
| `MAX_REQUEST_BODY_SIZE` | `10485760` | Raw upload bytes |
| `MAX_RESPONSE_BODY_SIZE` | `52428800` | Decoded response bytes |
| `MAX_TIMEOUT_MS` | `120000` | Maximum total request budget |
| `ENVELOPE_TIMEOUT_MS` | `5000` | Initial envelope budget |
| `MAX_CONTROL_BODY_SIZE` | `1048576` | Control JSON byte bound |
| `REGISTRY_CAPACITY` / `REGISTRY_TTL_MS` | `4096` / `60000` | Request-ID/status retention |
| `ALLOW_PRIVATE_IPS` | `false` | Explicit private target/proxy opt-in |

`DEFAULT_TIMEOUT` and `SERVER_TIMEOUT` are no longer version-2 settings.

## CI and releases

The `quality` check runs formatting, Clippy and behavioral tests, including real
local socket/TLS/proxy cases. PR CI builds the actual image without publishing,
starts a read-only non-root container, checks authenticated version-2 access and
private-target rejection. Workflows use pinned, checksum-verified actionlint.

Only permitted `main` or `v*` refs enter publishing. Native amd64/arm64 jobs
publish digests, then a separate job combines and verifies the multi-architecture
manifest. Publishers are not cancelled midway or used to delete package versions.
Dependency changes remain reviewed PRs with required checks, immutable release
tags and branch protection; no bypass or self-approval requirement is introduced.
