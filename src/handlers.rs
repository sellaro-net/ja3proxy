//! Authenticated transport orchestration with bounded streaming in both directions.
use crate::{
    admission::{Admission, Ticket},
    auth::{self, PRINCIPAL},
    config::Config,
    contexts::{Context, ContextLimits, ContextStore, CookieCommand},
    emulation::{available_profiles, header_descriptors, parse_tls_profile},
    error::{ErrorCode, TransportError, from_wreq},
    models::{
        CookieMode, CreateContext, Delivery, Diagnostics, PartitionCommand, Phase, RequestMetadata,
        ResponseMetadata, valid_opaque,
    },
    network::{NetworkClient, NetworkPolicy},
    protocol::{self, FrameReader},
    registry::{ExecutionGuard, Registry, RequestRecord, ResponseGuard},
};
use axum::{
    Json,
    body::{Body, Bytes, to_bytes},
    extract::{Path, Request, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use futures_util::StreamExt;
use parking_lot::Mutex;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use std::{
    convert::Infallible,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Semaphore, mpsc};
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub policy: Arc<NetworkPolicy>,
    pub contexts: Arc<ContextStore>,
    pub admission: Arc<Admission>,
    pub registry: Arc<Registry>,
    pub envelopes: Arc<Semaphore>,
    capabilities: Bytes,
}
impl AppState {
    pub fn new(config: Config) -> Self {
        let policy = Arc::new(NetworkPolicy::new(config.allow_private_ips));
        Self {
            capabilities: capability_bytes(&config),
            contexts: Arc::new(ContextStore::new(ContextLimits::default(), policy.clone())),
            admission: Admission::new(&config),
            registry: Registry::new(config.registry_capacity, config.registry_ttl_ms),
            envelopes: Arc::new(Semaphore::new(config.max_envelopes)),
            policy,
            config: Arc::new(config),
        }
    }
}

pub async fn health_handler() -> Json<Value> {
    Json(json!({"status":"ok"}))
}

pub async fn capabilities_handler(State(state): State<AppState>) -> Response {
    (
        [(header::CONTENT_TYPE, "application/json")],
        state.capabilities,
    )
        .into_response()
}

fn capability_bytes(config: &Config) -> Bytes {
    let limits = ContextLimits::default();
    let capabilities = json!({
        "service":"ja3proxy","build":env!("CARGO_PKG_VERSION"),
        "profiles":available_profiles(),"headerDescriptors":header_descriptors(),
        "framing":{"contentType":protocol::CONTENT_TYPE,"maxMetadataBytes":protocol::MAX_METADATA_BYTES,
            "maxDataBytes":protocol::MAX_DATA_BYTES,"maxUploadFrames":protocol::MAX_UPLOAD_FRAMES},
        "limits":{"maxRequestBytes":config.max_request_body_size,
            "maxResponseBytes":config.max_response_body_size,"maxTimeoutMs":config.max_timeout_ms,
            "maxConcurrent":config.max_concurrent,"maxConcurrentPerPartition":config.max_concurrent_per_partition,
            "maxQueued":config.max_queued,"maxQueuedPerPartition":config.max_queued_per_partition,
            "maxEnvelopes":config.max_envelopes,"envelopeTimeoutMs":config.envelope_timeout_ms,
            "maxControlBytes":config.max_control_body_size,"maxHeaderBytes":32_768,"maxHeaders":256,
            "maxContexts":limits.max_contexts,"maxContextsPerPartition":limits.max_contexts_per_partition,
            "contextIdleTtlMs":limits.default_idle_ttl_ms,"contextMaxIdleTtlMs":limits.max_idle_ttl_ms,
            "contextMaxAgeMs":limits.max_age_ms,"maxCookies":limits.max_cookies,"maxCookieBytes":limits.max_cookie_bytes,
            "maxCookieSize":limits.max_cookie_size,"maxAllowedOrigins":limits.max_allowed_origins,
            "registryCapacity":config.registry_capacity,"registryTtlMs":config.registry_ttl_ms},
        "modes":{"egress":["direct","http","https","socks4","socks4a","socks5","socks5h"],
            "cookies":["external","managed"],"stream":["upload","download"],"cancel":["request","stream-drop"]}
    });
    Bytes::from(
        serde_json::to_vec(&capabilities).expect("Statische Fähigkeiten sind serialisierbar"),
    )
}

fn validate_metadata(metadata: &RequestMetadata, config: &Config) -> Result<(), TransportError> {
    if !valid_opaque(&metadata.request_id)
        || !valid_opaque(&metadata.partition)
        || metadata
            .context_id
            .as_deref()
            .is_some_and(|id| !valid_opaque(id))
        || metadata.context_id.is_some() == metadata.connection.is_some()
        || metadata.timeout_ms == 0
        || metadata.timeout_ms > config.max_timeout_ms
        || metadata.max_response_bytes == 0
        || metadata.max_response_bytes > config.max_response_body_size as u64
        || metadata.body_length.is_some_and(|length| {
            length > config.max_request_body_size as u64 || (!metadata.has_body && length != 0)
        })
        || metadata.headers.len() > 256
        || metadata.url.len() > 16_384
        || metadata
            .headers
            .iter()
            .try_fold(0usize, |n, (name, value)| {
                n.checked_add(name.len() + value.len())
            })
            .is_none_or(|n| n > 32_768)
    {
        return Err(TransportError::from_code(ErrorCode::InvalidRequest));
    }
    let method = wreq::Method::from_bytes(metadata.method.as_bytes())
        .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?;
    if method == wreq::Method::CONNECT || method == wreq::Method::TRACE {
        return Err(TransportError::from_code(ErrorCode::UnsupportedCapability));
    }
    if let Some(connection) = &metadata.connection {
        parse_tls_profile(&connection.identity.tls_profile)
            .map_err(|_| TransportError::from_code(ErrorCode::InvalidProfile))?;
    }
    Ok(())
}

pub async fn request_handler(
    State(state): State<AppState>,
    request: Request,
) -> Result<Response, TransportError> {
    let started = Instant::now();
    let envelope = state
        .envelopes
        .clone()
        .try_acquire_owned()
        .map_err(|_| TransportError::from_code(ErrorCode::Busy))?;
    let (parts, body) = request.into_parts();
    if parts
        .headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        != Some(protocol::CONTENT_TYPE)
        || parts.headers.contains_key(header::CONTENT_ENCODING)
    {
        return Err(TransportError::from_code(ErrorCode::InvalidRequest));
    }
    let mut reader = FrameReader::new(body);
    let metadata = tokio::time::timeout(
        Duration::from_millis(state.config.envelope_timeout_ms),
        reader.metadata(),
    )
    .await
    .map_err(|_| TransportError::from_code(ErrorCode::Timeout))??;
    validate_metadata(&metadata, &state.config)?;
    let diagnostics = Diagnostics {
        request_id: metadata.request_id.clone(),
        attempt: metadata.attempt,
        trace_id: auth::trace_id(&parts.headers),
        phase: Phase::Queued,
        delivery: Delivery::NotStarted,
        queue_ms: 0,
        headers_ms: None,
        body_ms: None,
        total_ms: started.elapsed().as_millis() as u64,
        request_bytes: 0,
        response_bytes: 0,
        tls_profile: metadata
            .connection
            .as_ref()
            .map(|connection| connection.identity.tls_profile.clone())
            .unwrap_or_default(),
        client_reused: None,
        context_id: metadata.context_id.clone(),
        cookie_revision: None,
    };
    let record = state
        .registry
        .register(PRINCIPAL, &metadata.partition, diagnostics, started)?;
    let ticket = match state
        .admission
        .enter(format!("{PRINCIPAL}:{}", metadata.partition))
    {
        Ok(ticket) => ticket,
        Err(error) => return Err(record.finish(Some(error)).error.unwrap()),
    };
    let queued = Instant::now();
    drop(envelope);
    let deadline =
        tokio::time::Instant::from_std(started) + Duration::from_millis(metadata.timeout_ms);
    let (sender, mut receiver) = mpsc::channel::<Bytes>(1);
    let terminal = Arc::new(Mutex::new(None));
    let terminal_out = terminal.clone();
    let worker_record = record.clone();
    let worker_guard = ExecutionGuard(worker_record.clone());
    tokio::spawn(async move {
        let _guard = worker_guard;
        let result = tokio::select! {
            biased;
            _ = worker_record.cancel.cancelled() => Err(TransportError::from_code(ErrorCode::Cancelled)),
            _ = tokio::time::sleep_until(deadline) => Err(TransportError::from_code(ErrorCode::Timeout)),
            result = execute(&state, metadata, reader, ticket, &sender, &worker_record, queued) => result,
        };
        worker_record.update(|diagnostics| {
            if let Some(headers_ms) = diagnostics.headers_ms {
                diagnostics.body_ms =
                    Some((started.elapsed().as_millis() as u64).saturating_sub(headers_ms));
            }
        });
        let status = worker_record.finish(result.err());
        tracing::info!(request_id = %status.diagnostics.request_id, trace_id = ?status.diagnostics.trace_id,
            attempt = status.diagnostics.attempt, phase = ?status.diagnostics.phase,
            delivery = ?status.diagnostics.delivery, total_ms = status.diagnostics.total_ms,
            request_bytes = status.diagnostics.request_bytes, response_bytes = status.diagnostics.response_bytes,
            code = ?status.error.as_ref().map(|error| error.code), "Transportversuch beendet");
        // A separate terminal slot cannot be blocked by a slow consumer's full data channel.
        // Dropping execute above has already released sockets, upload and admission resources.
        let bytes = match status.error {
            Some(error) => protocol::json_frame(4, &error),
            None => protocol::json_frame(3, &status.diagnostics),
        };
        if let Ok(bytes) = bytes {
            *terminal_out.lock() = Some(bytes);
        }
    });
    let guard = ResponseGuard::new(record);
    let stream = async_stream::stream! {
        let _guard = guard;
        while let Some(bytes) = receiver.recv().await { yield Ok::<_, Infallible>(bytes); }
        let final_frame = terminal.lock().take();
        if let Some(bytes) = final_frame { yield Ok::<_, Infallible>(bytes); }
    };
    let mut response = Response::new(Body::from_stream(stream));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        protocol::CONTENT_TYPE.parse().unwrap(),
    );
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    response
        .headers_mut()
        .insert("x-accel-buffering", "no".parse().unwrap());
    Ok(response)
}

enum ClientOwner {
    Context(Arc<Context>),
    Stateless(NetworkClient),
}
impl ClientOwner {
    fn client(&self) -> &NetworkClient {
        match self {
            Self::Context(context) => &context.client,
            Self::Stateless(client) => client,
        }
    }
    fn context(&self) -> Option<&Context> {
        match self {
            Self::Context(context) => Some(context),
            Self::Stateless(_) => None,
        }
    }
}

async fn execute(
    state: &AppState,
    metadata: RequestMetadata,
    reader: FrameReader,
    ticket: Ticket,
    sender: &mpsc::Sender<Bytes>,
    record: &Arc<RequestRecord>,
    queued: Instant,
) -> Result<(), TransportError> {
    let _permit = ticket.wait().await;
    record.update(|diagnostics| {
        diagnostics.queue_ms = queued.elapsed().as_millis() as u64;
        diagnostics.phase = Phase::Preparing;
    });
    let owner = if let Some(id) = &metadata.context_id {
        ClientOwner::Context(
            state
                .contexts
                .get(PRINCIPAL, &metadata.partition, id)
                .await?,
        )
    } else {
        ClientOwner::Stateless(
            NetworkClient::new(
                state.policy.clone(),
                metadata.connection.as_ref().unwrap().clone(),
            )
            .await?,
        )
    };
    let context_cancel = owner
        .context()
        .map(Context::cancellation_token)
        .unwrap_or_else(CancellationToken::new);
    record.update(|diagnostics| {
        if let Some(context) = owner.context() {
            diagnostics.tls_profile = context.spec.connection.identity.tls_profile.clone();
            diagnostics.client_reused = None;
        } else {
            diagnostics.client_reused = Some(false);
        }
    });
    tokio::select! {
        biased;
        _ = context_cancel.cancelled() => Err(TransportError::from_code(ErrorCode::ContextNotFound)),
        result = transfer(&owner, metadata, reader, sender, record, state.config.max_request_body_size) => result,
    }
}

async fn transfer(
    owner: &ClientOwner,
    metadata: RequestMetadata,
    reader: FrameReader,
    sender: &mpsc::Sender<Bytes>,
    record: &Arc<RequestRecord>,
    request_limit: usize,
) -> Result<(), TransportError> {
    let url = url::Url::parse(&metadata.url)
        .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?;
    let mut cookie_access = match owner.context() {
        Some(context) => {
            if context.spec.cookie_mode == CookieMode::Managed
                && metadata
                    .headers
                    .iter()
                    .any(|(name, _)| name.eq_ignore_ascii_case("cookie"))
            {
                return Err(TransportError::from_code(ErrorCode::ContextConflict));
            }
            context.cookie_access(&url).await?
        }
        None => None,
    };
    let method = wreq::Method::from_bytes(metadata.method.as_bytes())
        .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?;
    let builder = owner.client().request(method, &metadata.url).await?;
    let mut builder = owner.client().apply_headers(builder, &metadata.headers)?;
    if let Some(access) = &cookie_access {
        if let Some(cookies) = access.header() {
            builder = builder.header("cookie", cookies);
        }
        record.update(|diagnostics| diagnostics.cookie_revision = Some(access.revision()));
    }
    let (body_sender, body_receiver) = mpsc::channel::<Result<Bytes, TransportError>>(1);
    if metadata.has_body {
        let body = futures_util::stream::unfold(body_receiver, |mut receiver| async move {
            receiver.recv().await.map(|chunk| (chunk, receiver))
        });
        builder = builder.body(wreq::Body::wrap_stream(body));
        if let Some(length) = metadata.body_length {
            builder = builder.header("content-length", length);
        }
    } else {
        drop(body_receiver);
    }
    record.update(|diagnostics| {
        diagnostics.phase = Phase::Upstream;
        diagnostics.delivery = Delivery::PossiblySent;
    });
    let upstream = async {
        let response = builder.send().await.map_err(|error| from_wreq(&error))?;
        record.update(|diagnostics| {
            diagnostics.headers_ms = Some(record.started.elapsed().as_millis() as u64);
            diagnostics.delivery = Delivery::ResponseStarted;
        });
        Ok::<_, TransportError>(response)
    };
    let ((), response) = tokio::try_join!(
        reader.upload(
            body_sender,
            request_limit,
            metadata.has_body,
            metadata.body_length,
            record.clone()
        ),
        upstream
    )?;
    let cookie_revision = if let Some(access) = &mut cookie_access {
        Some(access.absorb(response.headers())?)
    } else {
        None
    };
    drop(cookie_access);
    record.update(|diagnostics| {
        diagnostics.phase = Phase::Body;
        diagnostics.cookie_revision = cookie_revision;
    });
    let bodyless = metadata.method == "HEAD" || matches!(response.status().as_u16(), 204 | 304);
    let headers = response_headers(response.headers(), bodyless)?;
    let response_metadata = ResponseMetadata {
        request_id: metadata.request_id,
        status: response.status().as_u16(),
        headers,
        diagnostics: record.diagnostics(),
        cookie_revision,
    };
    send(sender, protocol::json_frame(1, &response_metadata)?).await?;
    let mut body = response.bytes_stream();
    let mut count = 0u64;
    while let Some(chunk) = body.next().await {
        let chunk = chunk.map_err(|error| from_wreq(&error))?;
        count = count.saturating_add(chunk.len() as u64);
        record.update(|diagnostics| diagnostics.response_bytes = count);
        if count > metadata.max_response_bytes {
            return Err(TransportError::from_code(ErrorCode::BodyTooLarge));
        }
        for bytes in chunk.chunks(protocol::MAX_DATA_BYTES) {
            send(sender, protocol::frame(2, bytes)).await?;
        }
    }
    Ok(())
}

async fn send(sender: &mpsc::Sender<Bytes>, bytes: Bytes) -> Result<(), TransportError> {
    sender
        .send(bytes)
        .await
        .map_err(|_| TransportError::from_code(ErrorCode::Cancelled))
}

fn response_headers(
    headers: &wreq::header::HeaderMap,
    bodyless: bool,
) -> Result<Vec<(String, String)>, TransportError> {
    let connection_names: Vec<_> = headers
        .get_all("connection")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| {
            value
                .split(',')
                .map(|name| name.trim().to_ascii_lowercase())
        })
        .collect();
    let mut result = Vec::new();
    let mut size = 0usize;
    for (name, value) in headers {
        let name = name.as_str();
        if matches!(
            name,
            "transfer-encoding"
                | "connection"
                | "keep-alive"
                | "proxy-authenticate"
                | "proxy-authorization"
                | "te"
                | "trailer"
                | "upgrade"
        ) || connection_names.iter().any(|candidate| candidate == name)
        {
            continue;
        }
        // Decoders remove this header. Reject any unsupported coding rather than
        // advertising compressed bytes as decoded bytes under the response limit.
        if name == "content-encoding" && !bodyless {
            if value.as_bytes().eq_ignore_ascii_case(b"identity") {
                continue;
            }
            return Err(TransportError::from_code(ErrorCode::UnsupportedCapability));
        }
        size = size
            .saturating_add(name.len())
            .saturating_add(value.as_bytes().len());
        if size > 32_768 || result.len() >= 256 {
            return Err(TransportError::from_code(ErrorCode::ProtocolError));
        }
        // Fetch exposes HTTP field bytes as Latin-1, including valid obs-text.
        let value = match value.to_str() {
            Ok(value) => value.to_owned(),
            Err(_) => value.as_bytes().iter().copied().map(char::from).collect(),
        };
        result.push((name.to_owned(), value));
    }
    Ok(result)
}

async fn control<T: DeserializeOwned>(
    state: &AppState,
    request: Request,
) -> Result<(T, tokio::sync::OwnedSemaphorePermit), TransportError> {
    let permit = state
        .envelopes
        .clone()
        .try_acquire_owned()
        .map_err(|_| TransportError::from_code(ErrorCode::Busy))?;
    if request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        != Some("application/json")
        || request.headers().contains_key(header::CONTENT_ENCODING)
    {
        return Err(TransportError::from_code(ErrorCode::InvalidRequest));
    }
    let bytes = tokio::time::timeout(
        Duration::from_millis(state.config.envelope_timeout_ms),
        to_bytes(request.into_body(), state.config.max_control_body_size),
    )
    .await
    .map_err(|_| TransportError::from_code(ErrorCode::Timeout))?
    .map_err(|_| TransportError::from_code(ErrorCode::BodyTooLarge))?;
    let command = serde_json::from_slice(&bytes)
        .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?;
    Ok((command, permit))
}

pub async fn create_context_handler(
    State(state): State<AppState>,
    request: Request,
) -> Result<Response, TransportError> {
    let (command, _permit): (CreateContext, _) = control(&state, request).await?;
    let info = tokio::time::timeout(
        Duration::from_millis(state.config.max_timeout_ms),
        state.contexts.create(PRINCIPAL, command),
    )
    .await
    .map_err(|_| TransportError::from_code(ErrorCode::Timeout))??;
    Ok((StatusCode::CREATED, Json(info)).into_response())
}
pub async fn close_context_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Result<StatusCode, TransportError> {
    let (command, _permit): (PartitionCommand, _) = control(&state, request).await?;
    validate_scope(&id, &command.partition)?;
    tokio::time::timeout(
        Duration::from_millis(state.config.max_timeout_ms),
        state.contexts.close(PRINCIPAL, &command.partition, &id),
    )
    .await
    .map_err(|_| TransportError::from_code(ErrorCode::Timeout))??;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn cookies_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Result<Response, TransportError> {
    if !valid_opaque(&id) {
        return Err(TransportError::from_code(ErrorCode::InvalidRequest));
    }
    let (command, _permit): (CookieCommand, _) = control(&state, request).await?;
    let reply = tokio::time::timeout(
        Duration::from_millis(state.config.max_timeout_ms),
        state.contexts.cookies(PRINCIPAL, &id, command),
    )
    .await
    .map_err(|_| TransportError::from_code(ErrorCode::Timeout))??;
    Ok(Json(reply).into_response())
}
fn validate_scope(id: &str, partition: &str) -> Result<(), TransportError> {
    if !valid_opaque(id) || !valid_opaque(partition) {
        return Err(TransportError::from_code(ErrorCode::InvalidRequest));
    }
    Ok(())
}
pub async fn cancel_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Result<Response, TransportError> {
    let (command, _permit): (PartitionCommand, _) = control(&state, request).await?;
    validate_scope(&id, &command.partition)?;
    let record = state.registry.get(PRINCIPAL, &command.partition, &id)?;
    record.cancel.cancel();
    Ok(Json(record.status()).into_response())
}
pub async fn status_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Result<Response, TransportError> {
    let (command, _permit): (PartitionCommand, _) = control(&state, request).await?;
    validate_scope(&id, &command.partition)?;
    Ok(Json(
        state
            .registry
            .get(PRINCIPAL, &command.partition, &id)?
            .status(),
    )
    .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, routing::get};
    use std::io::Write;

    #[test]
    fn preserves_bodyless_representation_headers_and_obs_text() {
        let mut headers = wreq::header::HeaderMap::new();
        headers.insert("content-length", "7".parse().unwrap());
        headers.insert(
            "content-disposition",
            wreq::header::HeaderValue::from_bytes(b"inline; filename=M\xfcller.txt").unwrap(),
        );
        let fields = response_headers(&headers, true).unwrap();
        assert!(fields.contains(&("content-length".to_owned(), "7".to_owned())));
        assert!(fields.contains(&(
            "content-disposition".to_owned(),
            "inline; filename=Müller.txt".to_owned(),
        )));
    }

    struct Server {
        address: std::net::SocketAddr,
        task: tokio::task::JoinHandle<()>,
    }
    impl Drop for Server {
        fn drop(&mut self) {
            self.task.abort();
        }
    }
    async fn spawn(app: Router) -> Server {
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Server { address, task }
    }
    #[tokio::test]
    async fn total_deadline_cancels_queued_work_before_delivery() {
        let mut config = Config::for_test();
        config.max_concurrent = 1;
        let state = AppState::new(config);
        let blocker = state
            .admission
            .enter("blocker".into())
            .unwrap()
            .wait()
            .await;
        let output = frames(
            request_handler(
                State(state.clone()),
                envelope("http://127.0.0.1:1/".into(), "queued-timeout", 1024, 20),
            )
            .await
            .unwrap(),
        )
        .await;
        let error: TransportError = serde_json::from_slice(&output.last().unwrap().1).unwrap();
        assert_eq!(error.code, ErrorCode::Timeout);
        let diagnostics = error.diagnostics.unwrap();
        assert_eq!(diagnostics.phase, Phase::Queued);
        assert_eq!(diagnostics.delivery, Delivery::NotStarted);
        drop(blocker);
        let _next = tokio::time::timeout(
            Duration::from_secs(1),
            state
                .admission
                .enter("after-timeout".into())
                .unwrap()
                .wait(),
        )
        .await
        .unwrap();
    }

    fn envelope(url: String, id: &str, maximum: u64, timeout_ms: u64) -> Request {
        let metadata = json!({
            "requestId":id,"partition":"test-partition","url":url,"method":"GET",
            "connection":{"egress":{"mode":"direct"},"identity":{"tlsProfile":"chrome_120","emulateHeaders":false}},
            "headers":[],"hasBody":false,"timeoutMs":timeout_ms,"maxResponseBytes":maximum,"attempt":0
        });
        let mut bytes = protocol::json_frame(1, &metadata).unwrap().to_vec();
        bytes.extend_from_slice(&protocol::frame(3, &[]));
        Request::builder()
            .method("POST")
            .uri("/request")
            .header(header::CONTENT_TYPE, protocol::CONTENT_TYPE)
            .body(Body::from(bytes))
            .unwrap()
    }
    async fn frames(response: Response) -> Vec<(u8, Vec<u8>)> {
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        let mut result = Vec::new();
        let mut offset = 0;
        while offset < bytes.len() {
            assert!(bytes.len() - offset >= 5);
            let length =
                u32::from_be_bytes(bytes[offset + 1..offset + 5].try_into().unwrap()) as usize;
            assert!(length <= protocol::MAX_METADATA_BYTES && offset + 5 + length <= bytes.len());
            result.push((
                bytes[offset],
                bytes[offset + 5..offset + 5 + length].to_vec(),
            ));
            offset += 5 + length;
        }
        assert_eq!(
            result
                .iter()
                .filter(|(kind, _)| *kind == 3 || *kind == 4)
                .count(),
            1
        );
        assert!(matches!(result.last().unwrap().0, 3 | 4));
        result
    }

    #[tokio::test]
    async fn preserves_redirects_repeated_headers_and_bodyless_requests() {
        let upstream = spawn(
            Router::new()
                .route(
                    "/redirect",
                    get(|request: Request| async move {
                        assert!(!request.headers().contains_key("transfer-encoding"));
                        assert!(!request.headers().contains_key("content-length"));
                        (
                            StatusCode::FOUND,
                            axum::response::AppendHeaders([
                                ("location", "/final"),
                                ("set-cookie", "a=1"),
                                ("set-cookie", "b=2"),
                            ]),
                        )
                    }),
                )
                .route("/final", get(|| async { "followed" })),
        )
        .await;
        let state = AppState::new(Config::for_test());
        let output = frames(
            request_handler(
                State(state),
                envelope(
                    format!("http://{}/redirect", upstream.address),
                    "redirect",
                    1024,
                    5000,
                ),
            )
            .await
            .unwrap(),
        )
        .await;
        let metadata: Value = serde_json::from_slice(&output[0].1).unwrap();
        assert_eq!(metadata["status"], 302);
        let headers = metadata["headers"].as_array().unwrap();
        assert!(headers.contains(&json!(["location", "/final"])));
        assert_eq!(
            headers
                .iter()
                .filter(|pair| pair[0] == "set-cookie")
                .count(),
            2
        );
        assert_eq!(output.last().unwrap().0, 3);
    }

    #[tokio::test]
    async fn decoded_response_limit_terminates_a_compressed_expansion() {
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&[b'x'; 4096]).unwrap();
        let compressed = encoder.finish().unwrap();
        let upstream = spawn(Router::new().route(
            "/",
            get(move || {
                let compressed = compressed.clone();
                async move { ([(header::CONTENT_ENCODING, "gzip")], compressed) }
            }),
        ))
        .await;
        let output = frames(
            request_handler(
                State(AppState::new(Config::for_test())),
                envelope(
                    format!("http://{}/", upstream.address),
                    "compressed",
                    8,
                    5000,
                ),
            )
            .await
            .unwrap(),
        )
        .await;
        let error: TransportError = serde_json::from_slice(&output.last().unwrap().1).unwrap();
        assert_eq!(error.code, ErrorCode::BodyTooLarge);
        assert_eq!(
            error.diagnostics.unwrap().delivery,
            Delivery::ResponseStarted
        );
        assert!(
            output
                .iter()
                .filter(|(kind, _)| *kind == 2)
                .map(|(_, bytes)| bytes.len())
                .sum::<usize>()
                <= 8
        );
    }

    #[tokio::test]
    async fn dropping_an_unpolled_response_cancels_scoped_work() {
        let state = AppState::new(Config::for_test());
        let response = request_handler(
            State(state.clone()),
            envelope("http://127.0.0.1:1/".into(), "dropped", 1024, 5000),
        )
        .await
        .unwrap();
        let record = state
            .registry
            .get(PRINCIPAL, "test-partition", "dropped")
            .unwrap();
        drop(response);
        assert!(record.cancel.is_cancelled());
        let status = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                let status = record.status();
                if matches!(status.state, "failed" | "complete") {
                    break status;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert_eq!(status.error.unwrap().code, ErrorCode::Cancelled);
        assert_eq!(status.diagnostics.delivery, Delivery::NotStarted);
        assert!(
            matches!(state.registry.get(PRINCIPAL, "other-partition", "dropped"),
            Err(error) if error.code == ErrorCode::ContextNotFound)
        );
    }

    #[tokio::test]
    async fn every_api_route_and_unknown_path_requires_the_dedicated_bearer() {
        let state = AppState::new(Config::for_test());
        let token = state.config.token.clone();
        let server = spawn(crate::router(state)).await;
        let client = wreq::Client::builder().no_proxy().build().unwrap();
        for (method, path) in [
            (wreq::Method::GET, "/capabilities"),
            (wreq::Method::POST, "/request"),
            (wreq::Method::POST, "/contexts"),
            (wreq::Method::DELETE, "/contexts/test"),
            (wreq::Method::POST, "/contexts/test/cookies"),
            (wreq::Method::DELETE, "/requests/test"),
            (wreq::Method::POST, "/requests/test/status"),
            (wreq::Method::GET, "/not-found"),
        ] {
            let response = client
                .request(method, format!("http://{}{path}", server.address))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status().as_u16(), 401);
        }
        let response = client
            .get(format!("http://{}/health", server.address))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), 200);
        let response = client
            .get(format!("http://{}/capabilities", server.address))
            .bearer_auth(&token)
            .send()
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), 200);
        let capabilities: Value = response.json().await.unwrap();
        assert_eq!(capabilities["service"], "ja3proxy");
        assert_eq!(
            capabilities["framing"]["contentType"],
            protocol::CONTENT_TYPE
        );
        let response = client
            .get(format!("http://{}/not-found", server.address))
            .bearer_auth(token)
            .send()
            .await
            .unwrap();
        let error: TransportError = response.json().await.unwrap();
        assert_eq!(error.code, ErrorCode::UnsupportedCapability);
    }
}
