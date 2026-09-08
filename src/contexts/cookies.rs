use std::{collections::HashSet, convert::Infallible, net::IpAddr};

use cookie::{Cookie as RawCookie, SameSite};
use cookie_store::{Cookie, CookieDomain, CookieExpiration, CookieStore};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use url::Url;

use super::{ContextLimits, invalid};
use crate::error::{ErrorCode, TransportError};

#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
pub enum CookieSameSite {
    Strict,
    Lax,
    None,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CookieRecord {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    pub secure: bool,
    pub http_only: bool,
    pub host_only: bool,
    pub partitioned: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub same_site: Option<CookieSameSite>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at_ms: Option<u64>,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CookieSnapshot {
    pub partition_key: String,
    pub cookies: Vec<CookieRecord>,
}

#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(
    tag = "operation",
    rename_all = "lowercase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CookieCommand {
    Select {
        partition: String,
        url: String,
    },
    Set {
        partition: String,
        url: String,
        cookies: Vec<String>,
        expected_revision: u64,
    },
    Export {
        partition: String,
    },
    Import {
        partition: String,
        snapshot: CookieSnapshot,
        expected_revision: u64,
    },
}

impl CookieCommand {
    pub fn partition(&self) -> &str {
        match self {
            Self::Select { partition, .. }
            | Self::Set { partition, .. }
            | Self::Export { partition }
            | Self::Import { partition, .. } => partition,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct CookieReply {
    pub revision: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cookies: Option<Vec<CookieRecord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snapshot: Option<CookieSnapshot>,
}

pub(super) struct ManagedJar {
    // CHIPS and ordinary cookies have distinct keys even for identical name/domain/path.
    stores: [CookieStore; 2],
    partition_key: String,
    limits: ContextLimits,
}

impl ManagedJar {
    pub(super) fn new(limits: ContextLimits, partition_key: String) -> Self {
        Self {
            stores: [CookieStore::new(), CookieStore::new()],
            partition_key,
            limits,
        }
    }

    pub(super) fn clear(&mut self) {
        for store in &mut self.stores {
            store.clear();
        }
    }

    pub(super) fn select(&self, url: &Url) -> Vec<CookieRecord> {
        let mut cookies = self.stores[0].matches(url);
        cookies.extend(self.stores[1].matches(url));
        // RFC path precedence, with deterministic ties (snapshot format has no browser creation time).
        cookies.sort_unstable_by(|left, right| {
            right
                .path
                .len()
                .cmp(&left.path.len())
                .then_with(|| left.name().cmp(right.name()))
                .then_with(|| left.domain.cmp(&right.domain))
                .then_with(|| {
                    left.partitioned()
                        .unwrap_or(false)
                        .cmp(&right.partitioned().unwrap_or(false))
                })
        });
        cookies.into_iter().map(record).collect()
    }

    pub(super) fn header(&self, url: &Url) -> Option<String> {
        let mut cookies = self.stores[0].matches(url);
        cookies.extend(self.stores[1].matches(url));
        if cookies.is_empty() {
            return None;
        }
        cookies.sort_unstable_by(|left, right| {
            right
                .path
                .len()
                .cmp(&left.path.len())
                .then_with(|| left.name().cmp(right.name()))
                .then_with(|| left.domain.cmp(&right.domain))
                .then_with(|| {
                    left.partitioned()
                        .unwrap_or(false)
                        .cmp(&right.partitioned().unwrap_or(false))
                })
        });
        let bytes = cookies
            .iter()
            .map(|cookie| cookie.name().len() + cookie.value().len() + 3)
            .sum::<usize>();
        let mut header = String::with_capacity(bytes);
        for cookie in cookies {
            if !header.is_empty() {
                header.push_str("; ");
            }
            header.push_str(cookie.name());
            header.push('=');
            header.push_str(cookie.value());
        }
        Some(header)
    }

    pub(super) fn export(&self) -> CookieSnapshot {
        let mut cookies: Vec<_> = self
            .stores
            .iter()
            .flat_map(|store| store.iter_unexpired())
            .map(record)
            .collect();
        cookies.sort_unstable_by(|left, right| {
            (&left.domain, &left.path, &left.name, left.partitioned).cmp(&(
                &right.domain,
                &right.path,
                &right.name,
                right.partitioned,
            ))
        });
        CookieSnapshot {
            partition_key: self.partition_key.clone(),
            cookies,
        }
    }

    pub(super) fn set(&mut self, url: &Url, cookies: &[String]) -> Result<(), TransportError> {
        self.apply(url, cookies.iter().map(String::as_str), false)
    }

    pub(super) fn absorb<'a>(
        &mut self,
        url: &Url,
        headers: impl Iterator<Item = &'a wreq::header::HeaderValue>,
    ) -> Result<(), TransportError> {
        let mut strings = Vec::new();
        let mut bytes = 0usize;
        for (index, header) in headers.enumerate() {
            if index >= self.limits.max_cookies {
                return Err(limit());
            }
            bytes = bytes
                .checked_add(header.as_bytes().len())
                .ok_or_else(limit)?;
            if bytes > self.limits.max_cookie_bytes
                || header.as_bytes().len() > self.limits.max_cookie_size
            {
                return Err(limit());
            }
            if let Ok(text) = header.to_str() {
                strings.push(text);
            }
        }
        self.apply(url, strings.into_iter(), true)
    }

    fn apply<'a>(
        &mut self,
        url: &Url,
        cookies: impl Iterator<Item = &'a str>,
        ignore_invalid: bool,
    ) -> Result<(), TransportError> {
        let mut cookies = cookies.peekable();
        if cookies.peek().is_none() {
            return Ok(());
        }
        let mut candidate = self.stores.each_ref().map(live_copy);
        let mut bytes = 0usize;
        for (index, text) in cookies.enumerate() {
            bytes = bytes.checked_add(text.len()).ok_or_else(limit)?;
            if index >= self.limits.max_cookies
                || text.len() > self.limits.max_cookie_size
                || bytes > self.limits.max_cookie_bytes
            {
                return Err(limit());
            }
            let parsed = (|| {
                if text.bytes().any(|byte| byte < 0x20 || byte == 0x7f) {
                    return Err(invalid("Ein Cookie-Header ist ungültig."));
                }
                let raw = RawCookie::parse(text)
                    .map_err(|_| invalid("Ein Cookie-Header ist ungültig."))?;
                validate_pair(raw.name(), raw.value())?;
                if raw
                    .max_age()
                    .is_some_and(|age| OffsetDateTime::now_utc().checked_add(age).is_none())
                {
                    return Err(invalid("Die Cookie-Laufzeit ist ungültig."));
                }
                let parsed = Cookie::try_from_raw_cookie(&raw, url)
                    .map_err(|_| invalid("Die Cookie-Domain ist nicht zulässig."))?;
                validate_policy(
                    &parsed,
                    &raw,
                    url,
                    &candidate[usize::from(raw.partitioned().unwrap_or(false))],
                )?;
                canonical_cookie(&parsed, url)
            })();
            // RFC Set-Cookie ingestion discards invalid individual cookies; explicit
            // control mutations remain strict and atomic. Capacity errors never disappear.
            let cookie = match parsed {
                Err(error) if ignore_invalid && error.code == ErrorCode::InvalidRequest => continue,
                result => result?,
            };
            let store = &mut candidate[usize::from(cookie.partitioned().unwrap_or(false))];
            insert_or_delete(store, cookie, url)?;
        }
        check_bounds(&candidate, self.limits)?;
        self.stores = candidate;
        Ok(())
    }

    pub(super) fn import(
        &mut self,
        snapshot: CookieSnapshot,
        origins: &[String],
    ) -> Result<(), TransportError> {
        if snapshot.partition_key != self.partition_key {
            return Err(invalid(
                "Die Cookie-Partition gehört zu einer anderen First-Party-Site.",
            ));
        }
        if snapshot.cookies.len() > self.limits.max_cookies {
            return Err(limit());
        }
        let origins = origins
            .iter()
            .map(|origin| {
                Url::parse(origin).map_err(|_| invalid("Der Cookie-Ursprung ist ungültig."))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let mut candidate = [CookieStore::new(), CookieStore::new()];
        let mut keys = HashSet::new();
        let mut bytes = 0usize;
        for value in snapshot.cookies {
            let size = record_size(&value);
            bytes = bytes.checked_add(size).ok_or_else(limit)?;
            if size > self.limits.max_cookie_size || bytes > self.limits.max_cookie_bytes {
                return Err(limit());
            }
            validate_pair(&value.name, &value.value)?;
            if !value.path.starts_with('/')
                || value
                    .path
                    .bytes()
                    .any(|b| b < 0x20 || b == 0x7f || b == b';')
                || value.domain.is_empty()
                || value.domain.starts_with('.')
                || value.domain.ends_with('.')
            {
                return Err(invalid("Der Cookie-Snapshot enthält ungültige Attribute."));
            }
            if !keys.insert((
                value.domain.clone(),
                value.path.clone(),
                value.name.clone(),
                value.partitioned,
            )) {
                return Err(invalid("Der Cookie-Snapshot enthält doppelte Cookies."));
            }
            let domain = if value.host_only {
                CookieDomain::HostOnly(value.domain.clone())
            } else {
                CookieDomain::Suffix(value.domain.clone())
            };
            let source = origins
                .iter()
                .find(|url| domain.matches(url) && (!value.secure || url.scheme() == "https"))
                .ok_or_else(|| {
                    invalid("Die Cookie-Domain liegt außerhalb der erlaubten Ursprünge.")
                })?;
            let mut builder = RawCookie::build((value.name.clone(), value.value.clone()))
                .path(value.path.clone())
                .secure(value.secure)
                .http_only(value.http_only)
                .partitioned(value.partitioned);
            if !value.host_only {
                builder = builder.domain(value.domain.clone());
            }
            if let Some(same_site) = value.same_site {
                builder = builder.same_site(to_same_site(same_site));
            }
            if let Some(expiry) = value.expires_at_ms {
                if expiry > 9_007_199_254_740_991 {
                    return Err(invalid("Die Cookie-Laufzeit ist ungültig."));
                }
                let expiry =
                    OffsetDateTime::from_unix_timestamp_nanos(i128::from(expiry) * 1_000_000)
                        .map_err(|_| invalid("Die Cookie-Laufzeit ist ungültig."))?;
                builder = builder.expires(expiry);
            }
            let raw = builder.build();
            let parsed = Cookie::try_from_raw_cookie(&raw, source)
                .map_err(|_| invalid("Der Cookie-Snapshot enthält eine ungültige Domain."))?
                .into_owned();
            let store = &mut candidate[usize::from(value.partitioned)];
            validate_policy(&parsed, &raw, source, store)?;
            // Reject noncanonical domains instead of silently widening/changing a snapshot boundary.
            if record(&parsed) != value {
                return Err(invalid("Der Cookie-Snapshot ist nicht kanonisch."));
            }
            insert_or_delete(store, parsed, source)?;
        }
        check_bounds(&candidate, self.limits)?;
        self.stores = candidate;
        Ok(())
    }
}

fn live_copy(store: &CookieStore) -> CookieStore {
    match CookieStore::from_cookies(
        store.iter_unexpired().cloned().map(Ok::<_, Infallible>),
        false,
    ) {
        Ok(store) => store,
        Err(error) => match error {},
    }
}

fn insert_or_delete(
    store: &mut CookieStore,
    cookie: Cookie<'static>,
    url: &Url,
) -> Result<(), TransportError> {
    if cookie.is_expired() {
        if let Some(domain) = cookie.domain.as_cow() {
            store.remove(&domain, cookie.path.as_ref(), cookie.name());
        }
        return Ok(());
    }
    store
        .insert(cookie, url)
        .map_err(|_| invalid("Das Cookie kann nicht gespeichert werden."))?;
    Ok(())
}

fn validate_pair(name: &str, value: &str) -> Result<(), TransportError> {
    if name.is_empty()
        || !name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&byte))
    {
        return Err(invalid("Der Cookie-Name ist ungültig."));
    }
    let value = if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
        &value[1..value.len() - 1]
    } else {
        value
    };
    if !value
        .bytes()
        .all(|byte| matches!(byte, 0x21 | 0x23..=0x2b | 0x2d..=0x3a | 0x3c..=0x5b | 0x5d..=0x7e))
    {
        return Err(invalid("Der Cookie-Wert ist ungültig."));
    }
    Ok(())
}

fn validate_policy(
    cookie: &Cookie<'_>,
    raw: &RawCookie<'_>,
    url: &Url,
    existing: &CookieStore,
) -> Result<(), TransportError> {
    if let CookieDomain::Suffix(domain) = &cookie.domain
        && (domain.parse::<IpAddr>().is_ok()
            || domain.starts_with('[')
            || domain.ends_with('.')
            || psl::suffix_str(domain).is_none_or(|suffix| suffix == domain))
    {
        return Err(invalid("Die Cookie-Domain ist nicht zulässig."));
    }
    let secure = cookie.secure().unwrap_or(false);
    let http_only = cookie.http_only().unwrap_or(false);
    if (secure && url.scheme() != "https")
        || (cookie.same_site() == Some(SameSite::None) && !secure)
        || (cookie.partitioned().unwrap_or(false) && !secure)
    {
        return Err(invalid("Die Cookie-Sicherheitsattribute sind ungültig."));
    }
    let name = cookie.name();
    let host_prefix = has_prefix(name, "__Host-");
    let http_prefix = has_prefix(name, "__Http-") || has_prefix(name, "__Host-Http-");
    if ((host_prefix || http_prefix || has_prefix(name, "__Secure-"))
        && (!secure || url.scheme() != "https"))
        || (host_prefix && (raw.domain().is_some() || raw.path() != Some("/")))
        || (http_prefix && !http_only)
    {
        return Err(invalid("Die Cookie-Präfixregeln wurden verletzt."));
    }
    if url.scheme() != "https"
        && existing.iter_unexpired().any(|old| {
            old.name() == cookie.name()
                && old.secure().unwrap_or(false)
                && domains_overlap(&old.domain, &cookie.domain)
        })
    {
        // Conservative secure overlay protection includes deletion and sibling paths.
        return Err(invalid(
            "Ein sicheres Cookie darf nicht über HTTP überschrieben werden.",
        ));
    }
    Ok(())
}

fn has_prefix(name: &str, prefix: &str) -> bool {
    name.get(..prefix.len())
        .is_some_and(|value| value.eq_ignore_ascii_case(prefix))
}

fn domains_overlap(left: &CookieDomain, right: &CookieDomain) -> bool {
    let (Some(left), Some(right)) = (left.as_cow(), right.as_cow()) else {
        return false;
    };
    left == right || suffix_match(&left, &right) || suffix_match(&right, &left)
}

fn suffix_match(host: &str, domain: &str) -> bool {
    host.strip_suffix(domain)
        .is_some_and(|prefix| prefix.ends_with('.'))
}

fn canonical_cookie(cookie: &Cookie<'_>, url: &Url) -> Result<Cookie<'static>, TransportError> {
    let mut builder = RawCookie::build((cookie.name().to_owned(), cookie.value().to_owned()))
        .path(cookie.path.as_ref().to_owned())
        .secure(cookie.secure().unwrap_or(false))
        .http_only(cookie.http_only().unwrap_or(false))
        .partitioned(cookie.partitioned().unwrap_or(false));
    if let CookieDomain::Suffix(domain) = &cookie.domain {
        builder = builder.domain(domain.clone());
    }
    if let Some(same_site) = cookie.same_site() {
        builder = builder.same_site(same_site);
    }
    if let CookieExpiration::AtUtc(expiry) = &cookie.expires {
        builder = builder.expires(*expiry);
    }
    Cookie::try_from_raw_cookie(&builder.build(), url)
        .map(Cookie::into_owned)
        .map_err(|_| invalid("Das Cookie ist ungültig."))
}

fn record(cookie: &Cookie<'_>) -> CookieRecord {
    CookieRecord {
        name: cookie.name().to_owned(),
        value: cookie.value().to_owned(),
        domain: String::from(&cookie.domain),
        path: cookie.path.as_ref().to_owned(),
        secure: cookie.secure().unwrap_or(false),
        http_only: cookie.http_only().unwrap_or(false),
        host_only: matches!(cookie.domain, CookieDomain::HostOnly(_)),
        partitioned: cookie.partitioned().unwrap_or(false),
        same_site: cookie.same_site().map(|value| match value {
            SameSite::Strict => CookieSameSite::Strict,
            SameSite::Lax => CookieSameSite::Lax,
            SameSite::None => CookieSameSite::None,
        }),
        expires_at_ms: match &cookie.expires {
            CookieExpiration::AtUtc(expiry) => {
                Some((expiry.unix_timestamp_nanos().max(0) / 1_000_000) as u64)
            }
            CookieExpiration::SessionEnd => None,
        },
    }
}

fn to_same_site(value: CookieSameSite) -> SameSite {
    match value {
        CookieSameSite::Strict => SameSite::Strict,
        CookieSameSite::Lax => SameSite::Lax,
        CookieSameSite::None => SameSite::None,
    }
}

fn record_size(cookie: &CookieRecord) -> usize {
    // Includes bounded attribute overhead as well as all retained variable-sized fields.
    cookie
        .name
        .len()
        .saturating_add(cookie.value.len())
        .saturating_add(cookie.domain.len())
        .saturating_add(cookie.path.len())
        .saturating_add(96)
}

fn check_bounds(stores: &[CookieStore; 2], limits: ContextLimits) -> Result<(), TransportError> {
    let mut bytes = 0usize;
    for (index, cookie) in stores
        .iter()
        .flat_map(|store| store.iter_unexpired())
        .enumerate()
    {
        let size = cookie
            .name()
            .len()
            .saturating_add(cookie.value().len())
            .saturating_add(cookie.domain.as_cow().map_or(0, |domain| domain.len()))
            .saturating_add(cookie.path.len())
            .saturating_add(96);
        bytes = bytes.checked_add(size).ok_or_else(limit)?;
        if index >= limits.max_cookies
            || size > limits.max_cookie_size
            || bytes > limits.max_cookie_bytes
        {
            return Err(limit());
        }
    }
    Ok(())
}

fn limit() -> TransportError {
    TransportError::new(
        ErrorCode::CookieLimit,
        "Das Cookie-Limit wurde überschritten.",
    )
}
