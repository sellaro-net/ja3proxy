//! Fail-closed process configuration; the dedicated service credential is never Debug.

use std::{env, io::Read};

#[derive(Clone)]
pub struct Config {
    pub port: u16,
    pub log_level: String,
    pub token: String,
    pub max_concurrent: usize,
    pub max_concurrent_per_partition: usize,
    pub max_queued: usize,
    pub max_queued_per_partition: usize,
    pub max_envelopes: usize,
    pub max_request_body_size: usize,
    pub max_response_body_size: usize,
    pub max_timeout_ms: u64,
    pub envelope_timeout_ms: u64,
    pub max_control_body_size: usize,
    pub registry_capacity: usize,
    pub registry_ttl_ms: u64,
    pub allow_private_ips: bool,
}

fn positive(name: &str, default: usize, maximum: usize) -> anyhow::Result<usize> {
    match env::var(name) {
        Err(env::VarError::NotPresent) => Ok(default),
        Ok(value) => value
            .parse::<usize>()
            .ok()
            .filter(|n| *n > 0 && *n <= maximum)
            .ok_or_else(|| anyhow::anyhow!("Ungültiger Grenzwert: {name}")),
        Err(_) => anyhow::bail!("Ungültiger Grenzwert: {name}"),
    }
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let token = match (
            env::var("JA3_PROXY_TOKEN"),
            env::var("JA3_PROXY_TOKEN_FILE"),
        ) {
            (Ok(token), Err(env::VarError::NotPresent)) => token,
            (Err(env::VarError::NotPresent), Ok(path)) => {
                let mut bytes = Vec::new();
                std::fs::File::open(path)
                    .and_then(|file| file.take(4099).read_to_end(&mut bytes))
                    .map_err(|_| {
                        anyhow::anyhow!("Das separate Dienstgeheimnis konnte nicht gelesen werden.")
                    })?;
                if bytes.len() > 4098 {
                    anyhow::bail!("Das separate Dienstgeheimnis ist zu groß.");
                }
                if bytes.ends_with(b"\r\n") {
                    bytes.truncate(bytes.len() - 2);
                } else if bytes.ends_with(b"\n") {
                    bytes.pop();
                }
                String::from_utf8(bytes)
                    .map_err(|_| anyhow::anyhow!("Das separate Dienstgeheimnis ist ungültig."))?
            }
            _ => anyhow::bail!(
                "Genau eine der Variablen JA3_PROXY_TOKEN und JA3_PROXY_TOKEN_FILE muss gesetzt sein."
            ),
        };
        if token.len() < 32 || token.len() > 4096 || !token.bytes().all(|b| b.is_ascii_graphic()) {
            anyhow::bail!("JA3_PROXY_TOKEN muss 32 bis 4096 druckbare ASCII-Zeichen enthalten.");
        }
        if env::var("NEXTAUTH_SECRET").is_ok_and(|secret| secret == token) {
            anyhow::bail!("JA3_PROXY_TOKEN darf NEXTAUTH_SECRET nicht wiederverwenden.");
        }
        let config = Self {
            port: positive("PORT", 8080, u16::MAX as usize)? as u16,
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()),
            token,
            max_concurrent: positive("MAX_CONCURRENT", 100, 10_000)?,
            max_concurrent_per_partition: positive("MAX_CONCURRENT_PER_PARTITION", 4, 10_000)?,
            max_queued: positive("MAX_QUEUED", 256, 100_000)?,
            max_queued_per_partition: positive("MAX_QUEUED_PER_PARTITION", 16, 100_000)?,
            max_envelopes: positive("MAX_ENVELOPES", 128, 10_000)?,
            max_request_body_size: positive(
                "MAX_REQUEST_BODY_SIZE",
                10 * 1024 * 1024,
                1024 * 1024 * 1024,
            )?,
            max_response_body_size: positive(
                "MAX_RESPONSE_BODY_SIZE",
                50 * 1024 * 1024,
                1024 * 1024 * 1024,
            )?,
            max_timeout_ms: positive("MAX_TIMEOUT_MS", 120_000, 300_000)? as u64,
            envelope_timeout_ms: positive("ENVELOPE_TIMEOUT_MS", 5_000, 30_000)? as u64,
            max_control_body_size: positive("MAX_CONTROL_BODY_SIZE", 1024 * 1024, 4 * 1024 * 1024)?,
            registry_capacity: positive("REGISTRY_CAPACITY", 4096, 100_000)?,
            registry_ttl_ms: positive("REGISTRY_TTL_MS", 60_000, 600_000)? as u64,
            allow_private_ips: match env::var("ALLOW_PRIVATE_IPS").as_deref() {
                Ok("true" | "1") => true,
                Ok("false" | "0") | Err(env::VarError::NotPresent) => false,
                _ => anyhow::bail!("Ungültiger Grenzwert: ALLOW_PRIVATE_IPS"),
            },
        };
        if config.max_concurrent_per_partition > config.max_concurrent
            || config.max_queued_per_partition > config.max_queued
            || config.registry_capacity < config.max_concurrent + config.max_queued
        {
            anyhow::bail!(
                "Partitions- und Registry-Grenzen sind mit den Gesamtgrenzen unvereinbar."
            );
        }
        Ok(config)
    }

    #[cfg(test)]
    pub fn for_test() -> Self {
        Self {
            port: 0,
            log_level: "off".into(),
            token: "test-only-dedicated-service-token-32".into(),
            max_concurrent: 4,
            max_concurrent_per_partition: 1,
            max_queued: 8,
            max_queued_per_partition: 2,
            max_envelopes: 8,
            max_request_body_size: 1024,
            max_response_body_size: 1024,
            max_timeout_ms: 5_000,
            envelope_timeout_ms: 1_000,
            max_control_body_size: 1024 * 1024,
            registry_capacity: 32,
            registry_ttl_ms: 1_000,
            allow_private_ips: true,
        }
    }
}
