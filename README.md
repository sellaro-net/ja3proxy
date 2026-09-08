<p align="center">
  <img src="docs/assets/banner.svg" alt="ja3proxy — Browser-shaped TLS. Explicit control." width="1280">
</p>

<p align="center">
  <strong>Browser fingerprints, binary streams and isolated sessions — without running a browser.</strong>
</p>

<p align="center">
  <a href="https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml"><img src="https://img.shields.io/github/actions/workflow/status/sellaro-net/ja3proxy/docker-build.yml?branch=main&amp;style=flat-square&amp;label=build&amp;color=0d9488" alt="Build status"></a>
  <a href="rust-toolchain.toml"><img src="https://img.shields.io/badge/Rust-1.98.1-334155?style=flat-square&amp;logo=rust&amp;logoColor=white" alt="Rust 1.98.1"></a>
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick start</strong></a> &nbsp; / &nbsp;
  <a href="#documentation"><strong>Documentation</strong></a> &nbsp; / &nbsp;
  <a href="#security"><strong>Security</strong></a> &nbsp; / &nbsp;
  <a href="#development"><strong>Development</strong></a>
</p>

<br>

## Documentation

<table>
<tr>
<td width="33%" valign="top">
<h3><a href="docs/usage.md">Usage guide ↗</a></h3>
<p>From your first request to proxy routing, cookie sessions and cancellation.</p>
<a href="docs/usage.md"><strong>Explore the workflows →</strong></a>
</td>
<td width="33%" valign="top">
<h3><a href="docs/api.md">API reference ↗</a></h3>
<p>Endpoints, binary framing, request fields and terminal diagnostics.</p>
<a href="docs/api.md"><strong>Build your integration →</strong></a>
</td>
<td width="33%" valign="top">
<h3><a href="docs/configuration.md">Configuration ↗</a></h3>
<p>Service secrets, resource limits and private container deployments.</p>
<a href="docs/configuration.md"><strong>Configure your instance →</strong></a>
</td>
</tr>
</table>

## Transport at a glance

<table>
<tr>
<td width="50%" valign="top">
<h3>Browser identity</h3>
<p>Selectable TLS/HTTP/2 fingerprints, matching header emulation and a fixed user agent.</p>
</td>
<td width="50%" valign="top">
<h3>Explicit egress</h3>
<p>Direct, HTTP, HTTPS or SOCKS routing. A failed proxy never silently becomes a direct request.</p>
</td>
</tr>
<tr>
<td valign="top">
<h3>Isolated sessions</h3>
<p>Reusable connection contexts and first-party cookie jars, scoped to the caller and connection identity.</p>
</td>
<td valign="top">
<h3>Binary streaming</h3>
<p>Raw uploads and decoded downloads, bounded by byte limits and verified terminal frames.</p>
</td>
</tr>
</table>

**You own the policy.** The service handles transport, not JavaScript execution
or challenge solving. Retries, redirects and identity changes remain explicit
application decisions. Admission, execution and cancellation have bounded budgets.

<br>

## Quick start

A working service and your first request in two steps. Commands use a POSIX
shell; the [example client](examples/request.py) needs Python 3.10+ with no extra packages.

### 1 · Start the service

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

### 2 · Send a request

Keep the container running. In another shell, set the **same** `JA3_PROXY_TOKEN`
and `JA3_PROXY_URL`, then run this from the repository directory:

```sh
python examples/request.py https://example.com/ \
  --partition demo --direct --output response.html
```

The client streams the body, validates completion and only then replaces the
output file. Request IDs and the final status summary go to stderr.

> [!TIP]
> **Ready for more?** Try a [JSON POST or binary upload](docs/usage.md#requests-and-uploads),
> use [your proxy](docs/usage.md#proxy-routing), or open a [cookie session](docs/usage.md#cookie-sessions).

<details>
<summary><strong>Check liveness and discover supported capabilities</strong></summary>

```sh
curl --fail "$JA3_PROXY_URL/health"

curl --fail "$JA3_PROXY_URL/capabilities" \
  -H "Authorization: Bearer $JA3_PROXY_TOKEN"
```

`/health` is public liveness. `/capabilities` is authenticated and reports the
profiles, limits and features of the running instance.

</details>

> [!IMPORTANT]
> `/request` uses **binary framing**, not JSON-in/JSON-out. Start with the
> [working client](examples/request.py) or the [wire contract](docs/api.md#wire-format).

<br>

## Security

- **Dedicated authentication.** Every route except `/health` requires a service bearer token. Never commit it or reuse a login/application secret.
- **Scoped state.** Contexts and cookie jars belong to a caller partition and an immutable connection identity.
- **Checked connections.** Target and proxy addresses are validated at the socket boundary; mixed public/private DNS answers are rejected.
- **Verified TLS.** Numeric routing preserves the original Host, SNI and certificate checks.

> [!WARNING]
> **Keep the service private.** Bearer authentication does not replace network
> isolation or TLS between hosts. Leave `ALLOW_PRIVATE_IPS` disabled outside
> deliberately isolated environments.

[Deployment guidance →](docs/configuration.md#deployment) &nbsp; · &nbsp;
[Report a vulnerability privately →](https://github.com/sellaro-net/ja3proxy/security/advisories/new)

## Development

<details>
<summary><strong>Build locally and run the checks</strong></summary>

Rust **1.98.1** is pinned in [`rust-toolchain.toml`](rust-toolchain.toml).
Native builds also need C/C++, CMake, Go and Clang/libclang. The
[`Dockerfile`](Dockerfile) provides the Linux build environment.

```sh
export JA3_PROXY_TOKEN="$(openssl rand -hex 32)"
cargo run --locked

cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
```

</details>

The pinned `wreq` dependency includes a narrow connector patch for address and
cancellation ownership. Read its [provenance and refresh requirements](vendor/wreq/transport-provenance.json)
before updating it. Third-party code keeps its own license terms; this repository
has no project-level license grant.

<br>

---

<p align="center">
  <strong>ja3proxy</strong><br>
  <sub>Browser-shaped TLS. Application-owned control.</sub>
</p>
<p align="center">
  <a href="https://github.com/sellaro-net/ja3proxy">Source</a> &nbsp; · &nbsp;
  <a href="https://github.com/sellaro-net/ja3proxy/pulls">Pull requests</a> &nbsp; · &nbsp;
  <a href="https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml">Builds</a> &nbsp; · &nbsp;
  <a href="https://github.com/sellaro-net/ja3proxy/releases">Releases</a>
</p>
<p align="center">
  <sub>Images: <code>ghcr.io/sellaro-net/ja3proxy</code> — deploy a verified digest.</sub>
</p>
