# Changelog

Only `@sellaro/ja3proxy` SDK releases are recorded here. SDK tags use `sdk-v*`;
Rust image releases have a separate lifecycle. Subsequent entries summarize SDK
and shared wire-contract commits since the previous SDK tag.

## [1.1.0](https://github.com/sellaro-net/ja3proxy/compare/sdk-v1.0.1...sdk-v1.1.0)

- SDK: observer references on results and errors \(\#37\) ([f8bd3c4](https://github.com/sellaro-net/ja3proxy/commit/f8bd3c43414c9bd99d5b984c8907018e45a44e4c))
- build\(deps\): pin http2 to upstream without a fork; document browser fidelity and add AGENTS.md \(\#36\) ([ce7507a](https://github.com/sellaro-net/ja3proxy/commit/ce7507a6664582a1ee7fd5d871b4b14de256fcfd))
- Chrome 154/155 profiles, chrome\_stable alias, browser header order; wreq/http2 from forks \(\#35\) ([02daf3a](https://github.com/sellaro-net/ja3proxy/commit/02daf3adf9c354b107ed8496bc02b38fd37e3089))
- feat\(emulation\): Profil chrome\_150 mit ML-DSA-Signaturalgorithmen \(btls mit ML-DSA im TLS-Katalog\) \(\#33\) ([89bf273](https://github.com/sellaro-net/ja3proxy/commit/89bf2737d473e24c80e22639040ec8a28b7ad49a))
- Merge pull request \#30 from sellaro-net/ja3-trace-bridge ([d2abe4c](https://github.com/sellaro-net/ja3proxy/commit/d2abe4cc924acdc4b58fa5ac699e5d591b296bbc))

[Reviewed source changes](https://github.com/sellaro-net/ja3proxy/compare/sdk-v1.0.1...f8bd3c43414c9bd99d5b984c8907018e45a44e4c)

## [1.0.1](https://github.com/sellaro-net/ja3proxy/compare/sdk-v1.0.0...sdk-v1.0.1)

- feat\(release\): automate reviewed SDK releases with npm OIDC \(\#19\) ([d052b86](https://github.com/sellaro-net/ja3proxy/commit/d052b86275fad0d578b648047b205ca1b0b7ff51))

[Reviewed source changes](https://github.com/sellaro-net/ja3proxy/compare/sdk-v1.0.0...d052b86275fad0d578b648047b205ca1b0b7ff51)

## [1.0.0](https://github.com/sellaro-net/ja3proxy/tree/sdk-v1.0.0)

Initial public, MIT-licensed SDK for Node.js 22.14 or newer, with no npm runtime
dependencies. The MIT grant applies to the SDK, not the Rust repository.

- Async buffered requests and framed streaming with explicit terminal completion,
  bounded response sizes, cancellation, and a shared total deadline.
- A closeable fetch adapter and owned sessions with managed cookies, revision-checked
  imports, identity rebinding, and bounded draining.
- A synchronous Worker/Atomics bridge with bounded IPC and ordered `requestMany()`
  results, exposed separately as `@sellaro/ja3proxy/sync`.
- ESM and CommonJS exports with TypeScript declarations, generated Rust DTO
  validators, shared contract fixtures, and real-service package interoperability.

[Released source](https://github.com/sellaro-net/ja3proxy/commit/34c39e02a879255943e931b5cca30107aa36316f).
