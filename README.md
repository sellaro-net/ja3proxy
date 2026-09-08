<div align="center">

# ja3proxy

**Browser TLS fingerprints · Explicit proxy routing · Isolated cookie sessions**

A small HTTP service for authenticated, binary-safe requests with browser-shaped
TLS and HTTP/2 behavior — without launching a browser.

[![CI](https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml/badge.svg)](https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml)
[![Rust](https://img.shields.io/badge/Rust-1.98.1-000000?logo=rust)](rust-toolchain.toml)

[Quick start](#quick-start) · [Usage guide](docs/usage.md) · [API reference](docs/api.md) · [Configuration](docs/configuration.md) · [Security](#security)

</div>

---

## What it does

| Capability | What you get |
|---|---|
| **Browser identities** | Selectable TLS/HTTP/2 profiles, optional matching header emulation and a fixed user agent. |
| **Explicit routing** | Direct egress or HTTP, HTTPS, SOCKS4, SOCKS4a, SOCKS5 and SOCKS5h proxies. |
| **Reusable contexts** | Connection pools isolated by caller partition, proxy and browser identity. |
| **Cookie sessions** | First-party jars with domain/path rules, expiry, Secure, prefix/public-suffix checks and partitioned cookies. |
| **Binary streaming** | Raw uploads and decoded response streams with bounded frames and byte limits. |
| **Controlled execution** | Bounded admission, total deadlines, cancellation and final delivery diagnostics. |

**Not a browser automation engine.** No JavaScript execution, automatic challenge
solving, hidden retries or automatic redirects. The application decides what to
retry, which redirect to follow and when to replace an identity.

## Quick start

These commands use a POSIX shell. The request example needs **Python 3.10+** and
only the standard library; no Python packages are required.

### 1. Build and start

```sh
git clone https://github.com/sellaro-net/ja3proxy.git
cd ja3proxy

export JA3_PROXY_TOKEN="$(openssl rand -hex 32)"
export JA3_PROXY_URL="http://127.0.0.1:8080"

docker build -t ja3proxy-local .
docker run --rm --name ja3proxy-local \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  -e JA3_PROXY_TOKEN \
  -p 127.0.0.1:8080:8080 \
  ja3proxy-local
```

Keep the container running. Use another shell with the **same** token for the
following commands. Never commit the token or reuse an application/login secret.

### 2. Check the service

```sh
curl --fail "$JA3_PROXY_URL/health"

curl --fail "$JA3_PROXY_URL/capabilities" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN"
```

`/health` checks liveness. `/capabilities` reports the profiles, limits and
features of the running service.

### 3. Make a request

```sh
python examples/request.py https://example.com/ \
  --partition demo --direct --profile chrome_149 \
  --output response.html
```

The [example client](examples/request.py) negotiates the media type, streams the
response and checks its terminal frame. It prints a small status summary to
stderr and only replaces `response.html` after the transport finishes correctly.

> [!IMPORTANT]
> `/request` is a framed binary endpoint, not a JSON-in/JSON-out endpoint.
> Use the example client to get started, or implement the [wire contract](docs/api.md#wire-format).

## Choose your workflow

| I want to… | Start here |
|---|---|
| Send a GET, JSON POST or binary upload | [Requests and uploads](docs/usage.md#requests-and-uploads) |
| Route traffic through my proxy | [Proxy routing](docs/usage.md#proxy-routing) |
| Reuse one connection identity | [Connection contexts](docs/usage.md#connection-contexts) |
| Keep cookies between requests | [Cookie sessions](docs/usage.md#cookie-sessions) |
| Change a session's fingerprint safely | [Identity changes](docs/usage.md#identity-changes) |
| Cancel work or inspect its outcome | [Cancellation and status](docs/usage.md#cancellation-and-status) |
| Build a client in another language | [API reference](docs/api.md) |
| Configure secrets, limits or containers | [Configuration and deployment](docs/configuration.md) |

## Security

- **Authenticated API:** every route except `/health` requires a dedicated bearer token.
- **No shared cookie jar:** contexts belong to a caller partition and immutable connection identity.
- **Socket-bound SSRF checks:** target and proxy addresses are validated for direct, CONNECT and SOCKS connections; mixed public/private DNS answers are rejected.
- **TLS verification stays enabled:** numeric routing preserves the original Host, SNI and certificate checks.
- **No implicit direct fallback:** an unavailable proxy is an error, not permission to use another exit.

> [!WARNING]
> Keep this service private. Bearer authentication does not replace network
> isolation or TLS between hosts. `ALLOW_PRIVATE_IPS=true` expands the network
> boundary; leave it disabled outside deliberately isolated environments.

Read the [deployment guidance](docs/configuration.md#deployment) before exposing
an instance. Report vulnerabilities [privately](https://github.com/sellaro-net/ja3proxy/security/advisories/new), not with credentials or private response bodies in a public issue.

## Development

Rust **1.98.1** is selected by [`rust-toolchain.toml`](rust-toolchain.toml).
Native builds also need C/C++, CMake, Go and Clang/libclang; the
[`Dockerfile`](Dockerfile) provides the Linux build environment.

```sh
export JA3_PROXY_TOKEN="$(openssl rand -hex 32)"
cargo run --locked

cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

The exact `wreq` dependency includes a narrow connector patch for address and
cancellation ownership. See its [provenance and refresh requirements](vendor/wreq/transport-provenance.json)
before updating it. Third-party code keeps its own license terms; this repository
has no project-level license grant.

## Project links

| Resource | Link |
|---|---|
| Documentation | [Usage](docs/usage.md) · [API](docs/api.md) · [Configuration](docs/configuration.md) |
| Executable example | [Python streaming client](examples/request.py) |
| Source and changes | [Repository](https://github.com/sellaro-net/ja3proxy) · [Pull requests](https://github.com/sellaro-net/ja3proxy/pulls) |
| Builds and releases | [Actions](https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml) · [Releases](https://github.com/sellaro-net/ja3proxy/releases) |
| Image namespace | `ghcr.io/sellaro-net/ja3proxy` — select a verified digest for deployment |
| Security reports | [Private advisory](https://github.com/sellaro-net/ja3proxy/security/advisories/new) |
