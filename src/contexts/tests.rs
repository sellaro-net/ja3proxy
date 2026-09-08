use super::cookies::{CookieSnapshot, ManagedJar};
use super::*;
use crate::models::{BrowserIdentity, ConnectionSpec};

fn spec(partition: &str, mode: CookieMode) -> CreateContext {
    CreateContext {
        partition: partition.to_owned(),
        connection: ConnectionSpec {
            egress: Egress::Direct,
            identity: BrowserIdentity {
                tls_profile: "chrome_133".to_owned(),
                emulate_headers: false,
                user_agent: Some("context-regression".to_owned()),
            },
        },
        cookie_mode: mode,
        allowed_origins: if mode == CookieMode::Managed {
            vec!["https://api.example.com".to_owned()]
        } else {
            vec![]
        },
        ttl_ms: None,
    }
}

fn store(limits: ContextLimits) -> ContextStore {
    ContextStore::new(limits, Arc::new(NetworkPolicy::new(false)))
}

fn assert_code<T>(result: Result<T, TransportError>, code: ErrorCode) {
    match result {
        Ok(_) => panic!("operation unexpectedly succeeded"),
        Err(error) => assert_eq!(error.code, code),
    }
}

fn url(value: &str) -> Url {
    Url::parse(value).unwrap()
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn set_command(partition: &str, cookie: &str, expected_revision: u64) -> CookieCommand {
    CookieCommand::Set {
        partition: partition.to_owned(),
        url: "https://api.example.com/".to_owned(),
        cookies: vec![cookie.to_owned()],
        expected_revision,
    }
}

#[tokio::test]
async fn contexts_are_owner_partition_and_identity_isolated() {
    let store = store(ContextLimits::default());
    let first = store
        .create("principal-a", spec("partition-a", CookieMode::Managed))
        .await
        .unwrap();
    let mut second_spec = spec("partition-a", CookieMode::Managed);
    second_spec.connection.identity.user_agent = Some("different-identity".to_owned());
    let second = store.create("principal-a", second_spec).await.unwrap();
    assert_ne!(first.context_id, second.context_id);
    assert_ne!(first.identity.user_agent, second.identity.user_agent);
    store
        .cookies(
            "principal-a",
            &first.context_id,
            set_command("partition-a", "session=first; Secure; Path=/", 0),
        )
        .await
        .unwrap();
    assert_code(
        store
            .get("principal-b", "partition-a", &first.context_id)
            .await,
        ErrorCode::ContextNotFound,
    );
    assert_code(
        store
            .get("principal-a", "partition-b", &first.context_id)
            .await,
        ErrorCode::ContextNotFound,
    );
    store
        .close("principal-b", "partition-a", &first.context_id)
        .await
        .unwrap();
    store
        .close("principal-a", "partition-b", &first.context_id)
        .await
        .unwrap();
    let first_context = store
        .get("principal-a", "partition-a", &first.context_id)
        .await
        .unwrap();
    let second_context = store
        .get("principal-a", "partition-a", &second.context_id)
        .await
        .unwrap();
    assert_eq!(
        first_context
            .cookie_access(&url("https://api.example.com/"))
            .await
            .unwrap()
            .unwrap()
            .header()
            .as_deref(),
        Some("session=first")
    );
    assert_eq!(
        second_context
            .cookie_access(&url("https://api.example.com/"))
            .await
            .unwrap()
            .unwrap()
            .header(),
        None
    );
    assert!(
        first_context
            .cookie_access(&url("https://other.example.com/"))
            .await
            .is_err()
    );
    assert!(
        first_context
            .cookie_access(&url("https://api.example.com:444/"))
            .await
            .is_err()
    );
}

#[tokio::test]
async fn capacity_is_reserved_by_owner_and_close_releases_even_borrowed_contexts() {
    let store = store(ContextLimits {
        max_contexts: 2,
        max_contexts_per_partition: 1,
        ..ContextLimits::default()
    });
    let first = store
        .create("a", spec("p", CookieMode::External))
        .await
        .unwrap();
    let borrowed = store.get("a", "p", &first.context_id).await.unwrap();
    assert_code(
        store.create("a", spec("p", CookieMode::External)).await,
        ErrorCode::ContextLimit,
    );
    store
        .create("b", spec("p", CookieMode::External))
        .await
        .unwrap();
    assert_code(
        store.create("a", spec("q", CookieMode::External)).await,
        ErrorCode::ContextLimit,
    );
    store.close("b", "p", &first.context_id).await.unwrap();
    assert_code(
        store.create("a", spec("q", CookieMode::External)).await,
        ErrorCode::ContextLimit,
    );
    store.close("a", "p", &first.context_id).await.unwrap();
    store.close("a", "p", &first.context_id).await.unwrap();
    let replacement = store
        .create("a", spec("p", CookieMode::External))
        .await
        .unwrap();
    assert_ne!(replacement.context_id, first.context_id);
    assert!(borrowed.cancellation_token().is_cancelled());
    assert!(
        borrowed
            .client
            .request(wreq::Method::GET, "https://example.com/")
            .await
            .is_err()
    );
    assert_code(
        store.get("a", "p", &first.context_id).await,
        ErrorCode::ContextNotFound,
    );
}

#[tokio::test]
async fn idle_expiry_and_max_age_reject_instead_of_recreating() {
    let limits = ContextLimits {
        default_idle_ttl_ms: 5_000,
        max_age_ms: 10_000,
        max_contexts: 1,
        ..ContextLimits::default()
    };
    let store = store(limits);
    let first = store
        .create("a", spec("p", CookieMode::Managed))
        .await
        .unwrap();
    let context = store.get("a", "p", &first.context_id).await.unwrap();
    {
        let mut lifetime = context.lifetime.lock();
        let past = Instant::now() - Duration::from_secs(6);
        lifetime.created = past;
        lifetime.touched = past;
    }
    store.cleanup().await;
    assert!(context.cancellation_token().is_cancelled());
    assert_code(
        store
            .cookies(
                "a",
                &first.context_id,
                CookieCommand::Export {
                    partition: "p".to_owned(),
                },
            )
            .await,
        ErrorCode::ContextNotFound,
    );
    let second = store
        .create("a", spec("p", CookieMode::Managed))
        .await
        .unwrap();
    let context = store.get("a", "p", &second.context_id).await.unwrap();
    {
        let mut lifetime = context.lifetime.lock();
        lifetime.created = Instant::now() - Duration::from_secs(11);
        lifetime.touched = Instant::now();
    }
    assert_code(
        store.get("a", "p", &second.context_id).await,
        ErrorCode::ContextNotFound,
    );
    assert!(context.cancellation_token().is_cancelled());
    assert!(
        context
            .cookie_access(&url("https://api.example.com/"))
            .await
            .is_err()
    );
}

#[tokio::test]
async fn external_mode_has_no_cookie_api_and_shutdown_cancels_live_users() {
    let store = store(ContextLimits::default());
    let info = store
        .create("a", spec("p", CookieMode::External))
        .await
        .unwrap();
    let context = store.get("a", "p", &info.context_id).await.unwrap();
    assert!(
        context
            .cookie_access(&url("https://example.com/"))
            .await
            .unwrap()
            .is_none()
    );
    assert_code(
        store
            .cookies(
                "a",
                &info.context_id,
                CookieCommand::Export {
                    partition: "p".to_owned(),
                },
            )
            .await,
        ErrorCode::UnsupportedCapability,
    );
    store.shutdown().await;
    assert!(context.cancellation_token().is_cancelled());
    assert!(
        context
            .client
            .request(wreq::Method::GET, "https://example.com/")
            .await
            .is_err()
    );
    assert_code(
        store.create("a", spec("p", CookieMode::External)).await,
        ErrorCode::ContextNotFound,
    );
}

#[tokio::test]
async fn competing_cookie_mutations_compare_and_swap_exactly_once() {
    let store = store(ContextLimits::default());
    let info = store
        .create("a", spec("p", CookieMode::Managed))
        .await
        .unwrap();
    let (left, right) = tokio::join!(
        store.cookies("a", &info.context_id, set_command("p", "left=one", 0)),
        store.cookies("a", &info.context_id, set_command("p", "right=two", 0)),
    );
    let (success, failure) = if left.is_ok() {
        (left, right)
    } else {
        (right, left)
    };
    assert_eq!(success.unwrap().revision, 1);
    assert_code(failure, ErrorCode::ContextConflict);
    let exported = store
        .cookies(
            "a",
            &info.context_id,
            CookieCommand::Export {
                partition: "p".to_owned(),
            },
        )
        .await
        .unwrap();
    assert_eq!(exported.revision, 1);
    let snapshot = exported.snapshot.unwrap();
    assert_eq!(snapshot.cookies.len(), 1);
    assert_code(
        store
            .cookies(
                "a",
                &info.context_id,
                CookieCommand::Import {
                    partition: "p".to_owned(),
                    snapshot: CookieSnapshot {
                        partition_key: "https://example.com".to_owned(),
                        cookies: vec![],
                    },
                    expected_revision: 0,
                },
            )
            .await,
        ErrorCode::ContextConflict,
    );
    let unchanged = store
        .cookies(
            "a",
            &info.context_id,
            CookieCommand::Export {
                partition: "p".to_owned(),
            },
        )
        .await
        .unwrap();
    assert_eq!(unchanged.revision, 1);
    assert!(unchanged.snapshot.unwrap() == snapshot);
    let imported = store
        .cookies(
            "a",
            &info.context_id,
            CookieCommand::Import {
                partition: "p".to_owned(),
                snapshot: CookieSnapshot {
                    partition_key: "https://example.com".to_owned(),
                    cookies: vec![],
                },
                expected_revision: 1,
            },
        )
        .await
        .unwrap();
    assert_eq!(imported.revision, 2);
    let cleared = store
        .cookies(
            "a",
            &info.context_id,
            CookieCommand::Export {
                partition: "p".to_owned(),
            },
        )
        .await
        .unwrap();
    assert!(cleared.snapshot.unwrap().cookies.is_empty());
}

#[tokio::test]
async fn managed_request_serializes_selection_and_response_cookie_application() {
    let store = store(ContextLimits::default());
    let info = store
        .create("a", spec("p", CookieMode::Managed))
        .await
        .unwrap();
    let context = store.get("a", "p", &info.context_id).await.unwrap();
    let mut access = context
        .cookie_access(&url("https://api.example.com/"))
        .await
        .unwrap()
        .unwrap();
    let mutation = store.cookies("a", &info.context_id, set_command("p", "control=two", 0));
    tokio::pin!(mutation);
    assert!(futures_util::poll!(&mut mutation).is_pending());
    let mut headers = wreq::header::HeaderMap::new();
    headers.append(
        wreq::header::SET_COOKIE,
        "upstream=one; Path=/; Secure".parse().unwrap(),
    );
    headers.append(
        wreq::header::SET_COOKIE,
        "other=two; Path=/; Secure".parse().unwrap(),
    );
    assert_eq!(access.absorb(&headers).unwrap(), 1);
    drop(access);
    assert_code(mutation.await, ErrorCode::ContextConflict);
    let access = context
        .cookie_access(&url("https://api.example.com/"))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(access.header().as_deref(), Some("other=two; upstream=one"));
    assert_eq!(access.revision(), 1);
    // Closing must not wait behind an HTTP-owned cookie lock.
    store.close("a", "p", &info.context_id).await.unwrap();
    assert!(context.cancellation_token().is_cancelled());
    drop(access);
    assert!(
        context
            .jar
            .as_ref()
            .unwrap()
            .try_lock()
            .unwrap()
            .export()
            .cookies
            .is_empty()
    );
}

#[tokio::test]
async fn close_at_cookie_guard_release_cannot_leave_secrets_in_a_borrowed_context() {
    use std::sync::atomic::AtomicBool;

    let store = store(ContextLimits::default());
    let info = store
        .create("a", spec("p", CookieMode::Managed))
        .await
        .unwrap();
    store
        .cookies(
            "a",
            &info.context_id,
            set_command("p", "secret=retained", 0),
        )
        .await
        .unwrap();
    let context = store.get("a", "p", &info.context_id).await.unwrap();
    let mut access = context
        .cookie_access(&url("https://api.example.com/"))
        .await
        .unwrap()
        .unwrap();
    let close_after_unlock = Arc::new(AtomicBool::new(false));
    let deferred = close_after_unlock.clone();
    let closing_context = context.clone();
    access.jar.before_unlock = Some(Box::new(move || {
        // Deterministically attempt close at the old expiry-check/jar-unlock boundary.
        // If the lifecycle critical section excludes it, execute the next legal ordering below.
        let can_close_now = closing_context.lifetime.try_lock().is_some();
        if can_close_now {
            closing_context.retire();
        } else {
            deferred.store(true, Ordering::Release);
        }
    }));
    drop(access);
    if close_after_unlock.load(Ordering::Acquire) {
        context.retire();
    }
    assert!(context.cancellation_token().is_cancelled());
    assert!(
        context
            .jar
            .as_ref()
            .unwrap()
            .try_lock()
            .unwrap()
            .export()
            .cookies
            .is_empty()
    );
    assert!(
        context
            .cookie_access(&url("https://api.example.com/"))
            .await
            .is_err()
    );
}

#[test]
fn rfc_domain_path_secure_and_expiry_selection() {
    let mut jar = ManagedJar::new(ContextLimits::default(), "https://example.com".to_owned());
    let origin = url("https://api.example.com/private/start");
    jar.set(
        &origin,
        &strings(&[
            "host=h; Path=/; Secure; HttpOnly",
            "domain=d; Domain=example.com; Path=/",
            "path=p; Path=/private; Secure",
            "default=z; Secure",
        ]),
    )
    .unwrap();
    assert_eq!(
        jar.header(&url("http://api.example.com/")).as_deref(),
        Some("domain=d")
    );
    assert_eq!(
        jar.header(&url("https://other.example.com/")).as_deref(),
        Some("domain=d")
    );
    assert_eq!(
        jar.header(&url("https://api.example.com/private"))
            .as_deref(),
        Some("default=z; path=p; domain=d; host=h")
    );
    assert_eq!(
        jar.header(&url("https://api.example.com/privately"))
            .as_deref(),
        Some("domain=d; host=h")
    );
    jar.set(
        &origin,
        &strings(&[
            "path=gone; Path=/private; Max-Age=0; Expires=Wed, 01 Jan 2098 00:00:00 GMT",
            "expired=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ]),
    )
    .unwrap();
    assert!(
        !jar.export()
            .cookies
            .iter()
            .any(|cookie| cookie.name == "path" || cookie.name == "expired")
    );
    assert!(
        jar.select(&url("https://api.example.com/"))
            .iter()
            .any(|cookie| cookie.name == "host" && cookie.http_only && cookie.host_only)
    );
}

#[test]
fn public_suffix_cookie_prefix_and_secure_overlay_protections() {
    let mut jar = ManagedJar::new(ContextLimits::default(), "https://example.com".to_owned());
    for (source, value) in [
        ("https://shop.co.uk/", "x=y; Domain=co.uk"),
        ("https://tenant.github.io/", "x=y; Domain=github.io"),
        ("https://example.com/", "x=y; Domain=unrelated.com"),
        ("http://example.com/", "x=y; Secure"),
        ("https://example.com/", "__Host-id=x; Secure"),
        (
            "https://example.com/",
            "__Host-id=x; Secure; Path=/; Domain=example.com",
        ),
        ("https://example.com/", "__Secure-id=x"),
        ("https://example.com/", "__Http-id=x; Secure"),
        ("https://example.com/", "x=y; SameSite=None"),
    ] {
        assert_code(
            jar.set(&url(source), &strings(&[value])),
            ErrorCode::InvalidRequest,
        );
    }
    let secure = url("https://example.com/");
    jar.set(
        &secure,
        &strings(&[
            "__Host-id=one; Secure; HttpOnly; Path=/",
            "session=one; Secure; Path=/",
        ]),
    )
    .unwrap();
    let before = jar.export();
    assert_code(
        jar.set(
            &url("http://example.com/"),
            &strings(&["session=gone; Max-Age=0; Path=/"]),
        ),
        ErrorCode::InvalidRequest,
    );
    assert!(jar.export() == before);
}

#[test]
fn cookie_mutations_are_atomic_under_count_and_byte_limits() {
    let mut jar = ManagedJar::new(
        ContextLimits {
            max_cookies: 2,
            ..ContextLimits::default()
        },
        "https://example.com".to_owned(),
    );
    let origin = url("https://example.com/");
    jar.set(&origin, &strings(&["first=kept"])).unwrap();
    let before = jar.export();
    assert_code(
        jar.set(&origin, &strings(&["second=x", "third=y"])),
        ErrorCode::CookieLimit,
    );
    assert!(jar.export() == before);
    assert_code(
        jar.set(&origin, &strings(&["second=x", "bad name=y"])),
        ErrorCode::InvalidRequest,
    );
    assert!(jar.export() == before);
    let mut small = ManagedJar::new(
        ContextLimits {
            max_cookie_bytes: 128,
            ..ContextLimits::default()
        },
        "https://example.com".to_owned(),
    );
    small.set(&origin, &strings(&["a=one"])).unwrap();
    assert_code(
        small.set(&origin, &strings(&["b=two"])),
        ErrorCode::CookieLimit,
    );
    assert_eq!(small.header(&origin).as_deref(), Some("a=one"));
}

#[test]
fn snapshot_roundtrip_preserves_security_and_absolute_expiry_without_widening() {
    let origin = url("https://api.example.com/private");
    let origins = strings(&["https://api.example.com"]);
    let mut jar = ManagedJar::new(ContextLimits::default(), "https://example.com".to_owned());
    jar.set(
        &origin,
        &strings(&[
            "session=value; Secure; HttpOnly; SameSite=Strict; Path=/private; Max-Age=3600",
            "shared=other; Domain=example.com; Path=/",
        ]),
    )
    .unwrap();
    let snapshot = jar.export();
    let mut imported = ManagedJar::new(ContextLimits::default(), "https://example.com".to_owned());
    imported.import(snapshot.clone(), &origins).unwrap();
    assert!(imported.export() == snapshot);
    assert_eq!(imported.header(&origin), jar.header(&origin));
    let mut invalid_domain = snapshot.clone();
    invalid_domain.cookies[0].domain = "attacker.example".to_owned();
    assert_code(
        imported.import(invalid_domain, &origins),
        ErrorCode::InvalidRequest,
    );
    assert!(imported.export() == snapshot);
    let mut duplicate = snapshot.clone();
    duplicate.cookies.push(duplicate.cookies[0].clone());
    assert_code(
        imported.import(duplicate, &origins),
        ErrorCode::InvalidRequest,
    );
    assert!(imported.export() == snapshot);
    let mut forged_prefix = snapshot.clone();
    forged_prefix.cookies[0].name = "__Host-forged".to_owned();
    assert_code(
        imported.import(forged_prefix, &origins),
        ErrorCode::InvalidRequest,
    );
    assert!(imported.export() == snapshot);
}

#[tokio::test]
async fn managed_contexts_pin_schemeful_site_and_private_suffix_boundaries() {
    let store = store(ContextLimits::default());
    let mut allowed = spec("p", CookieMode::Managed);
    allowed.allowed_origins = strings(&["https://api.example.com", "https://cdn.example.com"]);
    let info = store.create("a", allowed).await.unwrap();
    let snapshot = store
        .cookies(
            "a",
            &info.context_id,
            CookieCommand::Export {
                partition: "p".to_owned(),
            },
        )
        .await
        .unwrap()
        .snapshot
        .unwrap();
    assert_eq!(snapshot.partition_key, "https://example.com");
    for origins in [
        ["https://api.example.com", "http://cdn.example.com"],
        ["https://tenant.github.io", "https://other.github.io"],
        ["http://127.0.0.1", "http://192.168.0.1"],
    ] {
        let mut rejected = spec("p", CookieMode::Managed);
        rejected.allowed_origins = strings(&origins);
        assert_code(store.create("a", rejected).await, ErrorCode::InvalidRequest);
    }
}

#[test]
fn partitioned_clearance_roundtrip_keeps_distinct_keys_and_shared_capacity() {
    let mut jar = ManagedJar::new(
        ContextLimits {
            max_cookies: 2,
            ..ContextLimits::default()
        },
        "https://example.com".to_owned(),
    );
    let origin = url("https://api.example.com/");
    let origins = strings(&["https://api.example.com"]);
    jar.set(
        &origin,
        &strings(&[
            "cf_clearance=ordinary; Path=/; Secure; HttpOnly; SameSite=None",
            "cf_clearance=partitioned; Path=/; Secure; HttpOnly; SameSite=None; Partitioned",
        ]),
    )
    .unwrap();
    let snapshot = jar.export();
    assert!(
        snapshot
            .cookies
            .iter()
            .any(|cookie| cookie.value == "ordinary" && !cookie.partitioned)
    );
    assert!(
        snapshot
            .cookies
            .iter()
            .any(|cookie| cookie.value == "partitioned" && cookie.partitioned)
    );
    assert_code(
        jar.set(&origin, &strings(&["third=value; Secure"])),
        ErrorCode::CookieLimit,
    );
    assert!(jar.export() == snapshot);
    let mut restored = ManagedJar::new(ContextLimits::default(), "https://example.com".to_owned());
    restored.import(snapshot.clone(), &origins).unwrap();
    let header = restored.header(&origin).unwrap();
    assert!(header.contains("cf_clearance=ordinary"));
    assert!(header.contains("cf_clearance=partitioned"));
    let mut wrong_partition = snapshot.clone();
    wrong_partition.partition_key = "http://example.com".to_owned();
    assert_code(
        restored.import(wrong_partition, &origins),
        ErrorCode::InvalidRequest,
    );
    let mut insecure = snapshot.clone();
    insecure
        .cookies
        .iter_mut()
        .find(|cookie| cookie.partitioned)
        .unwrap()
        .secure = false;
    assert_code(
        restored.import(insecure, &origins),
        ErrorCode::InvalidRequest,
    );
    assert!(restored.export() == snapshot);
    assert_code(
        restored.set(&origin, &strings(&["unsafe=value; Partitioned"])),
        ErrorCode::InvalidRequest,
    );
    restored
        .set(
            &origin,
            &strings(&["cf_clearance=gone; Path=/; Secure; Partitioned; Max-Age=0"]),
        )
        .unwrap();
    assert_eq!(
        restored.header(&origin).as_deref(),
        Some("cf_clearance=ordinary")
    );
}

#[test]
fn upstream_cookie_rejection_preserves_valid_neighbors() {
    let mut jar = ManagedJar::new(ContextLimits::default(), "https://example.com".to_owned());
    let origin = url("https://api.example.com/");
    let mut headers = wreq::header::HeaderMap::new();
    for value in [
        "wrong=value; Domain=attacker.example",
        "__Secure-invalid=value",
        "cf_clearance=kept; Path=/; Secure; HttpOnly; SameSite=None; Partitioned",
    ] {
        headers.append(
            "set-cookie",
            wreq::header::HeaderValue::from_str(value).unwrap(),
        );
    }
    headers.append(
        "set-cookie",
        wreq::header::HeaderValue::from_bytes(b"invalid=\xff").unwrap(),
    );
    jar.absorb(&origin, headers.get_all("set-cookie").iter())
        .unwrap();
    assert_eq!(jar.header(&origin).as_deref(), Some("cf_clearance=kept"));
    assert!(jar.select(&origin)[0].partitioned);
}
