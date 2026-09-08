//! Canonical profile and header discovery from the exact pinned emulation registry.

use crate::error::{ErrorCode, TransportError};
use serde::Serialize;
use wreq::IntoEmulation;
use wreq_util::Profile;

pub fn parse_tls_profile(profile: &str) -> Result<Profile, TransportError> {
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
    Ok(parsed)
}

pub fn available_profiles() -> Vec<String> {
    Profile::VARIANTS
        .iter()
        .map(|profile| {
            serde_json::to_value(profile)
                .expect("profile registry serializes")
                .as_str()
                .expect("profile registry uses strings")
                .to_owned()
        })
        .collect()
}

pub(crate) fn profile_emulation(profile: Profile, headers: bool) -> wreq::Emulation {
    wreq_util::Emulation::builder()
        .profile(profile)
        .headers(headers)
        .build()
        .into_emulation()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderDescriptor {
    tls_profile: String,
    headers: Vec<(String, String)>,
}

pub fn header_descriptors() -> Vec<HeaderDescriptor> {
    Profile::VARIANTS
        .iter()
        .zip(available_profiles())
        .map(|(profile, tls_profile)| {
            let emulation = profile_emulation(*profile, true);
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
        for name in ["okhttp_4.12", "chrome_120", "chrome_133", "safari_ios_17.2"] {
            assert!(parse_tls_profile(name).is_ok());
        }
        for name in [
            "chrome_133\"",
            "chrome_133\\u0022",
            "Chrome133",
            " chrome_133",
        ] {
            assert_eq!(
                parse_tls_profile(name).unwrap_err().code,
                ErrorCode::InvalidProfile
            );
        }
    }
}
