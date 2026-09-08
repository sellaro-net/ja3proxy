# Changelog

Only `@sellaro/ja3proxy` SDK releases are recorded here. SDK tags use `sdk-v*`;
Rust image releases have a separate lifecycle. Subsequent entries summarize SDK
and shared wire-contract commits since the previous SDK tag.

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
