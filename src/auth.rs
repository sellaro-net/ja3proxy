//! One dedicated service principal; partitions are authenticated body fields.
use crate::{
    error::{ErrorCode, TransportError},
    handlers::AppState,
};
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use subtle::ConstantTimeEq;

pub const PRINCIPAL: &str = "ja3-service";

pub async fn authenticate(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let mut values = request.headers().get_all("authorization").iter();
    let supplied = values
        .next()
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let valid = supplied.is_some_and(|token| {
        values.next().is_none() && bool::from(token.as_bytes().ct_eq(state.config.token.as_bytes()))
    });
    if !valid {
        let mut response = TransportError::from_code(ErrorCode::Unauthorized).into_response();
        response
            .headers_mut()
            .insert("www-authenticate", "Bearer".parse().unwrap());
        return response;
    }
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert("cache-control", "no-store".parse().unwrap());
    response
}

/// W3C version 00, nonzero trace/span IDs. Internal propagation is not forwarded upstream.
pub fn trace_id(headers: &axum::http::HeaderMap) -> Option<String> {
    let mut values = headers.get_all("traceparent").iter();
    let value = values.next()?.to_str().ok()?;
    if values.next().is_some() || value.len() != 55 || !value.starts_with("00-") {
        return None;
    }
    let bytes = value.as_bytes();
    if bytes[35] != b'-'
        || bytes[52] != b'-'
        || !bytes[3..35]
            .iter()
            .chain(&bytes[36..52])
            .chain(&bytes[53..55])
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
        || bytes[3..35].iter().all(|b| *b == b'0')
        || bytes[36..52].iter().all(|b| *b == b'0')
    {
        return None;
    }
    Some(value[3..35].to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_and_ambiguous_trace_contexts() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            "traceparent",
            "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
                .parse()
                .unwrap(),
        );
        assert_eq!(
            trace_id(&headers).as_deref(),
            Some("0123456789abcdef0123456789abcdef")
        );
        headers.append(
            "traceparent",
            "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
                .parse()
                .unwrap(),
        );
        assert!(trace_id(&headers).is_none());
        headers.insert(
            "traceparent",
            "00-00000000000000000000000000000000-0123456789abcdef-01"
                .parse()
                .unwrap(),
        );
        assert!(trace_id(&headers).is_none());
    }
}
