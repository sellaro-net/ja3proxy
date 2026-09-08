//! JA3Proxy transport v2: dedicated authentication and explicit isolated egress.
mod admission;
mod auth;
mod config;
mod contexts;
mod emulation;
mod error;
mod handlers;
mod models;
mod network;
mod protocol;
mod registry;
mod validation;

use crate::{
    config::Config,
    error::{ErrorCode, TransportError},
    handlers::*,
};
use axum::{
    Router, middleware,
    routing::{delete, get, post},
};
use std::{net::SocketAddr, time::Duration};
use tokio::{net::TcpListener, signal};
use tokio_util::sync::CancellationToken;
use tracing::info;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

pub fn router(state: AppState) -> Router {
    let v2 = Router::new()
        .route("/capabilities", get(capabilities_handler))
        .route("/request", post(request_handler))
        .route("/contexts", post(create_context_handler))
        .route("/contexts/{id}", delete(close_context_handler))
        .route("/contexts/{id}/cookies", post(cookies_handler))
        .route("/requests/{id}", delete(cancel_handler))
        .route("/requests/{id}/status", post(status_handler))
        .fallback(|| async { TransportError::from_code(ErrorCode::UnsupportedCapability) })
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::authenticate,
        ));
    Router::new()
        .route("/health", get(health_handler))
        .nest("/v2", v2)
        .with_state(state)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env()?;
    let level = config
        .log_level
        .parse::<tracing::level_filters::LevelFilter>()
        .map_err(|_| anyhow::anyhow!("LOG_LEVEL ist ungültig."))?;
    // Backend trace/debug events may contain credential-bearing URLs or headers.
    // Only this crate's deliberately safe structured events are enabled.
    let filter = EnvFilter::new(format!("off,ja3proxy={level}"));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer())
        .init();
    let address = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!(
        version = env!("CARGO_PKG_VERSION"),
        max_concurrent = config.max_concurrent,
        max_queued = config.max_queued,
        allow_private_ips = config.allow_private_ips,
        "JA3Proxy transport v2 wird gestartet"
    );
    let state = AppState::new(config);
    let listener = TcpListener::bind(address).await?;
    let stop = CancellationToken::new();
    let cleanup_stop = stop.clone();
    let cleanup_state = state.clone();
    let cleanup = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        loop {
            tokio::select! {
                _ = cleanup_stop.cancelled() => break,
                _ = interval.tick() => {
                    cleanup_state.contexts.cleanup().await;
                    cleanup_state.registry.cleanup();
                }
            }
        }
    });
    let shutdown_state = state.clone();
    let result = axum::serve(listener, router(state))
        .with_graceful_shutdown(async move {
            shutdown_signal().await;
            shutdown_state.registry.shutdown();
            shutdown_state.contexts.shutdown().await;
        })
        .await;
    stop.cancel();
    let _ = cleanup.await;
    result?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Signalhandler konnte nicht installiert werden");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Signalhandler konnte nicht installiert werden")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
    info!("Dienst wird beendet");
}
