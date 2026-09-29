//! Chrome network behaviour that is not part of a static client configuration:
//! client hints derived from the major version, the Trust Anchor IDs Chrome
//! requests, header order per request kind and HTTP/2 HEADERS weights.
//!
//! Values are measured against real Chrome; `golden/chrome_155.json` holds the
//! sanitized reference the tests compare with.

use wreq::{
    Method,
    header::{HeaderName, OrigHeaderMap},
};

/// Trust Anchor IDs (`trust_anchors`, 0xca34) in the order Chrome 154/155 send
/// them, without the outer two-byte list length. Same ID set as
/// `chromium_roots::encoded_trust_anchor_ids()` (chromium-roots 0.1.1), whose
/// order differs from Chrome's wire order.
pub(crate) const TRUST_ANCHOR_IDS: &[u8] = &[
    0x05, 0x82, 0xdf, 0x13, 0x02, 0x01, 0x05, 0x82, 0xdf, 0x13, 0x02, 0x06, 0x05, 0x82, 0xdf, 0x13,
    0x02, 0x0d, 0x05, 0x82, 0xdf, 0x13, 0x02, 0x0e, 0x05, 0x82, 0xdf, 0x13, 0x02, 0x0f, 0x05, 0x82,
    0xdf, 0x13, 0x02, 0x12, 0x05, 0x82, 0xdf, 0x13, 0x02, 0x13, 0x05, 0x82, 0xdf, 0x13, 0x02, 0x14,
    0x08, 0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d, 0x01, 0x07, 0x08, 0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d,
    0x01, 0x08, 0x08, 0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d, 0x01, 0x09, 0x08, 0x83, 0x9a, 0x64, 0x8c,
    0x9b, 0x2d, 0x01, 0x0a, 0x08, 0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d, 0x01, 0x0b, 0x08, 0x83, 0x9a,
    0x64, 0x8c, 0x9b, 0x2d, 0x01, 0x0c, 0x08, 0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d, 0x01, 0x0d, 0x08,
    0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d, 0x01, 0x12, 0x08, 0x83, 0x9a, 0x64, 0x8c, 0x9b, 0x2d, 0x01,
    0x13, 0x04, 0xd6, 0x79, 0x09, 0x01, 0x04, 0xd6, 0x79, 0x09, 0x04, 0x04, 0xd6, 0x79, 0x09, 0x05,
    0x04, 0xd6, 0x79, 0x09, 0x06, 0x04, 0xd6, 0x79, 0x09, 0x07, 0x04, 0xd6, 0x79, 0x09, 0x08, 0x04,
    0xd6, 0x79, 0x09, 0x0a, 0x04, 0xd6, 0x79, 0x09, 0x0b, 0x04, 0xd6, 0x79, 0x09, 0x0c, 0x04, 0xd6,
    0x79, 0x09, 0x0d, 0x04, 0xd6, 0x79, 0x09, 0x0f,
];

/// Signature algorithms of Chrome >= 150: ML-DSA 44/65/87 before the classic list.
pub(crate) const MLDSA_SIGALGS: &str = "mldsa44:mldsa65:mldsa87:ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";

/// Navigation `accept` of Chrome >= 155 (adds `image/jxl`).
pub(crate) const NAVIGATION_ACCEPT_JXL: &str = "text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";

/// `sec-ch-ua` as Chrome derives it from its major version (Chromium
/// `GetGreasedUserAgentBrandVersion`): GREASE characters from `major % 11` and
/// `(major + 1) % 11`, GREASE version from `major % 3`, brand order from `major % 6`.
pub(crate) fn sec_ch_ua(major: u16) -> String {
    const CHARS: [char; 11] = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
    const VERSIONS: [&str; 3] = ["8", "99", "24"];
    // ORDERS[i][j]: position of brand j (GREASE, Chromium, Google Chrome).
    const ORDERS: [[usize; 3]; 6] = [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
    ];
    let major = usize::from(major);
    let brands = [
        format!(
            "\"Not{}A{}Brand\";v=\"{}\"",
            CHARS[major % 11],
            CHARS[(major + 1) % 11],
            VERSIONS[major % 3]
        ),
        format!("\"Chromium\";v=\"{major}\""),
        format!("\"Google Chrome\";v=\"{major}\""),
    ];
    let mut ordered = [""; 3];
    for (brand, position) in brands.iter().zip(ORDERS[major % 6]) {
        ordered[position] = brand;
    }
    ordered.join(", ")
}

/// Header positions for one request kind. Headers named here go to Chrome's
/// position; any other header goes between `before` and `after`, where Chrome
/// places headers set by the page or an extension.
#[derive(Debug)]
pub(crate) struct HeaderTemplate {
    pub(crate) before: &'static [&'static str],
    pub(crate) after: &'static [&'static str],
}

/// HTTP/2 header order of Chrome's network stack per request kind (HTTP/1
/// requests use the same relative order behind `host`).
#[derive(Debug)]
pub(crate) struct HeaderOrder {
    pub(crate) navigation: HeaderTemplate,
    pub(crate) fetch: HeaderTemplate,
    pub(crate) fetch_with_body: HeaderTemplate,
}

/// Measured on Chrome 154/155; the navigation order is also the order of the
/// default headers of every Chrome profile in the pinned registry.
pub(crate) static HEADER_ORDER: HeaderOrder = HeaderOrder {
    navigation: HeaderTemplate {
        before: &[
            "host",
            "content-length",
            "cache-control",
            "sec-ch-ua",
            "sec-ch-ua-mobile",
            "sec-ch-ua-platform",
            "upgrade-insecure-requests",
            "content-type",
            "user-agent",
        ],
        after: &[
            "origin",
            "accept",
            "sec-fetch-site",
            "sec-fetch-mode",
            "sec-fetch-user",
            "sec-fetch-dest",
            "referer",
            "accept-encoding",
            "accept-language",
            "cookie",
            "priority",
        ],
    },
    fetch: HeaderTemplate {
        before: &["host", "sec-ch-ua-platform", "sec-ch-ua", "user-agent"],
        after: &[
            "sec-ch-ua-mobile",
            "accept",
            "origin",
            "sec-fetch-site",
            "sec-fetch-mode",
            "sec-fetch-dest",
            "referer",
            "accept-encoding",
            "accept-language",
            "cookie",
            "priority",
        ],
    },
    fetch_with_body: HeaderTemplate {
        before: &[
            "host",
            "content-length",
            "sec-ch-ua-platform",
            "sec-ch-ua",
            "content-type",
        ],
        after: &[
            "sec-ch-ua-mobile",
            "user-agent",
            "accept",
            "origin",
            "sec-fetch-site",
            "sec-fetch-mode",
            "sec-fetch-dest",
            "referer",
            "accept-encoding",
            "accept-language",
            "cookie",
            "priority",
        ],
    },
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RequestKind {
    /// Document load (top-level or frame), including form submissions.
    Navigation,
    /// Script-initiated or subresource request without a body.
    Fetch,
    /// Script-initiated request with a body.
    FetchWithBody,
}

/// Classify a request from its effective `sec-fetch-*` headers. Without them a
/// bodiless GET/HEAD counts as navigation (the default Chrome header set), any
/// other request as script-initiated.
pub(crate) fn request_kind<'a>(
    method: &Method,
    has_body: bool,
    header: impl Fn(&str) -> Option<&'a str>,
) -> RequestKind {
    let navigation = match (header("sec-fetch-mode"), header("sec-fetch-dest")) {
        (Some(mode), _) => mode.trim().eq_ignore_ascii_case("navigate"),
        (None, Some(dest)) => matches!(
            dest.trim().to_ascii_lowercase().as_str(),
            "document" | "iframe" | "frame" | "fencedframe"
        ),
        (None, None) => {
            header("upgrade-insecure-requests").is_some()
                || header("sec-fetch-user").is_some()
                || (!has_body && (method == Method::GET || method == Method::HEAD))
        }
    };
    if navigation {
        RequestKind::Navigation
    } else if has_body || method == Method::POST || method == Method::PUT || method == Method::PATCH
    {
        RequestKind::FetchWithBody
    } else {
        RequestKind::Fetch
    }
}

impl HeaderOrder {
    pub(crate) fn template(&self, kind: RequestKind) -> &HeaderTemplate {
        match kind {
            RequestKind::Navigation => &self.navigation,
            RequestKind::Fetch => &self.fetch,
            RequestKind::FetchWithBody => &self.fetch_with_body,
        }
    }
}

impl HeaderTemplate {
    /// Complete wire order: template names at their positions, every other name
    /// (in the given order, first occurrence wins) at the application slot.
    pub(crate) fn order<'a>(
        &self,
        names: impl IntoIterator<Item = &'a HeaderName>,
    ) -> OrigHeaderMap {
        let mut unknown: Vec<&HeaderName> = Vec::new();
        for name in names {
            let known = self.before.contains(&name.as_str()) || self.after.contains(&name.as_str());
            if !known && !unknown.contains(&name) {
                unknown.push(name);
            }
        }
        let mut order =
            OrigHeaderMap::with_capacity(self.before.len() + unknown.len() + self.after.len());
        for name in self.before {
            order.insert(*name);
        }
        for name in unknown {
            order.insert(name.clone());
        }
        for name in self.after {
            order.insert(*name);
        }
        order
    }
}

/// RFC 9218 urgency of a `priority` header value; absent or invalid `u` means 3.
pub(crate) fn urgency(priority: &str) -> u8 {
    priority
        .split(',')
        .filter_map(|member| member.trim().strip_prefix("u="))
        .filter_map(|value| value.trim().parse::<u8>().ok())
        .next_back()
        .filter(|urgency| *urgency <= 7)
        .unwrap_or(3)
}

/// Effective HTTP/2 weight (1..=256) Chrome sends for an urgency: Chromium maps
/// urgency to a SPDY priority and that to `Spdy3PriorityToHttp2Weight`.
pub(crate) fn weight(urgency: u8) -> u16 {
    const WEIGHTS: [u16; 8] = [256, 220, 183, 147, 110, 74, 37, 1];
    WEIGHTS[usize::from(urgency.min(7))]
}
