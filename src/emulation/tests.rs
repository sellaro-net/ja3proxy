use super::chrome::{RequestKind, request_kind, sec_ch_ua, urgency, weight};
use super::*;
use serde_json::Value;
use wreq::header::HeaderName;

const GOLDEN: &str = include_str!("golden/chrome_155.json");

fn golden() -> Value {
    serde_json::from_str(GOLDEN).unwrap()
}

fn profile(name: &str) -> TlsProfile {
    parse_tls_profile(name).unwrap()
}

fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
    let mut map = HeaderMap::new();
    for (name, value) in pairs {
        map.append(
            HeaderName::from_bytes(name.as_bytes()).unwrap(),
            HeaderValue::from_str(value).unwrap(),
        );
    }
    map
}

fn descriptor(name: &str) -> Vec<(String, String)> {
    header_descriptors()
        .into_iter()
        .find(|descriptor| descriptor.tls_profile == name)
        .unwrap()
        .headers
}

/// Names in wire order: the ordering map applied to the request's effective headers.
fn wire_order(shaped: &Shaped, caller: &HeaderMap, defaults: &HeaderMap) -> Vec<String> {
    shaped
        .orig_headers
        .as_ref()
        .expect("Chrome profiles order headers")
        .iter()
        .map(|(name, _)| name.as_str().to_owned())
        .filter(|name| caller.contains_key(name.as_str()) || defaults.contains_key(name.as_str()))
        .collect()
}

#[test]
fn profile_names_are_canonical_and_injection_is_rejected() {
    for name in [
        "okhttp_4.12",
        "chrome_120",
        "chrome_133",
        "safari_ios_17.2",
        "chrome_150",
        "chrome_154",
        "chrome_155",
        "chrome_stable",
    ] {
        assert!(parse_tls_profile(name).is_ok(), "{name}");
    }
    for name in [
        "chrome_133\"",
        "chrome_133\\u0022",
        "Chrome133",
        " chrome_133",
        "chrome_150 ",
        "chrome_stable ",
        "Chrome_Stable",
        "chrome_156",
    ] {
        assert_eq!(
            parse_tls_profile(name).unwrap_err().code,
            ErrorCode::InvalidProfile,
            "{name}"
        );
    }
}

#[test]
fn chrome_stable_resolves_to_one_concrete_profile() {
    assert_eq!(profile("chrome_stable"), profile("chrome_155"));
    assert_eq!(
        canonical_profile_name("chrome_stable").unwrap(),
        "chrome_155"
    );
    assert_eq!(canonical_profile_name("chrome_149").unwrap(), "chrome_149");
    assert_eq!(
        profile_aliases(),
        BTreeMap::from([("chrome_stable".to_owned(), "chrome_155".to_owned())])
    );
    let profiles = available_profiles();
    // Every alias target is a listed concrete profile; the alias itself is not one.
    for (alias, target) in profile_aliases() {
        assert!(profiles.contains(&target));
        assert!(!profiles.contains(&alias));
        assert!(
            !header_descriptors()
                .iter()
                .any(|descriptor| descriptor.tls_profile == alias)
        );
    }
    assert_eq!(
        descriptor("chrome_155"),
        header_descriptors()
            .into_iter()
            .find(|descriptor| descriptor.tls_profile == profile("chrome_stable").name())
            .unwrap()
            .headers
    );
}

#[test]
fn chrome_150_emulation_is_unchanged() {
    // Previous definition: registry chrome_149 with the ML-DSA list and a Chrome 150 UA.
    let mut expected = registry_emulation(Profile::Chrome149, None, true);
    expected.tls_options.as_mut().unwrap().sigalgs_list = Some(chrome::MLDSA_SIGALGS.into());
    expected.headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"),
    );
    expected.headers.insert(
        "sec-ch-ua",
        HeaderValue::from_static(
            "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\"",
        ),
    );
    let actual = profile_emulation(profile("chrome_150"), true);
    let tls = actual.tls_options.as_ref().unwrap();
    assert_eq!(tls.grease_sigalgs_enabled, None);
    assert_eq!(tls.trust_anchors, None);
    assert_eq!(tls.server_padding_request, None);
    assert_eq!(
        format!("{:?}", expected.tls_options),
        format!("{:?}", actual.tls_options)
    );
    assert_eq!(
        format!("{:?}", expected.http2_options),
        format!("{:?}", actual.http2_options)
    );
    assert_eq!(expected.headers, actual.headers);
    assert_eq!(
        descriptor("chrome_150")
            .iter()
            .map(|(name, _)| name.as_str())
            .collect::<Vec<_>>(),
        [
            "sec-ch-ua",
            "sec-ch-ua-mobile",
            "sec-ch-ua-platform",
            "upgrade-insecure-requests",
            "user-agent",
            "accept",
            "sec-fetch-site",
            "sec-fetch-mode",
            "sec-fetch-user",
            "sec-fetch-dest",
            "accept-encoding",
            "accept-language",
            "priority",
        ]
    );
    // chrome_149 is the unmodified registry profile.
    assert_eq!(
        format!(
            "{:?}",
            profile_emulation(profile("chrome_149"), true).tls_options
        ),
        format!(
            "{:?}",
            registry_emulation(Profile::Chrome149, None, true).tls_options
        )
    );
}

#[test]
fn new_chrome_profiles_extend_chrome_150_by_the_measured_extensions() {
    let chrome_150 = profile_emulation(profile("chrome_150"), false);
    for name in ["chrome_154", "chrome_155"] {
        let emulation = profile_emulation(profile(name), false);
        let tls = emulation.tls_options.as_ref().unwrap();
        assert_eq!(tls.grease_sigalgs_enabled, Some(true));
        assert_eq!(tls.trust_anchors.as_deref(), Some(chrome::TRUST_ANCHOR_IDS));
        assert_eq!(tls.server_padding_request, Some(0));
        let mut base = tls.clone();
        base.grease_sigalgs_enabled = None;
        base.trust_anchors = None;
        base.server_padding_request = None;
        assert_eq!(
            format!("{base:?}"),
            format!("{:?}", chrome_150.tls_options.as_ref().unwrap())
        );
        assert_eq!(
            format!("{:?}", emulation.http2_options),
            format!("{:?}", chrome_150.http2_options)
        );
    }
    let fixture = golden();
    let trust_anchors = fixture["tls"]["trustAnchors"].as_str().unwrap();
    let encoded: String = chrome::TRUST_ANCHOR_IDS
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    // The golden value carries the outer two-byte list length.
    assert_eq!(
        trust_anchors,
        format!("{:04x}{encoded}", chrome::TRUST_ANCHOR_IDS.len())
    );
}

#[test]
fn new_chrome_profiles_default_to_a_windows_identity_of_their_version() {
    let expected_155 = [
        (
            "sec-ch-ua",
            "\"Google Chrome\";v=\"155\", \"Chromium\";v=\"155\", \"Not(A:Brand\";v=\"24\"",
        ),
        ("sec-ch-ua-mobile", "?0"),
        ("sec-ch-ua-platform", "\"Windows\""),
        ("upgrade-insecure-requests", "1"),
        (
            "user-agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
        ),
        (
            "accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        ),
        ("sec-fetch-site", "none"),
        ("sec-fetch-mode", "navigate"),
        ("sec-fetch-user", "?1"),
        ("sec-fetch-dest", "document"),
        ("accept-encoding", "gzip, deflate, br, zstd"),
        ("accept-language", "en-US,en;q=0.9"),
        ("priority", "u=0, i"),
    ];
    assert_eq!(
        descriptor("chrome_155"),
        expected_155
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect::<Vec<_>>()
    );
    let chrome_154: BTreeMap<_, _> = descriptor("chrome_154").into_iter().collect();
    assert_eq!(
        chrome_154["sec-ch-ua"],
        "\"Chromium\";v=\"154\", \"Google Chrome\";v=\"154\", \"Not A(Brand\";v=\"99\""
    );
    assert!(chrome_154["user-agent"].contains("(Windows NT 10.0; Win64; x64)"));
    assert!(chrome_154["user-agent"].contains("Chrome/154.0.0.0"));
    assert!(!chrome_154["accept"].contains("image/jxl"));
}

#[test]
fn sec_ch_ua_derivation_matches_known_chrome_values() {
    let chrome_149: BTreeMap<_, _> = descriptor("chrome_149").into_iter().collect();
    assert_eq!(sec_ch_ua(149), chrome_149["sec-ch-ua"]);
    assert_eq!(
        sec_ch_ua(150),
        "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\""
    );
    // Brand spelling as captured from Chrome for Testing 154/155.
    assert!(sec_ch_ua(154).contains("\"Not A(Brand\";v=\"99\""));
    assert!(sec_ch_ua(155).contains("\"Not(A:Brand\";v=\"24\""));
}

/// Caller headers for a captured request, supplied in alphabetical order.
fn captured_request(entry: &Value, kind: &str) -> (Method, bool, HeaderMap) {
    let mut names: Vec<&str> = entry["headers"]
        .as_array()
        .unwrap()
        .iter()
        .map(|name| name.as_str().unwrap())
        .filter(|name| !matches!(*name, "content-length" | "host"))
        .collect();
    names.sort_unstable();
    let (method, has_body, mode, dest) = match kind {
        "navigation" => (Method::GET, false, "navigate", "document"),
        "navigationIframe" | "navigationApplicationHeaders" => {
            (Method::GET, false, "navigate", "iframe")
        }
        "navigationPost" => (Method::POST, true, "navigate", "document"),
        "fetchPost" | "fetchPostApplicationHeaders" => (Method::POST, true, "cors", "empty"),
        "script" => (Method::GET, false, "no-cors", "script"),
        _ => (Method::GET, false, "cors", "empty"),
    };
    let priority = entry["priority"].as_str().unwrap_or("");
    let pairs: Vec<(&str, &str)> = names
        .into_iter()
        .map(|name| match name {
            "sec-fetch-mode" => (name, mode),
            "sec-fetch-dest" => (name, dest),
            "priority" => (name, priority),
            _ => (name, "1"),
        })
        .collect();
    (method, has_body, headers(&pairs))
}

#[test]
fn chrome_155_orders_every_captured_request_kind_like_chrome() {
    let fixture = golden();
    let requests = fixture["requests"].as_object().unwrap();
    assert!(requests.len() >= 9);
    let shaping = profile("chrome_155").shaping();
    for (kind, entry) in requests {
        let (method, has_body, caller) = captured_request(entry, kind);
        let mut expected: Vec<String> = entry["headers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|name| name.as_str().unwrap().to_owned())
            .collect();
        // content-length is transport framing, appended by the service, not the caller.
        expected.retain(|name| name != "content-length");
        let shaped = shaping.shape(&method, has_body, &caller, &HeaderMap::new());
        assert_eq!(
            wire_order(&shaped, &caller, &HeaderMap::new()),
            expected,
            "{kind}"
        );
        let order = shaped.orig_headers.as_ref().unwrap();
        if has_body {
            let first = order
                .iter()
                .map(|(name, _)| name.as_str())
                .find(|name| *name == "content-length" || caller.contains_key(*name));
            assert_eq!(first, Some("content-length"), "{kind}");
        }
        match entry["priority"].as_str() {
            Some(_) => assert_eq!(
                shaped.weight,
                entry["weight"].as_u64().map(|weight| weight as u16),
                "{kind}"
            ),
            // Chrome omits `priority` only for its default urgency; without the header
            // the profile keeps its connection default.
            None => assert_eq!(shaped.weight, None, "{kind}"),
        }
    }
}

#[test]
fn unknown_headers_keep_caller_order_at_the_application_slot() {
    let shaping = profile("chrome_155").shaping();
    let caller = headers(&[
        ("x-second", "2"),
        ("authorization", "token"),
        ("sec-fetch-mode", "cors"),
        ("user-agent", "agent"),
        ("x-first", "1"),
        ("x-second", "3"),
        ("sec-ch-ua", "brand"),
    ]);
    let defaults = headers(&[("x-default", "d"), ("accept", "*/*"), ("x-first", "0")]);
    let shaped = shaping.shape(&Method::GET, false, &caller, &defaults);
    assert_eq!(
        wire_order(&shaped, &caller, &defaults),
        [
            "sec-ch-ua",
            "user-agent",
            "x-second",
            "authorization",
            "x-first",
            "x-default",
            "accept",
            "sec-fetch-mode",
        ]
    );
    // Each name appears once; repeated values stay grouped under it.
    let order = shaped.orig_headers.unwrap();
    assert_eq!(
        order.iter().filter(|(name, _)| *name == "x-second").count(),
        1
    );
}

#[test]
fn request_kind_follows_fetch_metadata_then_method() {
    let kind = |method: Method, has_body: bool, pairs: &[(&str, &str)]| {
        let map = headers(pairs);
        request_kind(&method, has_body, |name| {
            map.get(name).and_then(|value| value.to_str().ok())
        })
    };
    use RequestKind::*;
    assert_eq!(
        kind(Method::GET, false, &[("sec-fetch-mode", "navigate")]),
        Navigation
    );
    assert_eq!(
        kind(Method::POST, true, &[("sec-fetch-mode", "Navigate")]),
        Navigation
    );
    assert_eq!(
        kind(Method::GET, false, &[("sec-fetch-mode", "cors")]),
        Fetch
    );
    assert_eq!(
        kind(Method::GET, false, &[("sec-fetch-mode", "no-cors")]),
        Fetch
    );
    assert_eq!(
        kind(Method::POST, true, &[("sec-fetch-mode", "cors")]),
        FetchWithBody
    );
    assert_eq!(
        kind(Method::POST, false, &[("sec-fetch-mode", "cors")]),
        FetchWithBody
    );
    assert_eq!(
        kind(Method::DELETE, false, &[("sec-fetch-mode", "cors")]),
        Fetch
    );
    // Mode wins over destination.
    assert_eq!(
        kind(
            Method::GET,
            false,
            &[("sec-fetch-mode", "cors"), ("sec-fetch-dest", "document")]
        ),
        Fetch
    );
    assert_eq!(
        kind(Method::GET, false, &[("sec-fetch-dest", "iframe")]),
        Navigation
    );
    assert_eq!(
        kind(Method::GET, false, &[("sec-fetch-dest", "empty")]),
        Fetch
    );
    // Without fetch metadata: navigation markers, else bodiless GET/HEAD navigate.
    assert_eq!(
        kind(Method::POST, true, &[("upgrade-insecure-requests", "1")]),
        Navigation
    );
    assert_eq!(kind(Method::GET, false, &[]), Navigation);
    assert_eq!(kind(Method::HEAD, false, &[]), Navigation);
    assert_eq!(kind(Method::GET, true, &[]), FetchWithBody);
    assert_eq!(kind(Method::POST, true, &[]), FetchWithBody);
    assert_eq!(kind(Method::OPTIONS, false, &[]), Fetch);
}

#[test]
fn caller_fetch_metadata_and_priority_override_emulated_defaults() {
    let shaping = profile("chrome_155").shaping();
    let defaults = profile_emulation(profile("chrome_155"), true).headers;
    // Defaults describe a navigation with urgency 0.
    let navigation = shaping.shape(&Method::GET, false, &HeaderMap::new(), &defaults);
    assert_eq!(navigation.weight, Some(256));
    let caller = headers(&[("sec-fetch-mode", "cors"), ("priority", "u=1, i")]);
    let fetch = shaping.shape(&Method::GET, false, &caller, &defaults);
    assert_eq!(fetch.weight, Some(220));
    let order = wire_order(&fetch, &caller, &defaults);
    assert_eq!(
        &order[..3],
        ["sec-ch-ua-platform", "sec-ch-ua", "user-agent"]
    );
}

#[test]
fn chrome_default_headers_are_already_in_template_order() {
    // Header emulation output of every Chrome profile stays byte-identical.
    for tls_profile in all_profiles() {
        let shaping = tls_profile.shaping();
        if shaping.order.is_none() {
            continue;
        }
        let defaults = profile_emulation(tls_profile, true).headers;
        let shaped = shaping.shape(&Method::GET, false, &HeaderMap::new(), &defaults);
        let own: Vec<String> = defaults
            .keys()
            .map(|name| name.as_str().to_owned())
            .collect();
        assert_eq!(
            wire_order(&shaped, &HeaderMap::new(), &defaults),
            own,
            "{}",
            tls_profile.name()
        );
    }
}

#[test]
fn only_chrome_profiles_are_shaped_and_only_new_ones_derive_weights() {
    let caller = headers(&[("priority", "u=0, i"), ("sec-fetch-mode", "navigate")]);
    for name in available_profiles() {
        let shaped =
            profile(&name)
                .shaping()
                .shape(&Method::GET, false, &caller, &HeaderMap::new());
        let chrome = name.starts_with("chrome_");
        assert_eq!(shaped.orig_headers.is_some(), chrome, "{name}");
        let derives = matches!(name.as_str(), "chrome_154" | "chrome_155");
        assert_eq!(shaped.weight.is_some(), derives, "{name}");
    }
    // Absent `priority` keeps the connection default.
    let shaped = profile("chrome_155").shaping().shape(
        &Method::GET,
        false,
        &HeaderMap::new(),
        &HeaderMap::new(),
    );
    assert!(shaped.weight.is_none());
}

#[test]
fn urgency_maps_to_chrome_weights() {
    assert_eq!(
        (0..=7).map(weight).collect::<Vec<_>>(),
        [256, 220, 183, 147, 110, 74, 37, 1]
    );
    assert_eq!(weight(200), 1);
    for (value, expected) in [
        ("u=0, i", 0),
        ("u=1", 1),
        ("i", 3),
        ("", 3),
        ("u=7", 7),
        ("u=8", 3),
        ("u=-1", 3),
        ("u=x, i", 3),
        (" u=2 , i", 2),
        ("u=2, u=5", 5),
    ] {
        assert_eq!(urgency(value), expected, "{value:?}");
    }
}
