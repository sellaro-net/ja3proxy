//! Stable safe API errors. Never serialize a source error, destination or credentials.

use crate::models::Diagnostics;
use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Unauthorized,
    InvalidRequest,
    UnsupportedCapability,
    InvalidProfile,
    EgressRequired,
    SsrfBlocked,
    BodyTooLarge,
    Busy,
    Timeout,
    Cancelled,
    DnsError,
    ProxyError,
    TlsError,
    ConnectError,
    ProtocolError,
    ContextNotFound,
    ContextConflict,
    ContextLimit,
    CookieLimit,
    DuplicateRequest,
    Unknown,
}

impl ErrorCode {
    pub fn message(self) -> &'static str {
        match self {
            Self::Unauthorized => "Die Dienstauthentifizierung ist ungültig.",
            Self::InvalidRequest => "Die Anfrage ist ungültig.",
            Self::UnsupportedCapability => {
                "Die angeforderte Transportfunktion wird nicht unterstützt."
            }
            Self::InvalidProfile => "Das TLS-Profil wird nicht unterstützt.",
            Self::EgressRequired => "Ein expliziter Verbindungsweg ist erforderlich.",
            Self::SsrfBlocked => "Das Verbindungsziel ist durch die Netzwerkrichtlinie gesperrt.",
            Self::BodyTooLarge => "Die zulässige Anzahl an Nutzdatenbytes wurde überschritten.",
            Self::Busy => "Die begrenzte Transportkapazität ist ausgelastet.",
            Self::Timeout => "Das gesamte Zeitbudget der Anfrage wurde überschritten.",
            Self::Cancelled => "Die Anfrage wurde abgebrochen.",
            Self::DnsError => "Die Namensauflösung ist fehlgeschlagen.",
            Self::ProxyError => "Die Verbindung zum Proxy ist fehlgeschlagen.",
            Self::TlsError => "Die TLS-Verbindung ist fehlgeschlagen.",
            Self::ConnectError => "Die Verbindung zum Ziel ist fehlgeschlagen.",
            Self::ProtocolError => "Der Transportdatenstrom ist ungültig oder unvollständig.",
            Self::ContextNotFound => "Der Transportkontext ist nicht verfügbar.",
            Self::ContextConflict => "Der Transportkontext oder seine Revision ist unvereinbar.",
            Self::ContextLimit => "Die zulässige Anzahl an Transportkontexten wurde erreicht.",
            Self::CookieLimit => "Die zulässige Cookie-Grenze wurde überschritten.",
            Self::DuplicateRequest => "Die Anfragekennung wurde bereits verwendet.",
            Self::Unknown => "Ein interner Transportfehler ist aufgetreten.",
        }
    }

    fn status(self) -> StatusCode {
        match self {
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Busy | Self::ContextLimit => StatusCode::TOO_MANY_REQUESTS,
            Self::Timeout => StatusCode::GATEWAY_TIMEOUT,
            Self::ContextNotFound => StatusCode::NOT_FOUND,
            Self::ContextConflict | Self::DuplicateRequest => StatusCode::CONFLICT,
            Self::BodyTooLarge | Self::CookieLimit => StatusCode::PAYLOAD_TOO_LARGE,
            Self::DnsError | Self::ProxyError | Self::TlsError | Self::ConnectError => {
                StatusCode::BAD_GATEWAY
            }
            Self::Unknown => StatusCode::INTERNAL_SERVER_ERROR,
            _ => StatusCode::BAD_REQUEST,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TransportError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostics: Option<Box<Diagnostics>>,
}

impl TransportError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            diagnostics: None,
        }
    }

    pub fn from_code(code: ErrorCode) -> Self {
        Self::new(code, code.message())
    }

    pub fn with_diagnostics(mut self, diagnostics: Diagnostics) -> Self {
        self.diagnostics = Some(Box::new(diagnostics));
        self
    }
}

impl IntoResponse for TransportError {
    fn into_response(self) -> Response {
        let mut response = (self.code.status(), Json(self)).into_response();
        response
            .headers_mut()
            .insert("cache-control", "no-store".parse().unwrap());
        response
    }
}

impl fmt::Display for TransportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.code.message())
    }
}
impl std::error::Error for TransportError {}

/// Classify typed backend errors, including btls handshake errors nested under connect.
pub fn classify_wreq_error(err: &wreq::Error) -> (ErrorCode, String) {
    if let Some(error) =
        std::iter::successors(std::error::Error::source(err), |cause| cause.source())
            .find_map(|cause| cause.downcast_ref::<TransportError>())
    {
        return (error.code, error.code.message().to_owned());
    }
    let code = if err.is_timeout() {
        ErrorCode::Timeout
    } else if err.is_dns() {
        ErrorCode::DnsError
    } else if err.is_tls()
        || std::iter::successors(std::error::Error::source(err), |cause| cause.source())
            .any(|cause| cause.is::<btls::ssl::Error>())
    {
        ErrorCode::TlsError
    } else if err.is_proxy_connect() {
        ErrorCode::ProxyError
    } else if err.is_connect() {
        ErrorCode::ConnectError
    } else if err.is_request() {
        ErrorCode::InvalidRequest
    } else {
        ErrorCode::ProtocolError
    };
    (code, code.message().to_owned())
}

pub fn from_wreq(error: &wreq::Error) -> TransportError {
    let (code, message) = classify_wreq_error(error);
    TransportError::new(code, message)
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
            let mut hello = [0; 1];
            stream.read_exact(&mut hello).await.unwrap();
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
        let (code, message) = classify_wreq_error(&error);
        assert_eq!(code, ErrorCode::TlsError);
        assert!(!message.contains(&address.to_string()));
    }
}
