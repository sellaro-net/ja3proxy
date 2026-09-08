# Configuration and deployment

[Home](../README.md) · [Usage guide](usage.md) · [API reference](api.md)

## Authentication

Set **exactly one** of:

| Variable | Purpose |
|---|---|
| `JA3_PROXY_TOKEN` | Dedicated service bearer token |
| `JA3_PROXY_TOKEN_FILE` | Path to a mounted secret file containing that token |

Tokens contain **32–4096 printable non-space ASCII bytes**. A token file may end
with one LF or CRLF. Both variables set, neither set, unreadable files and invalid
tokens fail startup. Reusing `NEXTAUTH_SECRET` is rejected when it is present in
the service environment. Generate an independent secret regardless.

The included Python example accepts `JA3_PROXY_TOKEN` and `JA3_PROXY_URL`; the
latter is a **client setting**, not a server bind address. Its default is
`http://127.0.0.1:8080`. Use HTTPS when requests cross a host boundary.

## Environment variables

Except where stated, values are positive integers. Invalid values fail startup
instead of silently falling back to defaults.

| Variable | Default | Maximum / accepted values |
|---|---:|---|
| `PORT` | `8080` | `65535` |
| `LOG_LEVEL` | `info` | `off`, `error`, `warn`, `info`, `debug`, `trace` |
| `ALLOW_PRIVATE_IPS` | `false` | `true` / `1` / `false` / `0` |
| `MAX_CONCURRENT` | `100` | `10000` |
| `MAX_CONCURRENT_PER_PARTITION` | `4` | `10000`, no greater than global concurrency |
| `MAX_QUEUED` | `256` | `100000` |
| `MAX_QUEUED_PER_PARTITION` | `16` | `100000`, no greater than global queue |
| `MAX_ENVELOPES` | `128` | `10000` |
| `MAX_REQUEST_BODY_SIZE` | `10485760` (10 MiB) | `1073741824` (1 GiB) |
| `MAX_RESPONSE_BODY_SIZE` | `52428800` (50 MiB) | `1073741824` (1 GiB) |
| `MAX_TIMEOUT_MS` | `120000` | `300000` |
| `ENVELOPE_TIMEOUT_MS` | `5000` | `30000` |
| `MAX_CONTROL_BODY_SIZE` | `1048576` (1 MiB) | `4194304` (4 MiB) |
| `REGISTRY_CAPACITY` | `4096` | `100000`; at least `MAX_CONCURRENT + MAX_QUEUED` |
| `REGISTRY_TTL_MS` | `60000` | `600000` |

The upload limit counts **raw request bytes**; the response limit counts
**decoded upstream bytes**, so compression cannot bypass it. Envelope readers,
admitted requests, queued work and registry records have separate bounds.
Increasing one limit does not remove the others.

### Fixed limits

These are advertised by `/capabilities`, not environment knobs:

| Resource | Limit |
|---|---:|
| Metadata / individual data frame | 65,536 bytes each |
| Request headers | 256 pairs, 32,768 combined name/value bytes |
| Contexts | 1,024 total; 16 per partition |
| Context idle TTL | 5 minutes by default; at most 30 minutes |
| Context absolute lifetime | 2 hours |
| Cookies | 180 per context; 65,536 combined cookie bytes |
| Individual cookie | 4,096 bytes |
| Explicit origins | 32 per context |

The upload-frame count is independently capped; read `framing.maxUploadFrames`.
Contexts and cookies are in-memory and disappear on restart. Expiry/close cancels
context-owned work and drops its pools and jar.

## Deployment

### Keep the service private

- Prefer an internal container network without a public port publication.
- For local development, bind published ports to `127.0.0.1`, as in the quick start.
- Between hosts, provide TLS and network access controls in addition to the bearer token.
- Keep `ALLOW_PRIVATE_IPS` disabled unless the deployment intentionally permits private destinations and proxies.
- Configure ingress/body limits for streaming; buffering the whole exchange defeats bounded streaming.
- Set ingress timeouts long enough for the service's total request budget and terminal delivery.

There is no implicit direct fallback, environment-proxy inheritance, automatic
redirect following or internal retry. An application's proxy, redirect and replay
policy stays with that application.

### Container secrets

Prefer an orchestrator secret mount and `JA3_PROXY_TOKEN_FILE` over putting a
literal token in Compose, a command line or an image layer. Ensure the mounted
file is readable by the image's non-root runtime user, not by unrelated users.

The image supports a read-only root filesystem, dropped capabilities and
`no-new-privileges`. No persistent data volume is needed for transport state.
[`Dockerfile`](../Dockerfile) is the source of truth for the build/runtime images
and installed dependencies.

### Select the exact image

Published images use the `ghcr.io/sellaro-net/ja3proxy` namespace. Deploy a verified
`@sha256:` digest, not a floating tag or a digest guessed from a source commit.
The [workflow](../.github/workflows/docker-build.yml) runs quality checks before
publishing architecture images and assembling the multi-architecture manifest.
Pull-request builds are checked without publication.

A rollout must coordinate the caller's wire contract, service image and token.
Before release, exercise all of the following against the selected image:

1. Public `/health` and authenticated `/capabilities`.
2. An unauthenticated API refusal.
3. A complete framed upload/download, including its terminal frame.
4. The actual configured proxy and relevant login/cookie workflows.
5. Cancellation and failure handling, not only a successful HTTP status.

Do not treat `/health` as proof of upstream connectivity or contract readiness.
Rollbacks must preserve agreement between the application and service.

## Maintenance

The Rust toolchain and dependency lockfile are pinned. The patched `wreq` source
has an explicit [provenance manifest](../vendor/wreq/transport-provenance.json).
Review connector behavior, DNS/address policy, retries and cancellation when
refreshing it; replacing the patch with an unreviewed upstream dependency changes
the security and delivery boundary.

Use `cargo fmt --check`, `cargo clippy --all-targets --locked -- -D warnings` and
`cargo test --locked`, then build and exercise the actual container. Diagnostics
must not expose proxy passwords, bearer tokens, cookie values or response bodies.
