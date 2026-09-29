# Agent guide

Rules for changing ja3proxy. [README.md](README.md) explains the service,
[docs/api.md](docs/api.md) the wire contract, [docs/dependencies.md](docs/dependencies.md)
the pinned dependencies.

## Map

| Path | Content |
|---|---|
| `src/emulation.rs`, `src/emulation/chrome.rs` | Profile registry, Chrome profiles above `wreq-util`, header-order templates, per-request priority |
| `src/emulation/golden/` | Sanitized captures of real Chrome (the reference for the golden tests) |
| `src/network.rs`, `src/network/golden.rs` | Client construction, header application; loopback golden tests for ClientHello and HTTP/2 frames |
| `src/validation.rs`, `src/network/tests.rs` | Address, proxy, pooling and cancellation guarantees |
| `src/models.rs`, `contracts/` | Wire DTOs (source of truth) and the exported schemas/fixtures |
| `packages/typescript/` | `@sellaro/ja3proxy` SDK, generated types and validators |
| `.github/workflows/chrome-freshness.yml` | Weekly check of Chrome stable against the newest profile |

## Build and checks

Native builds need CMake, Go, Clang and a C/C++ toolchain. Without them use the
`builder` stage of the `Dockerfile`:

```sh
docker build --target builder -t ja3proxy-builder .
docker run --rm -v "$PWD":/src -w /src ja3proxy-builder cargo test --all-features --locked
```

Before a change is done, all of these pass:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo test --all-features --locked
pnpm contracts:generate && git diff --exit-code contracts packages/typescript/src/generated
pnpm contracts:check
```

Changed DTOs in `src/models.rs` require regenerated contracts in the same change.

## Invariants

- **Existing profiles never change on the wire.** A profile's ClientHello,
  HTTP/2 frames, default headers and order are a public contract. Fix or improve
  by adding a new profile; the golden tests guard the old ones.
- **`headerOrder` defaults to `caller`.** Without the field, headers go out byte
  for byte in caller order. Browser ordering is opt-in per request.
- **Egress is explicit.** No implicit direct fallback, no automatic retries or
  redirects, no private targets unless `ALLOW_PRIVATE_IPS` is set. Do not weaken
  the resolver-enforced egress or the SSRF checks at the socket boundary.
- **Errors are typed.** Classify by error type and source chain, never by message text.

## Dependencies

- Fork only what needs a change of its own. `wreq` is forked
  ([sellaro-net/wreq](https://github.com/sellaro-net/wreq), branch `chrome-parity`):
  one commit per patch on top of upstream, each with a test.
- Unreleased upstream state without own changes is pinned to the upstream
  repository by commit (`http2`, `btls`). Replace pins with crates.io releases
  once they contain the needed API.
- Updating follows [docs/dependencies.md](docs/dependencies.md#updating) and ends
  with an unchanged golden run.

## Adding a Chrome profile

1. **Capture real Chrome** of the new version (e.g. Chrome for Testing) against a
   fingerprint echo: a cold navigation (fresh user data dir, no prior connection,
   otherwise `pre_shared_key` changes the JA4), a `fetch` GET, a `fetch` POST with
   an application header, an image. Headless Chrome places `accept-language`
   early; headed Chrome sends it after `accept-encoding`. Keep the headed order and
   record the difference.
2. **Sanitize** before committing: drop client IPs and anything else that
   identifies the capturing machine; keep only what the tests assert.
3. **Implement** the profile next to the existing Chrome profiles: TLS options
   (extensions, signature algorithms, groups), HTTP/2 settings, header template,
   default headers derived from the major version (`sec-ch-ua` GREASE brand).
4. **Prove it**: the golden tests for the new fixture pass, all existing profiles
   stay identical, and a live request through a built image to the echo matches
   the capture (JA4, HTTP/2 fingerprint, header order, weight).
5. Move `chrome_stable` only after that, and update [docs/api.md](docs/api.md#profiles).

## Public repository

Commit messages, PR texts, comments, test names and fixtures are technical and
neutral. They do not name customers, target sites, deployments or incidents, and
they never contain tokens, proxy credentials, cookies or captured personal data.
