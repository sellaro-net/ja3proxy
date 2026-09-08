//! Bounded partition queues, round-robin admission and RAII release.
use crate::{
    config::Config,
    error::{ErrorCode, TransportError},
};
use parking_lot::Mutex;
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};
use tokio::sync::Notify;

#[derive(Default)]
struct Partition {
    active: usize,
    waiting: VecDeque<u64>,
}
#[derive(Default)]
struct State {
    active: usize,
    queued: usize,
    next: u64,
    partitions: HashMap<String, Partition>,
    order: VecDeque<String>,
}

pub struct Admission {
    state: Mutex<State>,
    changed: Notify,
    active_limit: usize,
    partition_active_limit: usize,
    queue_limit: usize,
    partition_queue_limit: usize,
}

impl Admission {
    pub fn new(config: &Config) -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(State::default()),
            changed: Notify::new(),
            active_limit: config.max_concurrent,
            partition_active_limit: config.max_concurrent_per_partition,
            queue_limit: config.max_queued,
            partition_queue_limit: config.max_queued_per_partition,
        })
    }

    pub fn enter(self: &Arc<Self>, key: String) -> Result<Ticket, TransportError> {
        let mut state = self.state.lock();
        let partition = state.partitions.get(&key);
        let can_start = state.active < self.active_limit
            && partition
                .is_none_or(|p| p.active < self.partition_active_limit && p.waiting.is_empty())
            && state
                .order
                .iter()
                .all(|key| state.partitions[key].active >= self.partition_active_limit);
        if can_start {
            state.active += 1;
            state.partitions.entry(key.clone()).or_default().active += 1;
            return Ok(Ticket {
                admission: self.clone(),
                key,
                id: None,
                active: true,
            });
        }
        if state.queued >= self.queue_limit
            || partition.is_some_and(|p| p.waiting.len() >= self.partition_queue_limit)
        {
            return Err(TransportError::from_code(ErrorCode::Busy));
        }
        let id = state.next;
        state.next = state.next.wrapping_add(1);
        let partition = state.partitions.entry(key.clone()).or_default();
        let new_queue = partition.waiting.is_empty();
        partition.waiting.push_back(id);
        if new_queue {
            state.order.push_back(key.clone());
        }
        state.queued += 1;
        Ok(Ticket {
            admission: self.clone(),
            key,
            id: Some(id),
            active: false,
        })
    }

    fn try_start(&self, key: &str, id: u64) -> bool {
        let mut state = self.state.lock();
        if state.active >= self.active_limit {
            return false;
        }
        let selected = state.order.iter().position(|candidate| {
            state
                .partitions
                .get(candidate)
                .is_some_and(|p| p.active < self.partition_active_limit)
        });
        let Some(index) = selected else { return false };
        if state.order[index] != key || state.partitions[key].waiting.front().copied() != Some(id) {
            return false;
        }
        state.order.remove(index);
        let partition = state.partitions.get_mut(key).unwrap();
        partition.waiting.pop_front();
        partition.active += 1;
        if !partition.waiting.is_empty() {
            state.order.push_back(key.to_owned());
        }
        state.active += 1;
        state.queued -= 1;
        drop(state);
        self.changed.notify_waiters();
        true
    }
}

pub struct Ticket {
    admission: Arc<Admission>,
    key: String,
    id: Option<u64>,
    active: bool,
}
impl Ticket {
    pub async fn wait(mut self) -> Self {
        while !self.active {
            let admission = self.admission.clone();
            let notified = admission.changed.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            if admission.try_start(&self.key, self.id.unwrap()) {
                self.id = None;
                self.active = true;
                break;
            }
            notified.await;
        }
        self
    }
}
impl Drop for Ticket {
    fn drop(&mut self) {
        let mut state = self.admission.state.lock();
        let partition = state.partitions.get_mut(&self.key).unwrap();
        if self.active {
            partition.active -= 1;
        } else if let Some(id) = self.id {
            partition.waiting.retain(|candidate| *candidate != id);
        }
        let remove_queue = partition.waiting.is_empty();
        let remove_partition = remove_queue && partition.active == 0;
        if remove_queue {
            state.order.retain(|key| key != &self.key);
        }
        if remove_partition {
            state.partitions.remove(&self.key);
        }
        if self.active {
            state.active -= 1;
        } else {
            state.queued -= 1;
        }
        drop(state);
        self.admission.changed.notify_waiters();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn partition_backlog_cannot_block_another_partition() {
        let mut config = Config::for_test();
        config.max_concurrent = 2;
        config.max_queued = 1;
        config.max_queued_per_partition = 1;
        let admission = Admission::new(&config);
        let active = admission.enter("a".into()).unwrap().wait().await;
        let queued = admission.enter("a".into()).unwrap();
        let other = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            admission.enter("b".into()).unwrap().wait(),
        )
        .await
        .unwrap();
        drop(other);
        drop(active);
        let _released = tokio::time::timeout(std::time::Duration::from_secs(1), queued.wait())
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn cancelled_queue_entries_release_capacity() {
        let mut config = Config::for_test();
        config.max_concurrent = 1;
        config.max_queued = 1;
        config.max_queued_per_partition = 1;
        let admission = Admission::new(&config);
        let active = admission.enter("a".into()).unwrap().wait().await;
        let queued = admission.enter("a".into()).unwrap();
        assert!(matches!(admission.enter("b".into()), Err(error) if error.code == ErrorCode::Busy));
        drop(queued);
        let replacement = admission.enter("b".into()).unwrap();
        drop(active);
        let _released = tokio::time::timeout(std::time::Duration::from_secs(1), replacement.wait())
            .await
            .unwrap();
    }
}
