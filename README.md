# ja3proxy

HTTP service for requests with browser TLS and HTTP/2 fingerprints, explicit
proxy routing and isolated cookie sessions. Supports binary uploads and streamed
responses without running a browser.

## Documentation

- [Usage guide](docs/usage.md) — requests, uploads, proxies, cookies and cancellation.
- [API reference](docs/api.md) — endpoints, request fields, binary framing and errors.
- [Configuration](docs/configuration.md) — authentication, limits and deployment.
- [Example client](examples/request.py) — a streaming client using only the Python standard library.

## Features

- Selectable TLS/HTTP/2 profiles with optional header emulation and a fixed user agent.
- Direct connections or HTTP, HTTPS and SOCKS proxies, without implicit direct fallback.
- Reusable connection contexts scoped to the caller and connection identity.
- Managed first-party cookie jars with explicit export, import and revision checks.
- Binary streaming with byte limits, total deadlines, cancellation and terminal diagnostics.

The service does not execute JavaScript, solve challenges, follow redirects or
retry requests automatically. Those decisions remain with the application.

## Quick start

The commands below use a POSIX shell, Docker, OpenSSL and curl. The example
client requires Python 3.10+; no additional Python packages are needed.

### Start the service

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

Keep the container running. In another shell, set the same `JA3_PROXY_TOKEN`
and `JA3_PROXY_URL`, then run the following commands from the repository directory.

### Check the service

```sh
curl --fail "$JA3_PROXY_URL/health"

curl --fail "$JA3_PROXY_URL/capabilities" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN"
```

`/health` checks liveness. `/capabilities` requires authentication and reports
the profiles, limits and features supported by the running instance.

### Send a request

```sh
python examples/request.py https://example.com/ \
  --partition demo --direct --output response.html
```

The client streams the response and only replaces the output file after a valid
successful terminal frame. Request IDs and the final status summary go to stderr.

`/request` uses binary framing, not a JSON request/response envelope. Use the
[example client](examples/request.py) or implement the [wire contract](docs/api.md#wire-format).

## Usage

- [Send JSON or upload a file](docs/usage.md#requests-and-uploads)
- [Use a proxy](docs/usage.md#proxy-routing)
- [Reuse a connection context](docs/usage.md#connection-contexts)
- [Manage a cookie session](docs/usage.md#cookie-sessions)
- [Change a session's identity](docs/usage.md#identity-changes)
- [Cancel a request or inspect its status](docs/usage.md#cancellation-and-status)
- [Troubleshoot errors](docs/usage.md#troubleshooting)

## Security

- Keep the service private. Between hosts, use TLS and network access controls in addition to bearer authentication.
- Every route except `/health` requires a dedicated service token. Never commit it or reuse a login/application secret.
- Contexts and cookie jars are isolated by caller partition and immutable connection identity.
- Target and proxy addresses are validated at the socket boundary. Mixed public/private DNS answers are rejected; Host, SNI and certificate verification remain intact.
- Leave `ALLOW_PRIVATE_IPS` disabled outside deliberately isolated environments.

Read the [deployment guidance](docs/configuration.md#deployment) before running
an instance. Report vulnerabilities through a [private security advisory](https://github.com/sellaro-net/ja3proxy/security/advisories/new),
without exposing credentials or private response bodies in public issues.

## Development

Rust 1.98.1 is pinned in [`rust-toolchain.toml`](rust-toolchain.toml).
Native builds also require C/C++, CMake, Go and Clang/libclang. The
[`Dockerfile`](Dockerfile) provides the Linux build environment.

```sh
export JA3_PROXY_TOKEN="$(openssl rand -hex 32)"
cargo run --locked
```

Run the checks before submitting changes:

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

The pinned `wreq` dependency includes a connector patch for address and
cancellation ownership. Read its [provenance and refresh requirements](vendor/wreq/transport-provenance.json)
before updating it. Third-party code keeps its own license terms; this repository
has no project-level license grant.

## Project links

- [Source](https://github.com/sellaro-net/ja3proxy)
- [Pull requests](https://github.com/sellaro-net/ja3proxy/pulls)
- [Builds](https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml)
- [Releases](https://github.com/sellaro-net/ja3proxy/releases)

Container images use `ghcr.io/sellaro-net/ja3proxy`. Deploy a verified image digest.
