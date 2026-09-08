# ja3proxy

HTTP service for requests with browser TLS and HTTP/2 fingerprints, explicit
proxy routing and isolated cookie sessions. Supports binary uploads and streamed
responses without running a browser.

## Documentation

- [Usage guide](docs/usage.md) — requests, uploads, proxies, cookies and cancellation.
- [API reference](docs/api.md) — endpoints, request fields, binary framing and errors.
- [Configuration](docs/configuration.md) — authentication, limits and deployment.
- [TypeScript SDK](#typescript-sdk) — Node.js async, streaming, fetch and synchronous clients.
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

docker pull ghcr.io/sellaro-net/ja3proxy:latest
docker run --rm --name ja3proxy-local \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  -e JA3_PROXY_TOKEN \
  -p 127.0.0.1:8080:8080 \
  ghcr.io/sellaro-net/ja3proxy:latest
```

The public image supports Linux `amd64` and `arm64`; pulling it requires no
GitHub account or `docker login`. `latest` follows successful builds of `main`.
For production, pin the verified `sha256` digest from the container workflow
summary rather than relying on a moving tag. Each publication checks an
anonymous pull in a separate job without registry credentials.

To build from source instead, run `docker build -t ja3proxy-local .` and replace
the image reference in `docker run` with `ja3proxy-local`.

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
[TypeScript SDK](#typescript-sdk), [example client](examples/request.py) or implement the [wire contract](docs/api.md#wire-format).

## Usage

- [Send JSON or upload a file](docs/usage.md#requests-and-uploads)
- [Use a proxy](docs/usage.md#proxy-routing)
- [Reuse a connection context](docs/usage.md#connection-contexts)
- [Manage a cookie session](docs/usage.md#cookie-sessions)
- [Change a session's identity](docs/usage.md#identity-changes)
- [Cancel a request or inspect its status](docs/usage.md#cancellation-and-status)
- [Troubleshoot errors](docs/usage.md#troubleshooting)

## TypeScript SDK

`packages/typescript` contains the standalone `@sellaro/ja3proxy` package for
Node.js 22.14 or newer. It has no npm runtime dependencies or framework coupling.
The SDK is [MIT licensed](https://github.com/sellaro-net/ja3proxy/blob/main/packages/typescript/LICENSE);
this grant covers the SDK, not the rest of the Rust repository.
ESM and CommonJS share the root implementation, including error identity and
response-completion tracking when both module formats are used in one process.

For a published release, install `@sellaro/ja3proxy` with pnpm. For development,
use Node.js 24.18.0 and pnpm 11.15.1 from the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm sdk:typecheck
pnpm sdk:build
pnpm sdk:test
pnpm sdk:pack
pnpm sdk:consumers
```

`sdk:pack` produces `packages/typescript/artifacts/sellaro-ja3proxy-1.0.0.tgz`
plus its SHA-256 checksum. Install that archive in a consuming application with
`pnpm add` and its actual filesystem path.

The application supplies the service address and credential explicitly. This
example uses the variables from the service quick start; the SDK never reads them:

```js
import { Ja3ProxyClient } from '@sellaro/ja3proxy';

const baseUrl = process.env.JA3_PROXY_URL;
const token = process.env.JA3_PROXY_TOKEN;
if (!baseUrl || !token) throw new Error('JA3_PROXY_URL und JA3_PROXY_TOKEN sind erforderlich');
const client = new Ja3ProxyClient({ baseUrl, token });
try {
  const capabilities = await client.capabilities();
  const response = await client.request({
    partition: 'example',
    connection: {
      egress: { mode: 'direct' },
      identity: { tlsProfile: capabilities.profiles[0], emulateHeaders: false },
    },
    method: 'GET',
    url: 'https://example.com/',
    timeoutMs: 10_000,
    maxResponseBytes: 1024 * 1024,
  });
  console.log(response.status, response.text());
} finally {
  await client.close();
}
```

- `request()` buffers within explicit limits and succeeds only after a valid
  terminal success frame. `tryRequest()` returns `Result<BufferedResponse>`.
  HTTP error statuses remain HTTP responses, not transport failures.
- `stream()` exposes headers, a byte stream and `completion: Promise<Result<Ja3Diagnostics>>`.
  Headers or body bytes alone do not establish success. Consume the body, check
  completion and close streams abandoned early.
- `createFetch()` returns a closeable fetch adapter. It is stateless unless
  `context: 'session'` is explicit. `getResponseCompletion(response)` returns the
  terminal result for SDK responses and `undefined` for unrelated native responses.
- `createSession()` owns its context. Managed cookie sessions require allowed
  origins and expose cookie snapshots, revision-checked imports and rebinding.
  `committed_cleanup_pending` means the new identity is already bound: do not
  repeat the rebind just because old-context cleanup failed.
- Closing rejects new work immediately; `close({ drain: true, timeoutMs })` bounds
  draining. Failed remote cleanup retains ownership for a subsequent explicit
  `close()` attempt. It never replays an upstream request. A hard worker failure
  cannot guarantee immediate remote cleanup; service expiry remains the backstop.
- `Ja3ProxySyncClient` from `@sellaro/ja3proxy/sync` uses a real Worker/Atomics
  bridge with bounded IPC, timeouts, buffering and ordered `requestMany()` results.
  It blocks the calling thread: the service and upstream must not depend on that
  same event loop. Use the async API in servers and close sync clients explicitly.

Queueing, lazy context creation and response processing share one total deadline.
The SDK does not retry requests, follow redirects, rotate proxies or fall back to
direct connections. Application policy owns those decisions. Observers receive
bounded byte copies; the SDK does not install tracing or journals.

Rust DTOs are the wire-contract source. `pnpm contracts:generate` exports schemas
and regenerates TypeScript types and standalone validators; `pnpm contracts:check`
rejects drift. `pnpm --filter @sellaro/ja3proxy test:contracts` checks shared fixtures.
`pnpm sdk:consumers --interop` exercises installed ESM/CJS exports and workers
against a running service. Use an isolated service with `ALLOW_PRIVATE_IPS=true`
for the local test origins; set `JA3_SMOKE_ORIGIN_HOST` to an address reachable
from the service (`host.docker.internal` on Docker Desktop). Never enable private
targets for these tests on a production service.

### SDK publication

The source manifest intentionally remains `private: true`. Checked development
packs remain private too; only the isolated release copy is public. Package
scripts and development dependencies never enter that copy. The SDK is published
as [`@sellaro/ja3proxy`](https://www.npmjs.com/package/@sellaro/ja3proxy).

1. Merge SDK changes into protected `main`.
2. Open **Actions → Prepare SDK release PR → Run workflow**, choose `main` and
   `patch`, `minor`, or `major`. The workflow calculates the next version from
   the source manifest and opens a PR containing the version and changelog.
3. Review the normal CI checks and merge that PR. Merging is the release
   approval: publication needs no further npm login or environment approval.
4. The publishing workflow validates the exact release artifact, publishes it
   directly to npm with short-lived GitHub OIDC authentication and provenance,
   then creates `sdk-vX.Y.Z` and a GitHub Release with the same tarball/checksum.

```sh
gh workflow run sdk-prepare.yml --repo sellaro-net/ja3proxy --ref main -f bump=patch
```

Preparation does not force-push or bypass branch protection. Repeated preparation
links an existing open release PR; competing release PRs are rejected. Releases
are not stacked before the current version is public. No relevant SDK or shared
contract changes means no empty release. Rust-only deployment changes do not
automatically increment the SDK version.

The publication workflow also supports **Run workflow** for recovery. Release
source and artifact identity stay fixed across retries; published npm versions
are never overwritten. If npm succeeded before GitHub release completion failed,
recovery verifies the existing registry artifact and finishes the missing release
pieces rather than publishing another version.

One-time configuration:

- Install the private release GitHub App only on `sellaro-net/ja3proxy`, with
  **Contents: write** and **Pull requests: write**. Set repository variable
  `SDK_RELEASE_APP_CLIENT_ID` and Actions secret `SDK_RELEASE_APP_PRIVATE_KEY`. Its
  short-lived installation token lets bot PRs trigger ordinary CI without a
  personal token or main-protection bypass.
- Configure npm Trusted Publishing for organization `sellaro-net`, repository
  `ja3proxy`, workflow **`sdk-publish.yml`**, environment **`npm-production`**,
  allowing direct **`npm publish`**.
- Restrict the `npm-production` environment to the exact branch **`main`**, with
  no required reviewers or wait timer. Main's PR/CI protection is the approval
  boundary. Do not store `NPM_TOKEN` or `NODE_AUTH_TOKEN` in GitHub.

The SDK release pipeline is independent of Rust/GHCR version tags and does not
update or deploy SDK consumers. See the
[quality workflow](https://github.com/sellaro-net/ja3proxy/blob/main/.github/workflows/sdk-quality.yml)
for the supported-platform matrix and real-service checks.

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
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo test --all-features --locked
```

The pinned `wreq` dependency includes a connector patch for address and
cancellation ownership. Read its [provenance and refresh requirements](vendor/wreq/transport-provenance.json)
before updating it. Third-party code keeps its own license terms. The TypeScript
SDK has its own MIT grant; there is no repository-wide license grant for the Rust code.

## Project links

- [Source](https://github.com/sellaro-net/ja3proxy)
- [Pull requests](https://github.com/sellaro-net/ja3proxy/pulls)
- [Builds](https://github.com/sellaro-net/ja3proxy/actions/workflows/docker-build.yml)
- [Releases](https://github.com/sellaro-net/ja3proxy/releases)

Container images use `ghcr.io/sellaro-net/ja3proxy`. Deploy a verified image digest.
