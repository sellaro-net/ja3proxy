//! Context-owned pools with socket-bound egress policy. No preflight DNS cache.

pub use crate::validation::validate_origin;
use crate::{
    emulation::{parse_tls_profile, profile_emulation},
    error::{ErrorCode, TransportError},
    models::{ConnectionSpec, Egress},
    validation::{blocked_hostname, parse_target, public_ip},
};
use std::{
    net::{IpAddr, SocketAddr},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use wreq::{
    Client, Method, RequestBuilder,
    dns::{Addrs, GaiResolver, Name, Resolve, Resolving},
    header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT},
};

const MAX_DNS_ADDRESSES: usize = 64;
const POOL_CONNECTIONS: usize = 32;
const IDLE_PER_HOST: usize = 4;
const POOL_IDLE: Duration = Duration::from_secs(30);

pub struct NetworkPolicy {
    allow_private_ips: bool,
}

impl NetworkPolicy {
    pub fn new(allow_private_ips: bool) -> Self {
        Self { allow_private_ips }
    }

    fn check_host(&self, host: &str) -> Result<(), TransportError> {
        let host = host.trim_start_matches('[').trim_end_matches(']');
        if !self.allow_private_ips
            && (blocked_hostname(host) || host.parse::<IpAddr>().is_ok_and(|ip| !public_ip(ip)))
        {
            return Err(TransportError::from_code(ErrorCode::SsrfBlocked));
        }
        Ok(())
    }

    fn check_addresses(&self, addresses: &[SocketAddr]) -> Result<(), TransportError> {
        if addresses.is_empty() || addresses.len() > MAX_DNS_ADDRESSES {
            return Err(TransportError::from_code(ErrorCode::DnsError));
        }
        // Reject the whole answer, never filter out forbidden answers and race the rest.
        if !self.allow_private_ips && addresses.iter().any(|address| !public_ip(address.ip())) {
            return Err(TransportError::from_code(ErrorCode::SsrfBlocked));
        }
        Ok(())
    }
}

struct GuardedResolver {
    policy: Arc<NetworkPolicy>,
    upstream: Arc<dyn Resolve>,
    closed: Arc<AtomicBool>,
}

impl Resolve for GuardedResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let policy = self.policy.clone();
        let upstream = self.upstream.clone();
        let closed = self.closed.clone();
        Box::pin(async move {
            ensure_open(&closed)?;
            policy.check_host(name.as_str())?;
            let addresses = if let Ok(ip) = name.as_str().parse::<IpAddr>() {
                vec![SocketAddr::new(ip, 0)]
            } else {
                upstream
                    .resolve(name)
                    .await
                    .map_err(|_| TransportError::from_code(ErrorCode::DnsError))?
                    .take(MAX_DNS_ADDRESSES + 1)
                    .collect::<Vec<_>>()
            };
            policy.check_addresses(&addresses)?;
            ensure_open(&closed)?;
            // These exact addresses go into TCP connect / numeric proxy negotiation.
            // The vendored opt-in connector never resolves them again elsewhere.
            Ok(Box::new(addresses.into_iter()) as Addrs)
        })
    }
}

fn ensure_open(closed: &AtomicBool) -> Result<(), TransportError> {
    if closed.load(Ordering::Acquire) {
        Err(TransportError::from_code(ErrorCode::ContextNotFound))
    } else {
        Ok(())
    }
}

pub struct NetworkClient {
    client: Mutex<Option<Client>>,
    policy: Arc<NetworkPolicy>,
    closed: Arc<AtomicBool>,
    fixed_user_agent: Option<HeaderValue>,
}

impl NetworkClient {
    pub async fn new(
        policy: Arc<NetworkPolicy>,
        spec: ConnectionSpec,
    ) -> Result<Self, TransportError> {
        Self::with_resolver(policy, spec, Arc::new(GaiResolver::new()))
    }

    fn with_resolver(
        policy: Arc<NetworkPolicy>,
        spec: ConnectionSpec,
        upstream: Arc<dyn Resolve>,
    ) -> Result<Self, TransportError> {
        let profile = parse_tls_profile(&spec.identity.tls_profile)?;
        let closed = Arc::new(AtomicBool::new(false));
        let resolver = GuardedResolver {
            policy: policy.clone(),
            upstream,
            closed: closed.clone(),
        };
        let fixed_user_agent = spec
            .identity
            .user_agent
            .as_deref()
            .map(|value| {
                if value.len() > 1024 || value.is_empty() {
                    return Err(TransportError::from_code(ErrorCode::InvalidRequest));
                }
                HeaderValue::from_str(value)
                    .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))
            })
            .transpose()?;
        let mut builder = Client::builder()
            .emulation(profile_emulation(profile, spec.identity.emulate_headers))
            .auto_accept_encoding(spec.identity.emulate_headers)
            .no_proxy()
            .dns_resolver(resolver)
            .resolver_enforced_egress(true)
            .redirect(wreq::redirect::Policy::none())
            .retry(wreq::retry::Policy::never())
            .referer(false)
            .connection_verbose(false)
            .tls_cert_verification(true)
            .tls_verify_hostname(true)
            .tls_sni(true)
            .pool_max_size(POOL_CONNECTIONS)
            .pool_max_idle_per_host(IDLE_PER_HOST)
            .pool_idle_timeout(POOL_IDLE)
            .connect_timeout(Duration::from_secs(30));
        if let Some(user_agent) = &fixed_user_agent {
            builder = builder.user_agent(user_agent.clone());
        }
        if let Egress::Proxy { url } = spec.egress {
            let proxy = parse_proxy(&url)?;
            policy.check_host(
                proxy
                    .host_str()
                    .ok_or_else(|| TransportError::from_code(ErrorCode::InvalidRequest))?,
            )?;
            builder = builder.proxy(
                wreq::Proxy::all(proxy.as_str())
                    .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?,
            );
        }
        let client = builder
            .build()
            .map_err(|_| TransportError::from_code(ErrorCode::TlsError))?;
        Ok(Self {
            client: Mutex::new(Some(client)),
            policy,
            closed,
            fixed_user_agent,
        })
    }

    pub async fn request(
        &self,
        method: Method,
        url: &str,
    ) -> Result<RequestBuilder, TransportError> {
        let target = parse_target(url)?;
        self.policy.check_host(
            target
                .host_str()
                .ok_or_else(|| TransportError::from_code(ErrorCode::InvalidRequest))?,
        )?;
        ensure_open(&self.closed)?;
        let guard = self
            .client
            .lock()
            .map_err(|_| TransportError::from_code(ErrorCode::Unknown))?;
        let client = guard
            .as_ref()
            .ok_or_else(|| TransportError::from_code(ErrorCode::ContextNotFound))?;
        Ok(client.request(method, target.as_str()))
    }

    /// Apply repeated caller headers while protecting transport framing and fixed identity.
    /// Core additionally owns managed Cookie selection; the network never stores cookies.
    pub fn apply_headers(
        &self,
        builder: RequestBuilder,
        headers: &[(String, String)],
    ) -> Result<RequestBuilder, TransportError> {
        ensure_open(&self.closed)?;
        let mut map = HeaderMap::with_capacity(headers.len());
        let mut user_agent_seen = false;
        for (name, value) in headers {
            let name = HeaderName::from_bytes(name.as_bytes())
                .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?;
            if forbidden_header(name.as_str()) {
                return Err(TransportError::from_code(ErrorCode::InvalidRequest));
            }
            let mut value = HeaderValue::from_str(value)
                .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))?;
            if name == USER_AGENT {
                if user_agent_seen
                    || self
                        .fixed_user_agent
                        .as_ref()
                        .is_some_and(|fixed| fixed != value)
                {
                    return Err(TransportError::from_code(ErrorCode::ContextConflict));
                }
                user_agent_seen = true;
            }
            if matches!(name.as_str(), "authorization" | "cookie") {
                value.set_sensitive(true);
            }
            map.append(name, value);
        }
        Ok(builder.headers(map))
    }

    /// Stop future use and release idle pool/credentials. Core cancels active request
    /// owners; their existing builder/response references are released on cancellation.
    pub fn close(&self) {
        self.closed.store(true, Ordering::Release);
        match self.client.lock() {
            Ok(mut client) => {
                client.take();
            }
            Err(poisoned) => {
                poisoned.into_inner().take();
            }
        }
    }
}

impl Drop for NetworkClient {
    fn drop(&mut self) {
        self.close();
    }
}

fn forbidden_header(name: &str) -> bool {
    matches!(
        name,
        "host"
            | "content-length"
            | "transfer-encoding"
            | "connection"
            | "keep-alive"
            | "proxy-authorization"
            | "proxy-authenticate"
            | "proxy-connection"
            | "te"
            | "trailer"
            | "upgrade"
            | "traceparent"
            | "tracestate"
            | "baggage"
    )
}

fn parse_proxy(value: &str) -> Result<url::Url, TransportError> {
    let invalid = || TransportError::from_code(ErrorCode::InvalidRequest);
    if value.len() > 8192 {
        return Err(invalid());
    }
    let proxy = url::Url::parse(value).map_err(|_| invalid())?;
    if !matches!(
        proxy.scheme(),
        "http" | "https" | "socks4" | "socks4a" | "socks5" | "socks5h"
    ) {
        return Err(TransportError::from_code(ErrorCode::UnsupportedCapability));
    }
    if proxy.host().is_none()
        || proxy.query().is_some()
        || proxy.fragment().is_some()
        || !matches!(proxy.path(), "" | "/")
        || proxy.port() == Some(0)
    {
        return Err(invalid());
    }
    let username = percent_encoding::percent_decode_str(proxy.username())
        .decode_utf8()
        .map_err(|_| invalid())?;
    let password = percent_encoding::percent_decode_str(proxy.password().unwrap_or(""))
        .decode_utf8()
        .map_err(|_| invalid())?;
    if username.chars().any(char::is_control) || password.chars().any(char::is_control) {
        return Err(invalid());
    }
    if matches!(proxy.scheme(), "socks4" | "socks4a") && !password.is_empty() {
        return Err(TransportError::from_code(ErrorCode::UnsupportedCapability));
    }
    if proxy.scheme().starts_with("socks")
        && (username.len() > 255
            || password.len() > 255
            || (proxy.password().is_some() && username.is_empty()))
    {
        return Err(invalid());
    }
    Ok(proxy)
}

#[cfg(test)]
mod tests;
