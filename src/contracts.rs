//! Opt-in, credential-independent exports from the DTOs used by the running service.
//! Raw schemas describe Rust serde. The JS generator separately narrows integer ranges
//! to Number's exact range; this is deliberately not presented as a Rust restriction.

use crate::{
    config::Config,
    contexts::cookies::{CookieCommand, CookieRecord, CookieReply, CookieSameSite, CookieSnapshot},
    error::{ErrorCode, TransportError},
    handlers,
    models::{
        BrowserIdentity, Capabilities, ConnectionSpec, ContextInfo, CookieMode, CreateContext,
        Delivery, Diagnostics, Egress, Phase, RequestMetadata, ResponseMetadata,
    },
    registry::{RequestState, RequestStatus},
};
use schemars::{JsonSchema, generate::SchemaSettings};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use std::{collections::BTreeMap, env, fs, path::PathBuf};

const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

type Accepts = fn(Value) -> bool;

struct Contract {
    name: &'static str,
    type_name: &'static str,
    direction: &'static str,
    schema: Value,
    accepts: Accepts,
}

fn contract<T: JsonSchema + DeserializeOwned>(
    name: &'static str,
    type_name: &'static str,
    incoming: bool,
) -> Contract {
    let settings = SchemaSettings::draft07();
    let settings = if incoming {
        settings.for_deserialize()
    } else {
        settings.for_serialize()
    };
    let mut schema = settings
        .into_generator()
        .into_root_schema_for::<T>()
        .to_value();
    // A stable document identity and public root name, not a second shape definition.
    schema["$id"] = json!(format!(
        "https://ja3proxy.invalid/contracts/{name}.schema.json"
    ));
    schema["title"] = json!(type_name);
    Contract {
        name,
        type_name,
        direction: if incoming { "deserialize" } else { "serialize" },
        schema,
        accepts: |value| serde_json::from_value::<T>(value).is_ok(),
    }
}

fn contracts() -> Vec<Contract> {
    vec![
        contract::<RequestMetadata>("requestMetadata", "RequestMetadata", true),
        contract::<ResponseMetadata>("responseMetadata", "ResponseMetadata", false),
        contract::<Diagnostics>("diagnostics", "Diagnostics", false),
        contract::<TransportError>("transportError", "TransportError", false),
        contract::<ContextInfo>("contextInfo", "ContextInfo", false),
        // These same DTOs enter through cookie import; describe their accepted input.
        contract::<CookieRecord>("cookieRecord", "CookieRecord", true),
        contract::<CookieSnapshot>("cookieSnapshot", "CookieSnapshot", true),
        contract::<Capabilities>("capabilities", "Capabilities", false),
        contract::<CreateContext>("createContext", "CreateContext", true),
        contract::<CookieCommand>("cookieOperation", "CookieOperation", true),
        contract::<CookieReply>("cookieReply", "CookieReply", false),
        contract::<RequestStatus>("requestStatus", "RequestStatus", false),
    ]
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Fixture {
    name: String,
    contract: &'static str,
    value: Value,
    valid: bool,
    rust_accepts: bool,
    reason: &'static str,
}

fn fixture(
    contracts: &[Contract],
    name: impl Into<String>,
    contract: &'static str,
    value: Value,
    valid: bool,
    rust_accepts: bool,
    reason: &'static str,
) -> Fixture {
    let definition = contracts
        .iter()
        .find(|definition| definition.name == contract)
        .unwrap();
    let actual = (definition.accepts)(value.clone());
    assert_eq!(
        actual, rust_accepts,
        "Rust fixture drift for {contract}: {reason}"
    );
    Fixture {
        name: name.into(),
        contract,
        value,
        valid,
        rust_accepts: actual,
        reason,
    }
}

fn diagnostics() -> Diagnostics {
    Diagnostics {
        request_id: "contract-request".into(),
        attempt: 1,
        trace_id: None,
        phase: Phase::Complete,
        delivery: Delivery::ResponseStarted,
        queue_ms: 2,
        headers_ms: Some(8),
        body_ms: Some(3),
        total_ms: 13,
        request_bytes: 0,
        response_bytes: 4,
        tls_profile: "chrome_133".into(),
        client_reused: Some(false),
        context_id: Some("contract-context".into()),
        cookie_revision: Some(2),
    }
}

fn fixtures(contracts: &[Contract]) -> Vec<Fixture> {
    let identity = BrowserIdentity {
        tls_profile: "chrome_133".into(),
        emulate_headers: false,
        user_agent: None,
    };
    let connection = ConnectionSpec {
        egress: Egress::Direct,
        identity: identity.clone(),
    };
    let request = RequestMetadata {
        request_id: "contract-request".into(),
        partition: "contract-partition".into(),
        context_id: None,
        connection: Some(connection.clone()),
        url: "https://example.com/".into(),
        method: "GET".into(),
        headers: vec![],
        has_body: false,
        body_length: Some(0),
        timeout_ms: 5_000,
        max_response_bytes: 1_024,
        attempt: 1,
    };
    let response = ResponseMetadata {
        request_id: "contract-request".into(),
        status: 200,
        headers: vec![
            ("content-type".into(), "text/plain".into()),
            ("set-cookie".into(), "a=1; Path=/; Secure".into()),
            ("set-cookie".into(), "b=2; Path=/; Secure".into()),
        ],
        diagnostics: diagnostics(),
        cookie_revision: Some(2),
    };
    let context = ContextInfo {
        context_id: "contract-context".into(),
        partition: "contract-partition".into(),
        expires_at_ms: 1_800_000_000_000,
        revision: 2,
        cookie_mode: CookieMode::Managed,
        identity: identity.clone(),
    };
    let cookie = CookieRecord {
        name: "session".into(),
        value: "fixture-value".into(),
        domain: "example.com".into(),
        path: "/".into(),
        secure: true,
        http_only: true,
        host_only: true,
        partitioned: false,
        same_site: Some(CookieSameSite::Lax),
        expires_at_ms: None,
    };
    let snapshot = CookieSnapshot {
        partition_key: "https://example.com".into(),
        cookies: vec![cookie.clone()],
    };
    let create = CreateContext {
        partition: "contract-partition".into(),
        connection,
        cookie_mode: CookieMode::Managed,
        allowed_origins: vec!["https://example.com".into()],
        ttl_ms: Some(60_000),
    };
    let baselines = [
        ("requestMetadata", serde_json::to_value(request).unwrap()),
        ("responseMetadata", serde_json::to_value(response).unwrap()),
        ("diagnostics", serde_json::to_value(diagnostics()).unwrap()),
        (
            "transportError",
            serde_json::to_value(
                TransportError::from_code(ErrorCode::Cancelled).with_diagnostics(diagnostics()),
            )
            .unwrap(),
        ),
        ("contextInfo", serde_json::to_value(context).unwrap()),
        ("cookieRecord", serde_json::to_value(&cookie).unwrap()),
        ("cookieSnapshot", serde_json::to_value(&snapshot).unwrap()),
        (
            "capabilities",
            serde_json::to_value(handlers::capabilities(&Config::for_test())).unwrap(),
        ),
        ("createContext", serde_json::to_value(create).unwrap()),
        (
            "cookieOperation",
            serde_json::to_value(CookieCommand::Import {
                partition: "contract-partition".into(),
                snapshot: snapshot.clone(),
                expected_revision: 2,
            })
            .unwrap(),
        ),
        (
            "cookieReply",
            serde_json::to_value(CookieReply {
                revision: 2,
                cookies: None,
                snapshot: Some(snapshot.clone()),
            })
            .unwrap(),
        ),
        (
            "requestStatus",
            serde_json::to_value(RequestStatus {
                state: RequestState::Complete,
                diagnostics: diagnostics(),
                error: None,
            })
            .unwrap(),
        ),
    ];
    let mut output: Vec<_> = baselines
        .iter()
        .map(|(name, value)| {
            fixture(
                contracts,
                format!("{name}-rust-serialized"),
                name,
                value.clone(),
                true,
                true,
                "Serialized from the actual service DTO, not a handwritten wire object.",
            )
        })
        .collect();
    let baseline = |name: &str| {
        baselines
            .iter()
            .find(|(key, _)| *key == name)
            .unwrap()
            .1
            .clone()
    };

    // JS's exact integer boundary differs from Rust's u64 domain in every direction.
    for (name, pointer) in [
        ("requestMetadata", "/attempt"),
        ("responseMetadata", "/cookieRevision"),
        ("diagnostics", "/responseBytes"),
        ("contextInfo", "/revision"),
        ("cookieOperation", "/expectedRevision"),
        ("cookieReply", "/revision"),
        ("capabilities", "/limits/maxTimeoutMs"),
        ("requestStatus", "/diagnostics/attempt"),
    ] {
        for (suffix, value, valid, rust_accepts) in [
            ("max-safe", json!(MAX_SAFE_INTEGER), true, true),
            ("unsafe", json!(MAX_SAFE_INTEGER + 1), false, true),
            ("negative", json!(-1), false, false),
            ("fraction", json!(0.5), false, false),
        ] {
            let mut object = baseline(name);
            *object.pointer_mut(pointer).unwrap() = value;
            output.push(fixture(
                contracts,
                format!("{name}-{suffix}"),
                name,
                object,
                valid,
                rust_accepts,
                "Unsigned counters must remain exact in JavaScript.",
            ));
        }
    }
    let mutations = [
        (
            "responseMetadata",
            "status-overflow",
            "/status",
            json!(65_536),
            false,
        ),
        (
            "responseMetadata",
            "header-pair-arity",
            "/headers/0",
            json!(["name", "value", "extra"]),
            false,
        ),
        (
            "diagnostics",
            "unknown-delivery",
            "/delivery",
            json!("sent"),
            false,
        ),
        (
            "diagnostics",
            "unknown-phase",
            "/phase",
            json!("done"),
            false,
        ),
        (
            "transportError",
            "unknown-error-code",
            "/code",
            json!("RETRY_REQUIRED"),
            false,
        ),
        (
            "contextInfo",
            "unknown-cookie-mode",
            "/cookieMode",
            json!("automatic"),
            false,
        ),
        (
            "cookieRecord",
            "same-site-is-case-sensitive",
            "/sameSite",
            json!("lax"),
            false,
        ),
        (
            "cookieSnapshot",
            "snapshot-cookie-shape",
            "/cookies/0",
            json!({"name":"incomplete"}),
            false,
        ),
        (
            "capabilities",
            "foreign-service",
            "/service",
            json!("other"),
            false,
        ),
        (
            "requestStatus",
            "unknown-state",
            "/state",
            json!("retrying"),
            false,
        ),
        (
            "requestMetadata",
            "unknown-egress-mode",
            "/connection/egress/mode",
            json!("automatic"),
            false,
        ),
        (
            "cookieOperation",
            "unknown-operation",
            "/operation",
            json!("merge"),
            false,
        ),
    ];
    for (name, suffix, pointer, value, rust_accepts) in mutations {
        let mut object = baseline(name);
        *object.pointer_mut(pointer).unwrap() = value;
        output.push(fixture(
            contracts,
            format!("{name}-{suffix}"),
            name,
            object,
            false,
            rust_accepts,
            "Wire discriminants, numeric widths, and tuple arity must agree with serde.",
        ));
    }
    let mut waiting = diagnostics();
    waiting.phase = Phase::Queued;
    waiting.delivery = Delivery::NotStarted;
    waiting.headers_ms = None;
    waiting.body_ms = None;
    waiting.client_reused = None;
    waiting.context_id = None;
    waiting.cookie_revision = None;
    output.push(fixture(
        contracts,
        "diagnostics-required-null-times",
        "diagnostics",
        serde_json::to_value(&waiting).unwrap(),
        true,
        true,
        "Unavailable timing fields are explicit null; omitted optional fields stay omitted.",
    ));
    let mut missing = serde_json::to_value(&waiting).unwrap();
    missing.as_object_mut().unwrap().remove("headersMs");
    output.push(fixture(
        contracts,
        "diagnostics-missing-serialized-time",
        "diagnostics",
        missing,
        false,
        true,
        "A response serializer emits null timings even though serde input permits omission.",
    ));

    for (state, phase, delivery, code) in [
        (
            RequestState::Queued,
            Phase::Queued,
            Delivery::NotStarted,
            None,
        ),
        (
            RequestState::Active,
            Phase::Upstream,
            Delivery::PossiblySent,
            None,
        ),
        (
            RequestState::Failed,
            Phase::Body,
            Delivery::ResponseStarted,
            Some(ErrorCode::Cancelled),
        ),
    ] {
        let mut progress = diagnostics();
        progress.phase = phase;
        progress.delivery = delivery;
        let error =
            code.map(|code| TransportError::from_code(code).with_diagnostics(progress.clone()));
        output.push(fixture(contracts, format!("requestStatus-{state:?}"), "requestStatus",
            serde_json::to_value(RequestStatus { state, diagnostics: progress, error }).unwrap(),
            true, true, "Status exposes execution state and safe terminal errors without inventing delivery certainty."));
    }
    for code in [
        ErrorCode::Unauthorized,
        ErrorCode::InvalidRequest,
        ErrorCode::UnsupportedCapability,
        ErrorCode::InvalidProfile,
        ErrorCode::EgressRequired,
        ErrorCode::SsrfBlocked,
        ErrorCode::BodyTooLarge,
        ErrorCode::Busy,
        ErrorCode::Timeout,
        ErrorCode::Cancelled,
        ErrorCode::DnsError,
        ErrorCode::ProxyError,
        ErrorCode::TlsError,
        ErrorCode::ConnectError,
        ErrorCode::ProtocolError,
        ErrorCode::ContextNotFound,
        ErrorCode::ContextConflict,
        ErrorCode::ContextLimit,
        ErrorCode::CookieLimit,
        ErrorCode::DuplicateRequest,
        ErrorCode::Unknown,
    ] {
        output.push(fixture(
            contracts,
            format!("transportError-{code:?}"),
            "transportError",
            serde_json::to_value(TransportError::from_code(code)).unwrap(),
            true,
            true,
            "Pre-admission control errors omit diagnostics and use safe service messages.",
        ));
    }
    for command in [
        CookieCommand::Select {
            partition: "contract-partition".into(),
            url: "https://example.com/".into(),
        },
        CookieCommand::Set {
            partition: "contract-partition".into(),
            url: "https://example.com/".into(),
            cookies: vec!["session=new; Path=/; Secure; HttpOnly".into()],
            expected_revision: 2,
        },
        CookieCommand::Export {
            partition: "contract-partition".into(),
        },
    ] {
        let value = serde_json::to_value(command).unwrap();
        output.push(fixture(
            contracts,
            format!("cookieOperation-{}", value["operation"]),
            "cookieOperation",
            value,
            true,
            true,
            "Only cookie mutations carry expectedRevision for compare-and-swap.",
        ));
    }
    for (name, reply) in [
        (
            "selection",
            CookieReply {
                revision: 2,
                cookies: Some(vec![cookie.clone()]),
                snapshot: None,
            },
        ),
        (
            "mutation",
            CookieReply {
                revision: 3,
                cookies: None,
                snapshot: None,
            },
        ),
    ] {
        output.push(fixture(contracts, format!("cookieReply-{name}"), "cookieReply",
            serde_json::to_value(reply).unwrap(), true, true,
            "Cookie mutation acknowledgements and selections share revision without fabricated payloads."));
    }
    for (suffix, expiry, valid) in [
        ("max-safe-expiry", MAX_SAFE_INTEGER, true),
        ("unsafe-expiry", MAX_SAFE_INTEGER + 1, false),
    ] {
        let mut cookie = cookie.clone();
        cookie.expires_at_ms = Some(expiry);
        output.push(fixture(
            contracts,
            format!("cookieRecord-{suffix}"),
            "cookieRecord",
            serde_json::to_value(cookie).unwrap(),
            valid,
            true,
            "Cookie expiry must be exactly representable.",
        ));
    }
    let mut missing_revision = baseline("cookieOperation");
    missing_revision
        .as_object_mut()
        .unwrap()
        .remove("expectedRevision");
    output.push(fixture(
        contracts,
        "cookieOperation-cas-required",
        "cookieOperation",
        missing_revision,
        false,
        false,
        "Imports cannot bypass compare-and-swap by omitting a revision.",
    ));
    let mut extra = baseline("createContext");
    extra["automaticProxy"] = json!(true);
    output.push(fixture(
        contracts,
        "createContext-denies-unknown-fields",
        "createContext",
        extra,
        false,
        false,
        "Context creation fails closed on unsupported input fields.",
    ));
    output
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RequestSemanticFixture {
    name: &'static str,
    value: Value,
    schema_valid: bool,
    semantic_valid: bool,
    error_code: Option<ErrorCode>,
    sdk_boundary: &'static str,
}

fn request_semantics() -> Vec<RequestSemanticFixture> {
    let config = Config::for_test();
    let baseline = || RequestMetadata {
        request_id: "semantic-request".into(),
        partition: "semantic-partition".into(),
        context_id: None,
        connection: Some(ConnectionSpec {
            egress: Egress::Direct,
            identity: BrowserIdentity {
                tls_profile: "chrome_133".into(),
                emulate_headers: false,
                user_agent: None,
            },
        }),
        url: "https://example.com/".into(),
        method: "POST".into(),
        headers: vec![],
        has_body: false,
        body_length: Some(0),
        timeout_ms: 5_000,
        max_response_bytes: 1_024,
        attempt: 1,
    };
    let mut cases = vec![("connection-bodyless", baseline(), true, "encode")];
    let mut context = baseline();
    context.connection = None;
    context.context_id = Some("semantic-context".into());
    cases.push(("context-bodyless", context, true, "encode"));
    let mut both = baseline();
    both.context_id = Some("semantic-context".into());
    cases.push(("both-connection-and-context", both, false, "reject"));
    let mut neither = baseline();
    neither.connection = None;
    cases.push(("neither-connection-nor-context", neither, false, "reject"));
    let mut timeout = baseline();
    timeout.timeout_ms = 0;
    cases.push(("zero-timeout", timeout, false, "reject"));
    let mut limit = baseline();
    limit.max_response_bytes = 0;
    cases.push(("zero-response-limit", limit, false, "reject"));
    let mut contradictory = baseline();
    contradictory.body_length = Some(4);
    cases.push((
        "bodyless-nonzero-length",
        contradictory,
        false,
        "derived-body",
    ));
    let mut body = baseline();
    body.has_body = true;
    body.body_length = Some(4);
    cases.push(("buffered-body", body, true, "encode"));
    cases
        .into_iter()
        .map(|(name, metadata, expected, sdk_boundary)| {
            // Exercise the exact validator called by request_handler, not a copied rule.
            let outcome = handlers::validate_metadata(&metadata, &config);
            assert_eq!(
                outcome.is_ok(),
                expected,
                "Request semantic fixture drift: {name}"
            );
            RequestSemanticFixture {
                name,
                value: serde_json::to_value(metadata).unwrap(),
                schema_valid: true,
                semantic_valid: outcome.is_ok(),
                error_code: outcome.err().map(|error| error.code),
                sdk_boundary,
            }
        })
        .collect()
}

fn json_bytes(value: &impl Serialize) -> anyhow::Result<Vec<u8>> {
    let mut bytes = serde_json::to_vec_pretty(value)?;
    bytes.push(b'\n');
    Ok(bytes)
}

pub fn export_from_args() -> anyhow::Result<bool> {
    let mut args = env::args_os().skip(1);
    if args.next().as_deref() != Some(std::ffi::OsStr::new("--export-contracts")) {
        return Ok(false);
    }
    let destination = PathBuf::from(args.next().ok_or_else(|| {
        anyhow::anyhow!("Aufruf: ja3proxy --export-contracts <Verzeichnis> [--check]")
    })?);
    let check = match args.next() {
        None => false,
        Some(value) if value == "--check" => true,
        _ => anyhow::bail!("Unbekannte Option für den Schemaexport."),
    };
    anyhow::ensure!(
        args.next().is_none(),
        "Unerwartete Argumente für den Schemaexport."
    );
    let contracts = contracts();
    let mut files = BTreeMap::new();
    let mut entries = Vec::new();
    for contract in &contracts {
        let path = format!("schemas/{}.schema.json", contract.name);
        files.insert(destination.join(&path), json_bytes(&contract.schema)?);
        entries.push(
            json!({ "name": contract.name, "typeName": contract.type_name,
            "direction": contract.direction, "schema": path }),
        );
    }
    files.insert(
        destination.join("manifest.json"),
        json_bytes(&json!({
            "formatVersion": 1,
            "source": "Rust service DTOs via schemars",
            "schemaDialect": "http://json-schema.org/draft-07/schema#",
            "javascriptSafeIntegers": true,
            "contracts": entries,
        }))?,
    );
    files.insert(
        destination.join("fixtures/wire.json"),
        json_bytes(&json!({
            "formatVersion": 1, "fixtures": fixtures(&contracts),
        }))?,
    );
    files.insert(
        destination.join("fixtures/request-semantics.json"),
        json_bytes(&json!({
            "formatVersion": 1, "fixtures": request_semantics(),
        }))?,
    );
    for (path, expected) in &files {
        if check {
            anyhow::ensure!(
                fs::read(path).ok().as_ref() == Some(expected),
                "Generierter Vertrag ist veraltet oder fehlt: {}",
                path.display()
            );
        } else {
            fs::create_dir_all(path.parent().unwrap())?;
            fs::write(path, expected)?;
        }
    }
    println!(
        "{} Rust-Vertragsdateien {}.",
        files.len(),
        if check { "geprüft" } else { "exportiert" }
    );
    Ok(true)
}
