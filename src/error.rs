//! Error types and error codes for the proxy service

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use std::fmt;

/// Error codes returned by the API
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[allow(dead_code)]
pub enum ErrorCode {
    /// Connection timeout
    Timeout,
    /// DNS resolution failed
    DnsError,
    /// SSL/TLS error
    TlsError,
    /// Invalid or unreachable proxy
    ProxyError,
    /// Request was cancelled
    Cancelled,
    /// Invalid TLS profile specified
    InvalidProfile,
    /// Invalid request parameters
    InvalidRequest,
    /// Unknown/internal error
    Unknown,
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorCode::Timeout => write!(f, "TIMEOUT"),
            ErrorCode::DnsError => write!(f, "DNS_ERROR"),
            ErrorCode::TlsError => write!(f, "TLS_ERROR"),
            ErrorCode::ProxyError => write!(f, "PROXY_ERROR"),
            ErrorCode::Cancelled => write!(f, "CANCELLED"),
            ErrorCode::InvalidProfile => write!(f, "INVALID_PROFILE"),
            ErrorCode::InvalidRequest => write!(f, "INVALID_REQUEST"),
            ErrorCode::Unknown => write!(f, "UNKNOWN"),
        }
    }
}

/// Standard error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: ErrorCode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_profiles: Option<Vec<String>>,
}

impl ErrorResponse {
    pub fn new(error: impl Into<String>, code: ErrorCode) -> Self {
        Self {
            error: error.into(),
            code,
            available_profiles: None,
        }
    }

    pub fn with_profiles(mut self, profiles: Vec<String>) -> Self {
        self.available_profiles = Some(profiles);
        self
    }
}

/// Proxy error with HTTP status code
#[derive(Debug)]
pub struct ProxyError {
    pub status: StatusCode,
    pub response: ErrorResponse,
}

#[allow(dead_code)]
impl ProxyError {
    pub fn new(status: StatusCode, error: impl Into<String>, code: ErrorCode) -> Self {
        Self {
            status,
            response: ErrorResponse::new(error, code),
        }
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self::new(StatusCode::GATEWAY_TIMEOUT, message, ErrorCode::Timeout)
    }

    pub fn dns_error(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, message, ErrorCode::DnsError)
    }

    pub fn tls_error(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, message, ErrorCode::TlsError)
    }

    pub fn proxy_failure(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, message, ErrorCode::ProxyError)
    }

    pub fn invalid_profile(profile: &str, available: Vec<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            response: ErrorResponse::new(
                format!("Unknown TLS profile: {}", profile),
                ErrorCode::InvalidProfile,
            )
            .with_profiles(available),
        }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message, ErrorCode::InvalidRequest)
    }

    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            message,
            ErrorCode::Unknown,
        )
    }
}

impl IntoResponse for ProxyError {
    fn into_response(self) -> Response {
        (self.status, Json(self.response)).into_response()
    }
}

impl fmt::Display for ProxyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.response.code, self.response.error)
    }
}

impl std::error::Error for ProxyError {}

/// Classify wreq errors into appropriate error codes
pub fn classify_wreq_error(err: &wreq::Error) -> (ErrorCode, String) {
    let message = err.to_string();

    if err.is_timeout() {
        (
            ErrorCode::Timeout,
            format!("Connection timeout: {}", message),
        )
    } else if err.is_connect() {
        // Connection wrappers omit transport details. Inspect their causes,
        // not the request URL embedded in the outer error message.
        let mut source = std::error::Error::source(err);
        while let Some(cause) = source {
            let mut detail = cause.to_string();
            detail.make_ascii_lowercase();
            let classification = if detail.contains("dns")
                || detail.contains("resolve")
                || detail.contains("getaddrinfo")
            {
                Some((ErrorCode::DnsError, "DNS resolution failed"))
            } else if detail.contains("ssl")
                || detail.contains("tls")
                || detail.contains("certificate")
            {
                Some((ErrorCode::TlsError, "TLS error"))
            } else if detail.contains("proxy") {
                Some((ErrorCode::ProxyError, "Proxy connection failed"))
            } else {
                None
            };
            if let Some((code, label)) = classification {
                return (code, format!("{label}: {message}"));
            }
            source = cause.source();
        }
        (ErrorCode::Unknown, format!("Connection error: {}", message))
    } else if err.is_request() {
        (
            ErrorCode::InvalidRequest,
            format!("Invalid request: {}", message),
        )
    } else {
        (ErrorCode::Unknown, message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn classifies_nested_tls_handshake_errors() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut hello = [0; 1024];
            stream.read(&mut hello).await.unwrap();
            // A plaintext response to a TLS ClientHello is a real TLS failure.
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
                .await
                .unwrap();
            // Drain the ClientHello instead of closing with unread data (TCP reset).
            let _ = tokio::io::copy(&mut stream, &mut tokio::io::sink()).await;
        });
        let client = wreq::Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap();
        let error = client
            .get(format!("https://{address}/"))
            .send()
            .await
            .unwrap_err();
        tokio::time::timeout(std::time::Duration::from_secs(5), server)
            .await
            .unwrap()
            .unwrap();
        assert!(matches!(classify_wreq_error(&error).0, ErrorCode::TlsError));
    }
}
