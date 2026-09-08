//! Principal/partition-bound transport contexts. Managed cookies are ephemeral HTTP state,
//! not a JavaScript cookie API or a browser SameSite implementation.

pub(crate) mod cookies;
#[cfg(test)]
mod tests;

pub use cookies::{CookieCommand, CookieReply};

use parking_lot::Mutex as SyncMutex;
use std::{
    collections::HashMap,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::{Mutex, MutexGuard};
use tokio_util::sync::CancellationToken;
use url::Url;
use uuid::Uuid;

use crate::{
    error::{ErrorCode, TransportError},
    models::{ContextInfo, CookieMode, CreateContext, Egress},
    network::{NetworkClient, NetworkPolicy, validate_origin},
};
use cookies::ManagedJar;

#[derive(Clone, Copy)]
pub struct ContextLimits {
    pub max_contexts: usize,
    pub max_contexts_per_partition: usize,
    pub default_idle_ttl_ms: u64,
    pub max_idle_ttl_ms: u64,
    pub max_age_ms: u64,
    pub max_cookies: usize,
    pub max_cookie_bytes: usize,
    pub max_cookie_size: usize,
    pub max_allowed_origins: usize,
}

impl Default for ContextLimits {
    fn default() -> Self {
        Self {
            max_contexts: 1024,
            max_contexts_per_partition: 16,
            default_idle_ttl_ms: 300_000,
            max_idle_ttl_ms: 1_800_000,
            max_age_ms: 7_200_000,
            max_cookies: 180,
            max_cookie_bytes: 65_536,
            max_cookie_size: 4096,
            max_allowed_origins: 32,
        }
    }
}

#[derive(Default)]
struct Registry {
    contexts: HashMap<String, Arc<Context>>,
    pending: HashMap<(String, String), usize>,
    pending_count: usize,
    stopped: bool,
}

pub struct ContextStore {
    limits: ContextLimits,
    policy: Arc<NetworkPolicy>,
    registry: SyncMutex<Registry>,
}

// Reserve before asynchronous client construction; dropping a cancelled create releases capacity.
struct Reservation<'a> {
    store: &'a ContextStore,
    owner: (String, String),
}

impl Drop for Reservation<'_> {
    fn drop(&mut self) {
        let mut registry = self.store.registry.lock();
        registry.pending_count -= 1;
        if let Some(count) = registry.pending.get_mut(&self.owner) {
            *count -= 1;
            if *count == 0 {
                registry.pending.remove(&self.owner);
            }
        }
    }
}

struct Lifetime {
    created: Instant,
    touched: Instant,
    created_ms: u64,
    closed: bool,
}

pub struct Context {
    pub client: NetworkClient,
    /// Immutable identity and origin policy. Proxy userinfo is not retained in this public copy.
    pub spec: CreateContext,
    id: String,
    principal: String,
    limits: ContextLimits,
    idle_ttl: Duration,
    lifetime: SyncMutex<Lifetime>,
    cancellation: CancellationToken,
    jar: Option<Mutex<ManagedJar>>,
    revision: AtomicU64,
}

impl ContextStore {
    pub fn new(limits: ContextLimits, policy: Arc<NetworkPolicy>) -> Self {
        Self {
            limits,
            policy,
            registry: SyncMutex::new(Registry::default()),
        }
    }

    pub async fn create(
        &self,
        principal: &str,
        mut spec: CreateContext,
    ) -> Result<ContextInfo, TransportError> {
        validate_key(principal)?;
        validate_key(&spec.partition)?;
        let idle_ms = spec.ttl_ms.unwrap_or(self.limits.default_idle_ttl_ms);
        if idle_ms == 0 || idle_ms > self.limits.max_idle_ttl_ms || self.limits.max_age_ms == 0 {
            return Err(invalid("Die Kontextlaufzeit ist ungültig."));
        }
        let partition_key = normalize_origins(&mut spec, &self.limits)?;
        self.cleanup().await;
        let owner = (principal.to_owned(), spec.partition.clone());
        let reservation = {
            let mut registry = self.registry.lock();
            if registry.stopped {
                return Err(not_found());
            }
            let partition_count = registry
                .contexts
                .values()
                .filter(|context| {
                    context.principal == principal && context.spec.partition == spec.partition
                })
                .count()
                + registry.pending.get(&owner).copied().unwrap_or(0);
            if registry.contexts.len() + registry.pending_count >= self.limits.max_contexts
                || partition_count >= self.limits.max_contexts_per_partition
            {
                return Err(TransportError::new(
                    ErrorCode::ContextLimit,
                    "Das Kontextlimit wurde erreicht.",
                ));
            }
            registry.pending_count += 1;
            *registry.pending.entry(owner.clone()).or_default() += 1;
            Reservation { store: self, owner }
        };
        let client = NetworkClient::new(self.policy.clone(), spec.connection.clone()).await?;
        // Only NetworkClient retains credentials, in its explicitly closeable resource owner.
        if let Egress::Proxy { url } = &mut spec.connection.egress {
            let mut proxy =
                Url::parse(url).map_err(|_| invalid("Die Proxykonfiguration ist ungültig."))?;
            let _ = proxy.set_username("");
            let _ = proxy.set_password(None);
            *url = proxy.into();
        }
        let now = Instant::now();
        let jar = partition_key.map(|key| Mutex::new(ManagedJar::new(self.limits, key)));
        let mut registry = self.registry.lock();
        if registry.stopped {
            client.close();
            return Err(not_found());
        }
        let id = loop {
            let id = Uuid::new_v4().to_string();
            if !registry.contexts.contains_key(&id) {
                break id;
            }
        };
        let context = Arc::new(Context {
            client,
            spec,
            id: id.clone(),
            principal: principal.to_owned(),
            limits: self.limits,
            idle_ttl: Duration::from_millis(idle_ms),
            lifetime: SyncMutex::new(Lifetime {
                created: now,
                touched: now,
                created_ms: unix_ms(),
                closed: false,
            }),
            cancellation: CancellationToken::new(),
            jar,
            revision: AtomicU64::new(0),
        });
        let info = context.info();
        registry.contexts.insert(id, context);
        drop(registry);
        drop(reservation);
        Ok(info)
    }

    pub async fn get(
        &self,
        principal: &str,
        partition: &str,
        id: &str,
    ) -> Result<Arc<Context>, TransportError> {
        let mut registry = self.registry.lock();
        let context = registry
            .contexts
            .get(id)
            .filter(|context| context.principal == principal && context.spec.partition == partition)
            .cloned()
            .ok_or_else(not_found)?;
        if context.touch().is_err() {
            registry.contexts.remove(id);
            context.retire();
            return Err(not_found());
        }
        Ok(context)
    }

    /// Close is idempotent and deliberately indistinguishable for missing and foreign owners.
    pub async fn close(
        &self,
        principal: &str,
        partition: &str,
        id: &str,
    ) -> Result<(), TransportError> {
        let mut registry = self.registry.lock();
        let owned = registry.contexts.get(id).is_some_and(|context| {
            context.principal == principal && context.spec.partition == partition
        });
        if owned && let Some(context) = registry.contexts.remove(id) {
            context.retire();
        }
        Ok(())
    }

    /// Core schedules this sweep even when no requests arrive; there is no access-only expiry leak.
    pub async fn cleanup(&self) {
        let now = Instant::now();
        self.registry.lock().contexts.retain(|_, context| {
            if context.expired(now) {
                context.retire();
                false
            } else {
                true
            }
        });
    }

    pub async fn shutdown(&self) {
        let mut registry = self.registry.lock();
        registry.stopped = true;
        for (_, context) in registry.contexts.drain() {
            context.retire();
        }
    }

    pub async fn cookies(
        &self,
        principal: &str,
        id: &str,
        command: CookieCommand,
    ) -> Result<CookieReply, TransportError> {
        let context = self.get(principal, command.partition(), id).await?;
        let mut jar = context.lock_jar().await?;
        let revision = context.revision.load(Ordering::Acquire);
        let reply = match command {
            CookieCommand::Select { url, .. } => {
                let url = validate_origin(&url, &context.spec.allowed_origins)?;
                CookieReply {
                    revision,
                    cookies: Some(jar.select(&url)),
                    snapshot: None,
                }
            }
            CookieCommand::Export { .. } => CookieReply {
                revision,
                cookies: None,
                snapshot: Some(jar.export()),
            },
            CookieCommand::Set {
                url,
                cookies,
                expected_revision,
                ..
            } => {
                check_revision(revision, expected_revision)?;
                let next = next_revision(revision)?;
                let url = validate_origin(&url, &context.spec.allowed_origins)?;
                jar.set(&url, &cookies)?;
                context.revision.store(next, Ordering::Release);
                CookieReply {
                    revision: next,
                    cookies: None,
                    snapshot: None,
                }
            }
            CookieCommand::Import {
                snapshot,
                expected_revision,
                ..
            } => {
                check_revision(revision, expected_revision)?;
                let next = next_revision(revision)?;
                jar.import(snapshot, &context.spec.allowed_origins)?;
                context.revision.store(next, Ordering::Release);
                CookieReply {
                    revision: next,
                    cookies: None,
                    snapshot: None,
                }
            }
        };
        // A concurrent close marks the context before waiting HTTP users can commit new state.
        if context.expired(Instant::now()) {
            jar.clear();
            return Err(not_found());
        }
        Ok(reply)
    }
}

impl Drop for ContextStore {
    fn drop(&mut self) {
        let registry = self.registry.get_mut();
        for context in registry.contexts.values() {
            context.retire();
        }
    }
}

impl Context {
    pub fn info(&self) -> ContextInfo {
        let lifetime = self.lifetime.lock();
        let expiry = self.deadline(&lifetime);
        ContextInfo {
            context_id: self.id.clone(),
            partition: self.spec.partition.clone(),
            expires_at_ms: lifetime.created_ms.saturating_add(duration_ms(expiry)),
            revision: self.revision.load(Ordering::Acquire),
            cookie_mode: self.spec.cookie_mode,
            identity: self.spec.connection.identity.clone(),
        }
    }

    pub fn cancellation_token(&self) -> CancellationToken {
        self.cancellation.clone()
    }

    pub async fn cookie_access(
        &self,
        url: &Url,
    ) -> Result<Option<CookieAccess<'_>>, TransportError> {
        self.touch()?;
        if !self.spec.allowed_origins.is_empty() {
            validate_origin(url.as_str(), &self.spec.allowed_origins)?;
        }
        if self.spec.cookie_mode == CookieMode::External {
            return Ok(None);
        }
        let jar = self.lock_jar().await?;
        Ok(Some(CookieAccess {
            context: self,
            url: url.clone(),
            jar,
        }))
    }

    fn deadline(&self, lifetime: &Lifetime) -> Duration {
        lifetime
            .touched
            .saturating_duration_since(lifetime.created)
            .saturating_add(self.idle_ttl)
            .min(Duration::from_millis(self.limits.max_age_ms))
    }

    fn expired(&self, now: Instant) -> bool {
        let lifetime = self.lifetime.lock();
        lifetime.closed
            || now.saturating_duration_since(lifetime.created) >= self.deadline(&lifetime)
    }

    fn touch(&self) -> Result<(), TransportError> {
        let now = Instant::now();
        let mut lifetime = self.lifetime.lock();
        if lifetime.closed
            || now.saturating_duration_since(lifetime.created) >= self.deadline(&lifetime)
        {
            return Err(not_found());
        }
        lifetime.touched = now;
        Ok(())
    }

    async fn lock_jar(&self) -> Result<ManagedGuard<'_>, TransportError> {
        let jar = self.jar.as_ref().ok_or_else(|| {
            TransportError::new(
                ErrorCode::UnsupportedCapability,
                "Dieser Kontext verwaltet keine Cookies.",
            )
        })?;
        let mut guard = tokio::select! {
            biased;
            _ = self.cancellation.cancelled() => return Err(not_found()),
            guard = jar.lock() => guard,
        };
        if self.touch().is_err() {
            guard.clear();
            return Err(not_found());
        }
        Ok(ManagedGuard {
            context: self,
            jar: Some(guard),
            #[cfg(test)]
            before_unlock: None,
        })
    }

    fn retire(&self) {
        self.lifetime.lock().closed = true;
        self.cancellation.cancel();
        self.client.close();
        if let Some(jar) = &self.jar {
            // Every active managed guard clears on drop; never wait behind upstream I/O.
            if let Ok(mut jar) = jar.try_lock() {
                jar.clear();
            }
        }
    }
}

impl Drop for Context {
    fn drop(&mut self) {
        self.cancellation.cancel();
        self.client.close();
    }
}

struct ManagedGuard<'a> {
    context: &'a Context,
    jar: Option<MutexGuard<'a, ManagedJar>>,
    #[cfg(test)]
    before_unlock: Option<Box<dyn FnOnce() + Send>>,
}

impl std::ops::Deref for ManagedGuard<'_> {
    type Target = ManagedJar;

    fn deref(&self) -> &Self::Target {
        self.jar.as_deref().expect("managed cookie guard is held")
    }
}

impl std::ops::DerefMut for ManagedGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.jar
            .as_deref_mut()
            .expect("managed cookie guard is held")
    }
}

impl Drop for ManagedGuard<'_> {
    fn drop(&mut self) {
        let lifetime = self.context.lifetime.lock();
        if (lifetime.closed
            || Instant::now().saturating_duration_since(lifetime.created)
                >= self.context.deadline(&lifetime))
            && let Some(jar) = &mut self.jar
        {
            jar.clear();
        }
        #[cfg(test)]
        if let Some(before_unlock) = self.before_unlock.take() {
            before_unlock();
        }
        // Close either marks the lifetime before this check, or observes an unlocked jar.
        // Releasing the lifetime first leaves a check-to-unlock race that can retain secrets.
        drop(self.jar.take());
        drop(lifetime);
    }
}

/// Held from request header selection until response Set-Cookie has been applied.
/// Core must release it before streaming the response body and on every cancellation/error path.
pub struct CookieAccess<'a> {
    context: &'a Context,
    url: Url,
    jar: ManagedGuard<'a>,
}

impl CookieAccess<'_> {
    pub fn header(&self) -> Option<String> {
        self.jar.header(&self.url)
    }

    pub fn revision(&self) -> u64 {
        self.context.revision.load(Ordering::Acquire)
    }

    pub fn absorb(&mut self, headers: &wreq::header::HeaderMap) -> Result<u64, TransportError> {
        self.context.touch()?;
        let values = headers.get_all(wreq::header::SET_COOKIE);
        if values.iter().next().is_none() {
            return Ok(self.revision());
        }
        let next = next_revision(self.revision())?;
        self.jar.absorb(&self.url, values.iter())?;
        if self.context.expired(Instant::now()) {
            self.jar.clear();
            return Err(not_found());
        }
        self.context.revision.store(next, Ordering::Release);
        Ok(next)
    }
}

fn normalize_origins(
    spec: &mut CreateContext,
    limits: &ContextLimits,
) -> Result<Option<String>, TransportError> {
    if spec.allowed_origins.len() > limits.max_allowed_origins
        || (spec.cookie_mode == CookieMode::Managed && spec.allowed_origins.is_empty())
    {
        return Err(invalid("Die erlaubten Cookie-Ursprünge sind ungültig."));
    }
    let mut partition_key = None;
    for origin in &mut spec.allowed_origins {
        if origin.len() > 2048 {
            return Err(invalid("Der Cookie-Ursprung ist zu lang."));
        }
        let url = Url::parse(origin).map_err(|_| invalid("Der Cookie-Ursprung ist ungültig."))?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != "/"
        {
            return Err(invalid("Der Cookie-Ursprung ist ungültig."));
        }
        *origin = url.origin().ascii_serialization();
        if spec.cookie_mode == CookieMode::Managed {
            let host = url
                .host_str()
                .ok_or_else(|| invalid("Der Cookie-Ursprung ist ungültig."))?;
            let site_host = match url.host() {
                Some(url::Host::Domain(_)) => psl::domain_str(host).unwrap_or(host),
                _ => host,
            };
            let site = format!("{}://{site_host}", url.scheme());
            if partition_key.as_ref().is_some_and(|key| key != &site) {
                return Err(invalid(
                    "Eine Cookie-Sitzung muss an eine feste First-Party-Site gebunden sein.",
                ));
            }
            partition_key = Some(site);
        }
    }
    spec.allowed_origins.sort_unstable();
    spec.allowed_origins.dedup();
    Ok(partition_key)
}

fn validate_key(value: &str) -> Result<(), TransportError> {
    if value.is_empty() || value.len() > 128 || value.chars().any(char::is_control) {
        return Err(invalid("Die Kontextzuordnung ist ungültig."));
    }
    Ok(())
}

fn check_revision(actual: u64, expected: u64) -> Result<(), TransportError> {
    if actual != expected {
        return Err(TransportError::new(
            ErrorCode::ContextConflict,
            "Die Cookie-Revision wurde bereits geändert.",
        ));
    }
    Ok(())
}

fn next_revision(revision: u64) -> Result<u64, TransportError> {
    revision
        .checked_add(1)
        .filter(|next| *next <= 9_007_199_254_740_991)
        .ok_or_else(|| {
            TransportError::new(
                ErrorCode::ContextLimit,
                "Die maximale Cookie-Revision wurde erreicht.",
            )
        })
}

fn not_found() -> TransportError {
    TransportError::new(
        ErrorCode::ContextNotFound,
        "Der Kontext ist nicht verfügbar oder abgelaufen.",
    )
}

fn invalid(message: &'static str) -> TransportError {
    TransportError::new(ErrorCode::InvalidRequest, message)
}

fn unix_ms() -> u64 {
    duration_ms(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default(),
    )
}

fn duration_ms(duration: Duration) -> u64 {
    duration.as_millis().min(u64::MAX as u128) as u64
}
