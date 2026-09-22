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

/// W3C version 00 context. Incoming IDs are never forwarded upstream.
pub struct TraceContext {
    pub trace_id: String,
    pub span_id: String,
    pub parent_span_id: Option<String>,
}

pub fn trace_context(headers: &axum::http::HeaderMap) -> TraceContext {
    let mut values = headers.get_all("traceparent").iter();
    let parent = values
        .next()
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
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
            Some((value[3..35].to_owned(), value[36..52].to_owned()))
        });
    let (trace_id, parent_span_id) = match parent {
        Some((trace_id, span_id)) => (trace_id, Some(span_id)),
        None => (uuid::Uuid::new_v4().simple().to_string(), None),
    };
    // The variant bits in the second half of a v4 UUID make this nonzero.
    let span = uuid::Uuid::new_v4().simple().to_string();
    TraceContext {
        trace_id,
        span_id: span[16..].to_owned(),
        parent_span_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn valid_parent_and_invalid_or_missing_context() {
        let mut headers = axum::http::HeaderMap::new();
        let missing = trace_context(&headers);
        assert_eq!(missing.trace_id.len(), 32);
        assert!(missing.trace_id.bytes().any(|byte| byte != b'0'));
        assert!(missing.parent_span_id.is_none());
        headers.insert(
            "traceparent",
            "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
                .parse()
                .unwrap(),
        );
        let valid = trace_context(&headers);
        assert_eq!(valid.trace_id, "0123456789abcdef0123456789abcdef");
        assert_eq!(valid.parent_span_id.as_deref(), Some("0123456789abcdef"));
        assert_eq!(valid.span_id.len(), 16);
        assert_ne!(valid.span_id, "0000000000000000");
        assert_ne!(valid.span_id, valid.parent_span_id.unwrap());
        headers.append(
            "traceparent",
            "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
                .parse()
                .unwrap(),
        );
        let duplicate = trace_context(&headers);
        assert_ne!(duplicate.trace_id, "0123456789abcdef0123456789abcdef");
        assert!(duplicate.parent_span_id.is_none());
        headers.insert(
            "traceparent",
            "00-00000000000000000000000000000000-0123456789abcdef-01"
                .parse()
                .unwrap(),
        );
        assert!(trace_context(&headers).parent_span_id.is_none());
    }
}
