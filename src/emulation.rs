//! Canonical profile and header discovery from the exact pinned emulation registry,
//! plus the Chrome profiles this service adds on top of it and per-request
//! browser shaping (header order, HTTP/2 HEADERS weight).

mod chrome;
#[cfg(test)]
mod tests;

use crate::error::{ErrorCode, TransportError};
use crate::models::{HeaderDescriptor, HeaderOrder};
use std::{borrow::Cow, collections::BTreeMap};
use wreq::{
    IntoEmulation, Method,
    header::{ACCEPT, HeaderMap, HeaderValue, OrigHeaderMap, USER_AGENT},
    http2::{HeadersPriority, StreamId},
};
use wreq_util::{Platform, Profile};

/// A Chrome release this service adds on top of the pinned `wreq-util` registry.
/// Cipher suites, curves, ALPS and HTTP/2 settings come from the registry's
/// `chrome_149`; the fields below describe what later releases changed.
#[derive(Debug)]
pub struct CustomChrome {
    name: &'static str,
    major: u16,
    /// Platform of the default headers; `None` keeps the registry default (macOS).
    platform: Option<Platform>,
    user_agent: &'static str,
    /// Navigation `accept`; `None` keeps the registry value.
    navigation_accept: Option<&'static str>,
    /// GREASE value in `signature_algorithms` (Chrome >= 154).
    grease_sigalgs: bool,
    /// `trust_anchors` extension with Chrome's Trust Anchor IDs (Chrome >= 154).
    trust_anchors: bool,
    /// `server_padding` extension request (Chrome >= 154 sends a zero-byte request).
    server_padding: Option<u16>,
    /// HEADERS weight follows the request's `priority` urgency like Chrome.
    weight_from_priority: bool,
}

/// `chrome_150`: announces the post-quantum ML-DSA signature algorithms
/// (0x0904-0x0906); otherwise its handshake and HTTP/2 settings equal Chrome 149.
static CHROME_150: CustomChrome = CustomChrome {
    name: "chrome_150",
    major: 150,
    platform: None,
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    navigation_accept: None,
    grease_sigalgs: false,
    trust_anchors: false,
    server_padding: None,
    weight_from_priority: false,
};

/// `chrome_154`: Chrome 150 plus signature-algorithm GREASE, `trust_anchors`
/// (0xca34) and `server_padding` (0x12e0); Windows identity.
static CHROME_154: CustomChrome = CustomChrome {
    name: "chrome_154",
    major: 154,
    platform: Some(Platform::Windows),
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    navigation_accept: None,
    grease_sigalgs: true,
    trust_anchors: true,
    server_padding: Some(0),
    weight_from_priority: true,
};

/// `chrome_155`: network fingerprint identical to Chrome 154; the navigation
/// `accept` adds `image/jxl`.
static CHROME_155: CustomChrome = CustomChrome {
    name: "chrome_155",
    major: 155,
    platform: Some(Platform::Windows),
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    navigation_accept: Some(chrome::NAVIGATION_ACCEPT_JXL),
    grease_sigalgs: true,
    trust_anchors: true,
    server_padding: Some(0),
    weight_from_priority: true,
};

static CUSTOM_PROFILES: [&CustomChrome; 3] = [&CHROME_150, &CHROME_154, &CHROME_155];

/// Moving names accepted wherever a profile is accepted. They resolve to one
/// concrete profile; diagnostics and context metadata report the concrete name.
const PROFILE_ALIASES: [(&str, &str); 1] = [("chrome_stable", "chrome_155")];

#[derive(Debug, Clone, Copy)]
pub enum TlsProfile {
    Registry(Profile),
    Custom(&'static CustomChrome),
}

impl PartialEq for TlsProfile {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Registry(a), Self::Registry(b)) => a == b,
            (Self::Custom(a), Self::Custom(b)) => a.name == b.name,
            _ => false,
        }
    }
}
impl Eq for TlsProfile {}

pub fn parse_tls_profile(profile: &str) -> Result<TlsProfile, TransportError> {
    let profile = PROFILE_ALIASES
        .iter()
        .find(|(alias, _)| *alias == profile)
        .map_or(profile, |(_, target)| *target);
    if let Some(custom) = CUSTOM_PROFILES.iter().find(|custom| custom.name == profile) {
        return Ok(TlsProfile::Custom(custom));
    }
    // Parse a JSON string value, never interpolate untrusted text into JSON syntax.
    let parsed: Profile = serde_json::from_value(serde_json::Value::String(profile.to_owned()))
        .map_err(|_| TransportError::from_code(ErrorCode::InvalidProfile))?;
    if serde_json::to_value(parsed)
        .ok()
        .and_then(|v| v.as_str().map(str::to_owned))
        .as_deref()
        != Some(profile)
    {
        return Err(TransportError::from_code(ErrorCode::InvalidProfile));
    }
    Ok(TlsProfile::Registry(parsed))
}

/// Concrete profile name for an accepted name or alias.
pub fn canonical_profile_name(profile: &str) -> Result<String, TransportError> {
    parse_tls_profile(profile).map(TlsProfile::name)
}

fn registry_name(profile: &Profile) -> String {
    serde_json::to_value(profile)
        .expect("profile registry serializes")
        .as_str()
        .expect("profile registry uses strings")
        .to_owned()
}

impl TlsProfile {
    pub fn name(self) -> String {
        match self {
            Self::Registry(profile) => registry_name(&profile),
            Self::Custom(custom) => custom.name.to_owned(),
        }
    }

    /// Per-request shaping. With `headerOrder: "browser"`, Chrome profiles order headers
    /// like Chrome's network stack; only profiles that opt in derive the HEADERS weight
    /// per request, all others keep their connection default.
    pub(crate) fn shaping(self) -> RequestShaping {
        match self {
            Self::Registry(profile) => RequestShaping {
                order: registry_name(&profile)
                    .starts_with("chrome_")
                    .then_some(&chrome::HEADER_ORDER),
                weight_from_priority: false,
            },
            Self::Custom(custom) => RequestShaping {
                order: Some(&chrome::HEADER_ORDER),
                weight_from_priority: custom.weight_from_priority,
            },
        }
    }
}

fn all_profiles() -> Vec<TlsProfile> {
    Profile::VARIANTS
        .iter()
        .map(|profile| TlsProfile::Registry(*profile))
        .chain(
            CUSTOM_PROFILES
                .iter()
                .map(|custom| TlsProfile::Custom(custom)),
        )
        .collect()
}

pub fn available_profiles() -> Vec<String> {
    all_profiles().into_iter().map(TlsProfile::name).collect()
}

/// Alias name → concrete profile name.
pub fn profile_aliases() -> BTreeMap<String, String> {
    PROFILE_ALIASES
        .iter()
        .map(|(alias, target)| ((*alias).to_owned(), (*target).to_owned()))
        .collect()
}

fn registry_emulation(
    profile: Profile,
    platform: Option<Platform>,
    headers: bool,
) -> wreq::Emulation {
    let builder = wreq_util::Emulation::builder()
        .profile(profile)
        .headers(headers);
    match platform {
        Some(platform) => builder.platform(platform).build().into_emulation(),
        None => builder.build().into_emulation(),
    }
}

fn custom_emulation(custom: &CustomChrome, headers: bool) -> wreq::Emulation {
    let mut emulation = registry_emulation(Profile::Chrome149, custom.platform, headers);
    let tls = emulation
        .tls_options
        .as_mut()
        .expect("Chrome profiles carry TLS options");
    tls.sigalgs_list = Some(chrome::MLDSA_SIGALGS.into());
    if custom.grease_sigalgs {
        tls.grease_sigalgs_enabled = Some(true);
    }
    if custom.trust_anchors {
        tls.trust_anchors = Some(Cow::Borrowed(chrome::TRUST_ANCHOR_IDS));
    }
    tls.server_padding_request = custom.server_padding;
    if headers {
        emulation
            .headers
            .insert(USER_AGENT, HeaderValue::from_static(custom.user_agent));
        emulation.headers.insert(
            "sec-ch-ua",
            HeaderValue::from_str(&chrome::sec_ch_ua(custom.major))
                .expect("derived client hint is a valid header value"),
        );
        if let Some(accept) = custom.navigation_accept {
            emulation
                .headers
                .insert(ACCEPT, HeaderValue::from_static(accept));
        }
    }
    emulation
}

pub(crate) fn profile_emulation(profile: TlsProfile, headers: bool) -> wreq::Emulation {
    match profile {
        TlsProfile::Registry(profile) => registry_emulation(profile, None, headers),
        TlsProfile::Custom(custom) => custom_emulation(custom, headers),
    }
}

pub fn header_descriptors() -> Vec<HeaderDescriptor> {
    all_profiles()
        .into_iter()
        .map(|profile| {
            let emulation = profile_emulation(profile, true);
            HeaderDescriptor {
                tls_profile: profile.name(),
                headers: emulation
                    .headers
                    .iter()
                    .map(|(name, value)| {
                        (
                            name.as_str().to_owned(),
                            value
                                .to_str()
                                .expect("static profile header is ASCII")
                                .to_owned(),
                        )
                    })
                    .collect(),
            }
        })
        .collect()
}

/// How a profile shapes each request beyond its static emulation.
#[derive(Debug, Clone, Copy)]
pub(crate) struct RequestShaping {
    order: Option<&'static chrome::HeaderOrder>,
    weight_from_priority: bool,
}

/// Wire order and HTTP/2 HEADERS weight for one request; `None` keeps the client default.
#[derive(Debug, Default)]
pub(crate) struct Shaped {
    pub(crate) orig_headers: Option<OrigHeaderMap>,
    /// Effective weight (1..=256).
    pub(crate) weight: Option<u16>,
}

impl Shaped {
    /// HEADERS priority for the weight: root dependency with the exclusive flag, as
    /// Chrome sends it. The wire value is weight - 1 (RFC 9113 §5.3.2).
    pub(crate) fn headers_priority(&self) -> Option<HeadersPriority> {
        self.weight.map(|weight| {
            let wire = u8::try_from(weight - 1).expect("weights are 1..=256");
            HeadersPriority::new(StreamId::zero(), wire, true)
        })
    }
}

impl RequestShaping {
    /// `caller` holds the request's own headers, `defaults` the client default
    /// headers the request inherits (empty without header emulation). The request
    /// kind and urgency come from the effective values (caller before default).
    /// The Chrome order template applies only to [`HeaderOrder::Browser`]; the
    /// caller order is otherwise left to the client unchanged.
    pub(crate) fn shape(
        self,
        method: &Method,
        has_body: bool,
        caller: &HeaderMap,
        defaults: &HeaderMap,
        header_order: HeaderOrder,
    ) -> Shaped {
        let effective = |name: &str| {
            caller
                .get(name)
                .or_else(|| defaults.get(name))
                .and_then(|value| value.to_str().ok())
        };
        let template = match header_order {
            HeaderOrder::Browser => self.order,
            HeaderOrder::Caller => None,
        };
        let orig_headers = template.map(|order| {
            let kind = chrome::request_kind(method, has_body, effective);
            let names = caller
                .keys()
                .chain(defaults.keys().filter(|name| !caller.contains_key(*name)));
            order.template(kind).order(names)
        });
        let weight = self
            .weight_from_priority
            .then(|| effective("priority"))
            .flatten()
            .map(|priority| chrome::weight(chrome::urgency(priority)));
        Shaped {
            orig_headers,
            weight,
        }
    }
}
