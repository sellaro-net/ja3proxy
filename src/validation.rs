//! Syntax and address policy. DNS enforcement lives in the socket connector, not here.

use std::net::IpAddr;
use url::Url;

use crate::error::{ErrorCode, TransportError};

pub fn parse_target(value: &str) -> Result<Url, TransportError> {
    let url = Url::parse(value).map_err(|_| invalid_url())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.port_or_known_default() == Some(0)
    {
        return Err(invalid_url());
    }
    Ok(url)
}

pub fn validate_origin(value: &str, allowed_origins: &[String]) -> Result<Url, TransportError> {
    let url = parse_target(value)?;
    let origin = url.origin().ascii_serialization();
    if !allowed_origins.iter().any(|allowed| allowed == &origin) {
        return Err(TransportError::new(
            ErrorCode::SsrfBlocked,
            "Das Ziel liegt außerhalb der erlaubten Ursprünge.",
        ));
    }
    Ok(url)
}

pub(crate) fn invalid_url() -> TransportError {
    TransportError::new(ErrorCode::InvalidRequest, "Die Zieladresse ist ungültig.")
}

pub(crate) fn blocked_hostname(host: &str) -> bool {
    let host = host.trim_end_matches('.');
    host.eq_ignore_ascii_case("localhost")
        || host.to_ascii_lowercase().ends_with(".localhost")
        || [
            "localhost.localdomain",
            "ip6-localhost",
            "ip6-loopback",
            "metadata.google.internal",
            "metadata.google.com",
            "instance-data",
        ]
        .iter()
        .any(|blocked| host.eq_ignore_ascii_case(blocked))
}

/// Conservatively permit unicast global destinations only. IPv4-mapped IPv6 must
/// inherit IPv4 policy; translation/tunnel prefixes are not an escape hatch.
pub(crate) fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !(a == 0
                || a == 10
                || a == 127
                || a >= 224
                || (a == 100 && (64..=127).contains(&b))
                || (a == 169 && b == 254)
                || (a == 172 && (16..=31).contains(&b))
                || (a == 192
                    && ((b == 0 && (c == 0 || c == 2)) || (b == 88 && c == 99) || b == 168))
                || (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
                || (a == 203 && b == 0 && c == 113))
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return public_ip(IpAddr::V4(v4));
            }
            let s = ip.segments();
            (s[0] & 0xe000) == 0x2000
                && !(s[0] == 0x2001 && (s[1] < 0x0200 || s[1] == 0x0db8))
                && s[0] != 0x2002
                && !(s[0] == 0x3fff && s[1] < 0x1000)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_special_ranges_and_embedded_private_addresses() {
        for ip in [
            "0.1.2.3",
            "100.64.0.1",
            "127.0.0.1",
            "169.254.169.254",
            "172.31.255.255",
            "192.0.0.8",
            "198.19.0.1",
            "224.0.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "::ffff:10.0.0.1",
            "::127.0.0.1",
            "64:ff9b::a00:1",
            "64:ff9b:1::a00:1",
            "2002:a00:1::",
            "2001:db8::1",
            "2001::1",
            "fc00::1",
            "fe80::1",
            "fec0::1",
            "ff02::1",
            "3fff::1",
        ] {
            assert!(!public_ip(ip.parse().unwrap()), "{ip}");
        }
        for ip in [
            "1.1.1.1",
            "8.8.8.8",
            "2606:4700:4700::1111",
            "::ffff:8.8.8.8",
        ] {
            assert!(public_ip(ip.parse().unwrap()), "{ip}");
        }
    }

    #[test]
    fn origin_comparison_is_exact_and_normalized() {
        let allowed = vec!["https://example.com".to_owned()];
        assert!(validate_origin("https://EXAMPLE.com:443/path?token=secret", &allowed).is_ok());
        for target in [
            "https://example.com.evil/path",
            "http://example.com",
            "https://example.com:444",
            "https://user:secret@example.com",
            "file:///secret",
        ] {
            assert!(validate_origin(target, &allowed).is_err());
        }
    }
}
