//! Strict transport wire DTOs. Credentials never appear in diagnostics.

use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(tag = "mode", rename_all = "lowercase", deny_unknown_fields)]
pub enum Egress {
    Direct,
    Proxy { url: String },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserIdentity {
    pub tls_profile: String,
    pub emulate_headers: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConnectionSpec {
    pub egress: Egress,
    pub identity: BrowserIdentity,
}

#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RequestMetadata {
    pub request_id: String,
    pub partition: String,
    #[serde(default)]
    pub context_id: Option<String>,
    #[serde(default)]
    pub connection: Option<ConnectionSpec>,
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub has_body: bool,
    #[serde(default)]
    pub body_length: Option<u64>,
    pub timeout_ms: u64,
    pub max_response_bytes: u64,
    pub attempt: u64,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Queued,
    Preparing,
    Upstream,
    Body,
    Complete,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Delivery {
    NotStarted,
    PossiblySent,
    ResponseStarted,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub request_id: String,
    pub attempt: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    pub phase: Phase,
    pub delivery: Delivery,
    pub queue_ms: u64,
    pub headers_ms: Option<u64>,
    pub body_ms: Option<u64>,
    pub total_ms: u64,
    pub request_bytes: u64,
    pub response_bytes: u64,
    pub tls_profile: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_reused: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cookie_revision: Option<u64>,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct ResponseMetadata {
    pub request_id: String,
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub diagnostics: Diagnostics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cookie_revision: Option<u64>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "lowercase")]
pub enum CookieMode {
    External,
    Managed,
}

#[derive(Clone, Deserialize, Serialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateContext {
    pub partition: String,
    pub connection: ConnectionSpec,
    pub cookie_mode: CookieMode,
    pub allowed_origins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ttl_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct ContextInfo {
    pub context_id: String,
    pub partition: String,
    pub expires_at_ms: u64,
    pub revision: u64,
    pub cookie_mode: CookieMode,
    pub identity: BrowserIdentity,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct HeaderDescriptor {
    pub tls_profile: String,
    pub headers: Vec<(String, String)>,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
pub enum ServiceName {
    #[serde(rename = "ja3proxy")]
    Ja3Proxy,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub service: ServiceName,
    pub build: String,
    pub profiles: Vec<String>,
    pub header_descriptors: Vec<HeaderDescriptor>,
    pub framing: FramingCapabilities,
    pub limits: CapabilityLimits,
    pub modes: CapabilityModes,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct FramingCapabilities {
    pub content_type: String,
    pub max_metadata_bytes: usize,
    pub max_data_bytes: usize,
    pub max_upload_frames: usize,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct CapabilityLimits {
    pub max_request_bytes: usize,
    pub max_response_bytes: usize,
    pub max_timeout_ms: u64,
    pub max_concurrent: usize,
    pub max_concurrent_per_partition: usize,
    pub max_queued: usize,
    pub max_queued_per_partition: usize,
    pub max_envelopes: usize,
    pub envelope_timeout_ms: u64,
    pub max_control_bytes: usize,
    pub max_header_bytes: usize,
    pub max_headers: usize,
    pub max_contexts: usize,
    pub max_contexts_per_partition: usize,
    pub context_idle_ttl_ms: u64,
    pub context_max_idle_ttl_ms: u64,
    pub context_max_age_ms: u64,
    pub max_cookies: usize,
    pub max_cookie_bytes: usize,
    pub max_cookie_size: usize,
    pub max_allowed_origins: usize,
    pub registry_capacity: usize,
    pub registry_ttl_ms: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
pub struct CapabilityModes {
    pub egress: Vec<String>,
    pub cookies: Vec<String>,
    pub stream: Vec<String>,
    pub cancel: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PartitionCommand {
    pub partition: String,
}

pub fn valid_opaque(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && value.bytes().all(|b| b.is_ascii_graphic())
}
