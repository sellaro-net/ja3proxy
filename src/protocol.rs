//! Bounded raw binary framing without body-base64 copies.
use crate::{
    error::{ErrorCode, TransportError},
    models::RequestMetadata,
    registry::RequestRecord,
};
use axum::body::{Body, BodyDataStream};
use bytes::{Buf, Bytes, BytesMut};
use futures_util::StreamExt;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::mpsc;

pub const CONTENT_TYPE: &str = "application/vnd.ja3proxy";
pub const MAX_METADATA_BYTES: usize = 65_536;
pub const MAX_DATA_BYTES: usize = 65_536;
pub const MAX_UPLOAD_FRAMES: usize = 65_536;

pub struct FrameReader {
    stream: BodyDataStream,
    pending: Bytes,
}
impl FrameReader {
    pub fn new(body: Body) -> Self {
        Self {
            stream: body.into_data_stream(),
            pending: Bytes::new(),
        }
    }
    async fn next_bytes(&mut self) -> Result<bool, TransportError> {
        while self.pending.is_empty() {
            match self.stream.next().await {
                Some(Ok(bytes)) => self.pending = bytes,
                Some(Err(_)) => return Err(TransportError::from_code(ErrorCode::ProtocolError)),
                None => return Ok(false),
            }
        }
        Ok(true)
    }
    async fn exact(&mut self, length: usize) -> Result<Bytes, TransportError> {
        if self.pending.len() >= length {
            return Ok(self.pending.split_to(length));
        }
        let mut bytes = BytesMut::with_capacity(length);
        while bytes.len() < length {
            if !self.next_bytes().await? {
                return Err(TransportError::from_code(ErrorCode::ProtocolError));
            }
            let take = (length - bytes.len()).min(self.pending.len());
            bytes.extend_from_slice(&self.pending[..take]);
            self.pending.advance(take);
        }
        Ok(bytes.freeze())
    }
    async fn frame_header(&mut self) -> Result<(u8, usize), TransportError> {
        let header = self.exact(5).await?;
        let length = u32::from_be_bytes(header[1..5].try_into().unwrap()) as usize;
        Ok((header[0], length))
    }
    pub async fn metadata(&mut self) -> Result<RequestMetadata, TransportError> {
        let (kind, length) = self.frame_header().await?;
        if kind != 1 || length == 0 || length > MAX_METADATA_BYTES {
            return Err(TransportError::from_code(ErrorCode::ProtocolError));
        }
        serde_json::from_slice(&self.exact(length).await?)
            .map_err(|_| TransportError::from_code(ErrorCode::InvalidRequest))
    }
    pub async fn upload(
        mut self,
        sender: mpsc::Sender<Result<Bytes, TransportError>>,
        limit: usize,
        has_body: bool,
        body_length: Option<u64>,
        record: Arc<RequestRecord>,
    ) -> Result<(), TransportError> {
        let mut count = 0usize;
        for _ in 0..MAX_UPLOAD_FRAMES {
            let (kind, length) = self.frame_header().await?;
            match kind {
                2 => {
                    if !has_body || length > MAX_DATA_BYTES {
                        return Err(TransportError::from_code(ErrorCode::ProtocolError));
                    }
                    count = count
                        .checked_add(length)
                        .filter(|count| *count <= limit)
                        .ok_or_else(|| TransportError::from_code(ErrorCode::BodyTooLarge))?;
                    if body_length.is_some_and(|length| count as u64 > length) {
                        return Err(TransportError::from_code(ErrorCode::ProtocolError));
                    }
                    let payload = self.exact(length).await?;
                    record.update(|diagnostics| diagnostics.request_bytes = count as u64);
                    // If an upstream responds early, keep validating the bounded envelope.
                    // Never let an early response turn trailing frames into a successful upload.
                    if !payload.is_empty() {
                        let _ = sender.send(Ok(payload)).await;
                    }
                }
                3 if length == 0 => {
                    if body_length.is_some_and(|length| count as u64 != length)
                        || self.next_bytes().await?
                    {
                        return Err(TransportError::from_code(ErrorCode::ProtocolError));
                    }
                    return Ok(());
                }
                _ => return Err(TransportError::from_code(ErrorCode::ProtocolError)),
            }
        }
        Err(TransportError::from_code(ErrorCode::ProtocolError))
    }
}

pub fn frame(kind: u8, payload: &[u8]) -> Bytes {
    let mut output = BytesMut::with_capacity(5 + payload.len());
    output.extend_from_slice(&[kind]);
    output.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    output.extend_from_slice(payload);
    output.freeze()
}
pub fn json_frame(kind: u8, payload: &impl Serialize) -> Result<Bytes, TransportError> {
    let bytes = serde_json::to_vec(payload)
        .map_err(|_| TransportError::from_code(ErrorCode::ProtocolError))?;
    if bytes.len() > MAX_METADATA_BYTES {
        return Err(TransportError::from_code(ErrorCode::ProtocolError));
    }
    Ok(frame(kind, &bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Delivery, Diagnostics, Phase};
    use crate::registry::Registry;

    fn record() -> Arc<RequestRecord> {
        Registry::new(2, 1_000)
            .register(
                "s",
                "p",
                Diagnostics {
                    request_id: "r".into(),
                    attempt: 0,
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
                },
                std::time::Instant::now(),
            )
            .unwrap()
    }

    #[tokio::test]
    async fn rejects_truncated_payload_and_trailing_frames() {
        for bytes in [vec![2, 0, 0, 0, 2, 1], vec![3, 0, 0, 0, 0, 2, 0, 0, 0, 0]] {
            let (sender, _receiver) = mpsc::channel(1);
            let error = FrameReader::new(Body::from(bytes))
                .upload(sender, 16, true, None, record())
                .await
                .unwrap_err();
            assert_eq!(error.code, ErrorCode::ProtocolError);
        }
    }

    #[tokio::test]
    async fn raw_limit_is_enforced_before_reading_oversized_payload() {
        let (sender, _receiver) = mpsc::channel(1);
        let error = FrameReader::new(Body::from(vec![2, 0, 0, 0, 17]))
            .upload(sender, 16, true, None, record())
            .await
            .unwrap_err();
        assert_eq!(error.code, ErrorCode::BodyTooLarge);
    }

    #[tokio::test]
    async fn accepts_binary_data_split_at_every_wire_boundary() {
        let mut bytes = frame(2, &[0, 255, 128]).to_vec();
        bytes.extend_from_slice(&frame(3, &[]));
        let body = Body::from_stream(futures_util::stream::iter(
            bytes
                .into_iter()
                .map(|byte| Ok::<_, std::convert::Infallible>(Bytes::from(vec![byte]))),
        ));
        let (sender, mut receiver) = mpsc::channel(1);
        FrameReader::new(body)
            .upload(sender, 3, true, Some(3), record())
            .await
            .unwrap();
        assert_eq!(
            receiver.recv().await.unwrap().unwrap().as_ref(),
            &[0, 255, 128]
        );
        assert!(receiver.recv().await.is_none());
    }

    #[tokio::test]
    async fn explicit_body_length_and_absence_are_enforced() {
        for (has_body, length, bytes) in [
            (false, None, frame(2, &[1])),
            (true, Some(1), frame(3, &[])),
            (true, Some(0), frame(2, &[1])),
        ] {
            let (sender, _receiver) = mpsc::channel(1);
            let error = FrameReader::new(Body::from(bytes))
                .upload(sender, 16, has_body, length, record())
                .await
                .unwrap_err();
            assert_eq!(error.code, ErrorCode::ProtocolError);
        }
    }
}
