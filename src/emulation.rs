//! Runtime TLS profile mapping backed by wreq-util's profile registry.
//!
//! The public API remains string-based because callers select profiles over
//! JSON. Parsing and profile discovery both use wreq-util's canonical serde
//! names, so the endpoint cannot drift from the pinned emulation release.

use wreq_util::Profile;

/// Parse a TLS profile string into its canonical profile.
///
/// # Arguments
/// * `profile` - Profile string like "chrome_131", "firefox_139", etc.
///
/// # Returns
/// * `Ok(Profile)` if the profile is valid
/// * `Err(String)` with the invalid profile name if not found
///
/// # Example
/// ```
/// let emulation = parse_tls_profile("chrome_131").unwrap();
/// ```
pub fn parse_tls_profile(profile: &str) -> Result<Profile, String> {
    serde_json::from_str(&format!("\"{profile}\"")).map_err(|_| profile.to_owned())
}

/// Get every canonical TLS profile name exposed by the pinned wreq-util release.
///
/// Use the upstream registry so profile discovery stays aligned with parsing.
/// A vector of profile names like ["chrome_100", "chrome_101", ..., "firefox_139"]
pub fn available_profiles() -> Vec<String> {
    Profile::VARIANTS
        .iter()
        .filter_map(|profile| serde_json::to_string(profile).ok())
        .map(|profile| profile.trim_matches('"').to_owned())
        .collect()
}

/// Get the newest Chrome profile shipped by the pinned wreq-util release.
pub const fn default_profile() -> Profile {
    Profile::Chrome149
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_chrome_profile() {
        let result = parse_tls_profile("chrome_131");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_firefox_profile() {
        let result = parse_tls_profile("firefox_139");
        assert!(result.is_ok());
    }

    #[test]
    fn preserves_profiles_required_by_sellaro() {
        for profile in ["okhttp_4.12", "chrome_120", "chrome_133"] {
            assert!(
                parse_tls_profile(profile).is_ok(),
                "required profile {profile} is missing"
            );
        }
    }

    #[test]
    fn test_parse_invalid_profile() {
        let result = parse_tls_profile("invalid_999");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "invalid_999");
    }
}
