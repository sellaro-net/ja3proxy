# syntax=docker/dockerfile:1.27.0@sha256:bde3983e9c939224420ddaf6b784cc30e09b035a4dea01f581230c50809f372e
FROM rust:1.98.0-trixie@sha256:620dbcd124499c59e2406d3741574b5c5838cf9eb9656f0c3a03948f79b02959 AS builder
ARG TARGETARCH

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    golang \
    libclang-dev \
    && rm -rf /var/lib/apt/lists/*

# Use the project compiler even when official image publication lags Rust releases.
COPY rust-toolchain.toml ./
RUN rustup show active-toolchain

COPY Cargo.toml Cargo.lock ./
COPY vendor ./vendor
COPY src ./src
# Compile the real source once. A cached dummy main must never become the
# shipped executable; target caches remain isolated between architectures.
RUN --mount=type=cache,id=ja3proxy-registry,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,id=ja3proxy-target-trixie-${TARGETARCH},target=/app/target,sharing=locked \
    cargo build --release --locked \
    && cp /app/target/release/ja3proxy /ja3proxy

FROM debian:trixie-slim@sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -s /bin/false ja3proxy

# Runtime code is root-owned; the service user can execute but not replace it.
COPY --from=builder --chmod=0555 /ja3proxy /usr/local/bin/ja3proxy
USER ja3proxy

EXPOSE 8080
ENV PORT=8080 \
    LOG_LEVEL=info \
    MAX_CONCURRENT=100 \
    MAX_CONCURRENT_PER_PARTITION=4 \
    MAX_QUEUED=256 \
    MAX_QUEUED_PER_PARTITION=16 \
    MAX_REQUEST_BODY_SIZE=10485760 \
    MAX_RESPONSE_BODY_SIZE=52428800 \
    MAX_TIMEOUT_MS=120000 \
    ENVELOPE_TIMEOUT_MS=5000 \
    ALLOW_PRIVATE_IPS=false

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["ja3proxy"]
