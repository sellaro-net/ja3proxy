# Dependencies

## wreq fork

`wreq` resolves to the fork [sellaro-net/wreq](https://github.com/sellaro-net/wreq),
branch `chrome-parity`, pinned by commit in `[patch.crates-io]` of `Cargo.toml`.
The branch is upstream [0x676e67/wreq](https://github.com/0x676e67/wreq) `main` at
`99566caee8fd97f630b31be55ce90bedf32122d8` plus one commit per patch:

| Commit | Change | Why the service needs it |
|---|---|---|
| `66aa85c` feat(connect): add resolver-enforced egress | `ClientBuilder::resolver_enforced_egress` | The guarded resolver approves every socket address, including IP literals. HTTP proxies are tunneled with numeric `CONNECT` targets, SOCKS proxies get locally approved numeric targets, without forward-proxy fallback. Host, SNI and certificate verification keep the request authority. |
| `f3b8142` feat(decoder): add auto_accept_encoding option | `ClientBuilder::auto_accept_encoding` | Without header emulation the caller's headers go out unchanged (no generated `Accept-Encoding`, no Range rewrite) while responses are still decoded. |
| `40e1053` fix(socks): expose error sources and select IPv4 answers for SOCKS4 | `SocksError::source`, IPv4 selection | Errors are classified by type, never by message text; SOCKS4 uses an IPv4 address from the validated answer. |
| `ebfd6a8` feat(socks): send the proxy username as SOCKS4 user ID | SOCKS4 user ID | SOCKS4 proxy URLs with a user ID authenticate as documented. |
| `d628e51` fix(tunnel): bound the CONNECT response head to 16 KiB | `CONNECT` response limit | An untrusted proxy cannot make the service buffer an unbounded response head. |
| `68be7d5` fix(pool): honor a never-retry policy in the connection pool | `retry::Policy::never()` reaches the pool | No transparent retries; a losing speculative connection is dropped, so sockets, proxy credentials and pool references stay owned by their request/context. |
| `0689b69` feat(tls): add server_padding_request option | `TlsOptions::server_padding_request` | ClientHello parity with Chrome 154+ (`server_padding` extension `0x12e0`). Trust anchor IDs and signature-algorithm GREASE come from upstream `main`. |
| `1aa7226` feat(http2): add per-request HEADERS priority | `RequestBuilder::headers_priority` | Chrome's HEADERS weight per request urgency (`chrome_154`, `chrome_155`). |

The service keeps Mozilla roots: `wreq` is used with `default-features = false` and
the `webpki-roots` feature (upstream `main` defaults to `chromium-roots`).

## Upstream pins without a fork

Only `wreq` carries patches, so only `wreq` has a fork. Dependencies that need an
unreleased upstream state are pinned to the upstream repository by commit:

| Crate | Source | Why |
|---|---|---|
| `http2` | [0x676e67/http2](https://github.com/0x676e67/http2) `bdb2c60cd9b4125c28913191b6f758d00e5f136c` (`master`) | `http2::ext::HeadersPriority` (per-request HEADERS priority) is not in a crates.io release yet (latest: 0.5.20). |
| `btls`, `btls-sys`, `tokio-btls` | [0x676e67/btls](https://github.com/0x676e67/btls) `1e980877343872b671d18a185395e31c10cc51d5` | ML-DSA in the TLS signature-algorithm catalog and the `server_padding` API are not released yet. |

The fork pins the same `http2` commit in its own `[patch.crates-io]`, so its tests
run against the code the service ships. Fork a dependency only when it needs a
change of its own; an unchanged fork adds maintenance without isolating anything
a commit pin does not.

## Updating

1. **wreq fork:** rebase the fork branch onto the new upstream `main` (drop patches
   upstream has absorbed) and run its `cargo test` and
   `cargo clippy --all-targets -- -D warnings`.
2. **Upstream pins:** move `http2`/`btls` to the new upstream commit, or to a
   crates.io release once one contains the required API (`http2`:
   `ext::HeadersPriority`; `btls`: `server_padding` and the ML-DSA signature
   algorithms). Keep the fork's own `[patch.crates-io]` on the same `http2` commit.
3. Set the new commits in `[patch.crates-io]` here, update `Cargo.lock`
   (`cargo update -p wreq -p http2`) and update the tables above.
4. Run `cargo test --locked` here, including the golden wire tests
   (`src/network/golden.rs`, `src/emulation/tests.rs`) and the address, proxy,
   pooling and cancellation regressions (`src/network/tests.rs`,
   `src/validation.rs`).
5. Build the image and compare its TLS/HTTP/2 fingerprints with the previous
   image before release.
