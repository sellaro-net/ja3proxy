//! Owner-scoped cancellation/status, bounded recent-ID retention, and drop cancellation.
use crate::{
    error::{ErrorCode, TransportError},
    models::{Diagnostics, Phase},
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;

type Key = (String, String, String);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "lowercase")]
pub enum RequestState {
    Queued,
    Active,
    Complete,
    Failed,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema-export", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase")]
pub struct RequestStatus {
    pub state: RequestState,
    pub diagnostics: Diagnostics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<TransportError>,
}

struct Progress {
    diagnostics: Diagnostics,
    finished: Option<Instant>,
    error: Option<TransportError>,
}
pub struct RequestRecord {
    pub cancel: CancellationToken,
    pub started: Instant,
    queued_at: Instant,
    progress: Mutex<Progress>,
}

impl RequestRecord {
    pub fn update(&self, update: impl FnOnce(&mut Diagnostics)) {
        let mut progress = self.progress.lock();
        if progress.finished.is_none() {
            update(&mut progress.diagnostics);
        }
    }
    pub fn diagnostics(&self) -> Diagnostics {
        let progress = self.progress.lock();
        let mut diagnostics = progress.diagnostics.clone();
        if progress.finished.is_none() {
            diagnostics.total_ms = self.started.elapsed().as_millis() as u64;
            if diagnostics.phase == Phase::Queued {
                diagnostics.queue_ms = self.queued_at.elapsed().as_millis() as u64;
            }
        }
        diagnostics
    }
    pub fn finish(&self, error: Option<TransportError>) -> RequestStatus {
        let mut progress = self.progress.lock();
        if progress.finished.is_none() {
            progress.diagnostics.total_ms = self.started.elapsed().as_millis() as u64;
            if progress.diagnostics.phase == Phase::Queued {
                progress.diagnostics.queue_ms = self.queued_at.elapsed().as_millis() as u64;
            }
            if error.is_none() {
                progress.diagnostics.phase = Phase::Complete;
            }
            progress.error =
                error.map(|error| error.with_diagnostics(progress.diagnostics.clone()));
            progress.finished = Some(Instant::now());
        }
        Self::status_locked(&progress)
    }
    fn status_locked(progress: &Progress) -> RequestStatus {
        RequestStatus {
            state: if progress.error.is_some() {
                RequestState::Failed
            } else if progress.finished.is_some() {
                RequestState::Complete
            } else if progress.diagnostics.phase == Phase::Queued {
                RequestState::Queued
            } else {
                RequestState::Active
            },
            diagnostics: progress.diagnostics.clone(),
            error: progress.error.clone(),
        }
    }
    pub fn status(&self) -> RequestStatus {
        let progress = self.progress.lock();
        let mut status = Self::status_locked(&progress);
        if progress.finished.is_none() {
            status.diagnostics.total_ms = self.started.elapsed().as_millis() as u64;
            if status.diagnostics.phase == Phase::Queued {
                status.diagnostics.queue_ms = self.queued_at.elapsed().as_millis() as u64;
            }
        }
        status
    }
}

pub struct Registry {
    records: Mutex<HashMap<Key, Arc<RequestRecord>>>,
    capacity: usize,
    ttl: Duration,
}
impl Registry {
    pub fn new(capacity: usize, ttl_ms: u64) -> Arc<Self> {
        Arc::new(Self {
            records: Mutex::new(HashMap::new()),
            capacity,
            ttl: Duration::from_millis(ttl_ms),
        })
    }
    fn retain_recent(&self, records: &mut HashMap<Key, Arc<RequestRecord>>) {
        records.retain(|_, record| {
            record
                .progress
                .lock()
                .finished
                .is_none_or(|at| at.elapsed() < self.ttl)
        });
    }
    pub fn cleanup(&self) {
        self.retain_recent(&mut self.records.lock());
    }
    pub fn register(
        &self,
        principal: &str,
        partition: &str,
        diagnostics: Diagnostics,
        started: Instant,
    ) -> Result<Arc<RequestRecord>, TransportError> {
        let key = (
            principal.into(),
            partition.into(),
            diagnostics.request_id.clone(),
        );
        let mut records = self.records.lock();
        self.retain_recent(&mut records);
        if records.contains_key(&key) {
            return Err(TransportError::from_code(ErrorCode::DuplicateRequest));
        }
        if records.len() >= self.capacity {
            return Err(TransportError::from_code(ErrorCode::Busy));
        }
        let record = Arc::new(RequestRecord {
            cancel: CancellationToken::new(),
            started,
            queued_at: Instant::now(),
            progress: Mutex::new(Progress {
                diagnostics,
                finished: None,
                error: None,
            }),
        });
        records.insert(key, record.clone());
        Ok(record)
    }
    pub fn get(
        &self,
        principal: &str,
        partition: &str,
        id: &str,
    ) -> Result<Arc<RequestRecord>, TransportError> {
        let mut records = self.records.lock();
        self.retain_recent(&mut records);
        records
            .get(&(principal.into(), partition.into(), id.into()))
            .cloned()
            .ok_or_else(|| TransportError::from_code(ErrorCode::ContextNotFound))
    }
    pub fn shutdown(&self) {
        for record in self.records.lock().values() {
            record.cancel.cancel();
        }
    }
}

/// Signals cancellation from the HTTP response body, including before its first poll.
/// Only the execution owner may finalize diagnostics after request work has stopped.
pub struct ResponseGuard {
    record: Arc<RequestRecord>,
}
impl ResponseGuard {
    pub fn new(record: Arc<RequestRecord>) -> Self {
        Self { record }
    }
}
impl Drop for ResponseGuard {
    fn drop(&mut self) {
        self.record.cancel.cancel();
    }
}

/// Construct before spawning and move into the worker so even an unpolled task
/// finalizes on abort. Drop only after its execution future has stopped.
pub struct ExecutionGuard(pub Arc<RequestRecord>);
impl Drop for ExecutionGuard {
    fn drop(&mut self) {
        self.0.cancel.cancel();
        self.0
            .finish(Some(TransportError::from_code(ErrorCode::Cancelled)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Delivery;

    fn diagnostics() -> Diagnostics {
        Diagnostics {
            request_id: "same-id".into(),
            attempt: 1,
            trace_id: None,
            phase: Phase::Queued,
            delivery: Delivery::NotStarted,
            queue_ms: 0,
            headers_ms: None,
            body_ms: None,
            total_ms: 0,
            request_bytes: 0,
            response_bytes: 0,
            tls_profile: "chrome_120".into(),
            client_reused: None,
            context_id: None,
            cookie_revision: None,
        }
    }

    #[test]
    fn retained_ids_reject_replay_without_cross_partition_authority() {
        let registry = Registry::new(3, 60_000);
        let first = registry
            .register("principal", "a", diagnostics(), Instant::now())
            .unwrap();
        first.finish(None);
        assert!(
            matches!(registry.register("principal", "a", diagnostics(), Instant::now()),
            Err(error) if error.code == ErrorCode::DuplicateRequest)
        );
        let other = registry
            .register("principal", "b", diagnostics(), Instant::now())
            .unwrap();
        registry
            .get("principal", "a", "same-id")
            .unwrap()
            .cancel
            .cancel();
        assert!(!other.cancel.is_cancelled());
        assert!(matches!(registry.get("another-principal", "a", "same-id"),
            Err(error) if error.code == ErrorCode::ContextNotFound));
    }

    #[test]
    fn recent_id_limit_never_evicts_active_work() {
        let registry = Registry::new(1, 60_000);
        let record = registry
            .register("principal", "a", diagnostics(), Instant::now())
            .unwrap();
        assert!(
            matches!(registry.register("principal", "b", diagnostics(), Instant::now()),
            Err(error) if error.code == ErrorCode::Busy)
        );
        assert!(Arc::ptr_eq(
            &record,
            &registry.get("principal", "a", "same-id").unwrap()
        ));
    }

    #[tokio::test]
    async fn response_drop_preserves_delivery_updates_until_execution_stops() {
        let registry = Registry::new(1, 60_000);
        let record = registry
            .register("principal", "a", diagnostics(), Instant::now())
            .unwrap();
        let response = ResponseGuard::new(record.clone());
        let execution = ExecutionGuard(record.clone());
        let worker_record = record.clone();
        let (prepared, preparing) = tokio::sync::oneshot::channel();
        let (resume, resumed) = tokio::sync::oneshot::channel();
        let (dispatched, dispatching) = tokio::sync::oneshot::channel();
        let (stop, stopped) = tokio::sync::oneshot::channel();
        let worker = tokio::spawn(async move {
            let _guard = execution;
            worker_record.update(|diagnostics| diagnostics.phase = Phase::Preparing);
            prepared.send(()).unwrap();
            resumed.await.unwrap();
            // A poll already running on another worker can still dispatch before
            // its surrounding cancellation select regains control.
            worker_record.update(|diagnostics| diagnostics.delivery = Delivery::PossiblySent);
            dispatched.send(()).unwrap();
            stopped.await.unwrap();
        });

        preparing.await.unwrap();
        drop(response);
        assert!(record.cancel.is_cancelled());
        let status = record.status();
        assert_eq!(status.state, RequestState::Active);
        assert_eq!(status.diagnostics.delivery, Delivery::NotStarted);
        assert!(status.error.is_none());

        resume.send(()).unwrap();
        dispatching.await.unwrap();
        let status = record.status();
        assert_eq!(status.state, RequestState::Active);
        assert_eq!(status.diagnostics.delivery, Delivery::PossiblySent);
        assert!(status.error.is_none());

        stop.send(()).unwrap();
        worker.await.unwrap();
        let status = record.status();
        assert_eq!(status.state, RequestState::Failed);
        assert_eq!(status.diagnostics.delivery, Delivery::PossiblySent);
        let error = status.error.unwrap();
        assert_eq!(error.code, ErrorCode::Cancelled);
        assert_eq!(error.diagnostics.unwrap().delivery, Delivery::PossiblySent);
    }

    #[tokio::test]
    async fn abort_before_first_poll_finalizes_owned_execution() {
        let registry = Registry::new(1, 60_000);
        let record = registry
            .register("principal", "a", diagnostics(), Instant::now())
            .unwrap();
        let execution = ExecutionGuard(record.clone());
        let worker = tokio::spawn(async move {
            let _guard = execution;
            panic!("aborted worker must never be polled");
        });
        // The current-thread runtime cannot poll the spawned work before this abort.
        worker.abort();
        assert!(worker.await.unwrap_err().is_cancelled());
        let status = record.status();
        assert_eq!(status.state, RequestState::Failed);
        assert_eq!(status.diagnostics.delivery, Delivery::NotStarted);
        assert_eq!(status.error.unwrap().code, ErrorCode::Cancelled);
    }
}
