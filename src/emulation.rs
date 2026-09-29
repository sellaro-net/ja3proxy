//! Canonical profile and header discovery from the exact pinned emulation registry.

use crate::error::{ErrorCode, TransportError};
use crate::models::HeaderDescriptor;
use wreq::IntoEmulation;
use wreq::header::{HeaderValue, USER_AGENT};
use wreq_util::Profile;

/// Profiles this service adds on top of the pinned `wreq-util` registry.
///
/// `chrome_150`: Chrome 150 announces the post-quantum ML-DSA signature
/// algorithms (0x0904-0x0906) in its ClientHello; otherwise its handshake and
/// HTTP/2 settings equal Chrome 149. Upstream `wreq-util` carries this profile
/// only on unreleased `main` (`tls_options!(8, CURVES_3, NEW_SIGALGS_LIST)`);
/// the list below is copied verbatim from there. Since 2026-09-29 StockX
/// rejects Chrome handshakes without ML-DSA with its bot guard.
const CHROME_150: &str = "chrome_150";
const CHROME_150_SIGALGS: &str = "mldsa44:mldsa65:mldsa87:ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";
const CHROME_150_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const CHROME_150_SEC_CH_UA: &str =
    "\"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"150\", \"Google Chrome\";v=\"150\"";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TlsProfile {
    Registry(Profile),
    Chrome150,
}

pub fn parse_tls_profile(profile: &str) -> Result<TlsProfile, TransportError> {
    if profile == CHROME_150 {
        return Ok(TlsProfile::Chrome150);
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

fn registry_name(profile: &Profile) -> String {
    serde_json::to_value(profile)
        .expect("profile registry serializes")
        .as_str()
        .expect("profile registry uses strings")
        .to_owned()
}

fn all_profiles() -> Vec<(TlsProfile, String)> {
    Profile::VARIANTS
        .iter()
        .map(|profile| (TlsProfile::Registry(*profile), registry_name(profile)))
        .chain(std::iter::once((
            TlsProfile::Chrome150,
            CHROME_150.to_owned(),
        )))
        .collect()
}

pub fn available_profiles() -> Vec<String> {
    all_profiles().into_iter().map(|(_, name)| name).collect()
}

fn registry_emulation(profile: Profile, headers: bool) -> wreq::Emulation {
    wreq_util::Emulation::builder()
        .profile(profile)
        .headers(headers)
        .build()
        .into_emulation()
}

pub(crate) fn profile_emulation(profile: TlsProfile, headers: bool) -> wreq::Emulation {
    match profile {
        TlsProfile::Registry(profile) => registry_emulation(profile, headers),
        TlsProfile::Chrome150 => {
            let mut emulation = registry_emulation(Profile::Chrome149, headers);
            emulation
                .tls_options
                .as_mut()
                .expect("Chrome profiles carry TLS options")
                .sigalgs_list = Some(CHROME_150_SIGALGS.into());
            if headers {
                emulation
                    .headers
                    .insert(USER_AGENT, HeaderValue::from_static(CHROME_150_USER_AGENT));
                emulation
                    .headers
                    .insert("sec-ch-ua", HeaderValue::from_static(CHROME_150_SEC_CH_UA));
            }
            emulation
        }
    }
}

pub fn header_descriptors() -> Vec<HeaderDescriptor> {
    all_profiles()
        .into_iter()
        .map(|(profile, tls_profile)| {
            let emulation = profile_emulation(profile, true);
            HeaderDescriptor {
                tls_profile,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sellaro_profiles_remain_canonical_and_injection_is_rejected() {
        for name in [
            "okhttp_4.12",
            "chrome_120",
            "chrome_133",
            "safari_ios_17.2",
            "chrome_150",
        ] {
            assert!(parse_tls_profile(name).is_ok());
        }
        for name in [
            "chrome_133\"",
            "chrome_133\\u0022",
            "Chrome133",
            " chrome_133",
            "chrome_150 ",
        ] {
            assert_eq!(
                parse_tls_profile(name).unwrap_err().code,
                ErrorCode::InvalidProfile
            );
        }
    }

    #[test]
    fn chrome_150_announces_ml_dsa_and_otherwise_matches_chrome_149() {
        let chrome_150 = profile_emulation(TlsProfile::Chrome150, true);
        let chrome_149 = registry_emulation(Profile::Chrome149, true);
        let sigalgs = chrome_150
            .tls_options
            .as_ref()
            .unwrap()
            .sigalgs_list
            .as_deref();
        assert!(sigalgs.unwrap().starts_with("mldsa44:mldsa65:mldsa87:"));
        assert_ne!(
            chrome_149
                .tls_options
                .as_ref()
                .unwrap()
                .sigalgs_list
                .as_deref(),
            sigalgs,
        );
        assert_eq!(chrome_150.headers[USER_AGENT], CHROME_150_USER_AGENT);
        assert_eq!(chrome_150.headers["sec-ch-ua"], CHROME_150_SEC_CH_UA);
        assert!(available_profiles().iter().any(|name| name == CHROME_150));
    }
}
