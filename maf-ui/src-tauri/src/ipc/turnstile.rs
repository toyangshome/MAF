//! Turnstile session manager.
//!
//! Manages the lifecycle of ephemeral turn-based communication sessions.
//! Each session is identified by a `turn_id` and has a bounded lifetime.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use super::codec::{StreamFrame, TokenUsage};

/// A single turnstile session.
pub struct TurnSession {
    pub turn_id: String,
    pub conversation_id: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub tx: broadcast::Sender<String>,
}

/// Manages all active turnstile sessions.
pub struct TurnstileManager {
    sessions: Arc<RwLock<HashMap<String, TurnSession>>>,
}

impl TurnstileManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new turn session, returning the turn_id and a receiver for its events.
    pub async fn create_session(
        &self,
        conversation_id: Option<String>,
    ) -> (String, broadcast::Receiver<String>) {
        let turn_id = format!("turn-{}", Uuid::new_v4());
        let (tx, rx) = broadcast::channel(64);

        let session = TurnSession {
            turn_id: turn_id.clone(),
            conversation_id,
            created_at: chrono::Utc::now(),
            tx,
        };

        self.sessions.write().await.insert(turn_id.clone(), session);
        (turn_id, rx)
    }

    /// End a turn session, cleaning up resources.
    pub async fn end_session(&self, turn_id: &str) {
        self.sessions.write().await.remove(turn_id);
    }

    /// Send a delta to a turn session.
    pub async fn send_delta(&self, turn_id: &str, delta: &str) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(turn_id).ok_or("session not found")?;
        let frame = StreamFrame::TurnDelta {
            turn_id: turn_id.to_string(),
            delta: delta.to_string(),
        };
        let _ = session.tx.send(serde_json::to_string(&frame).unwrap());
        Ok(())
    }

    /// Send turn-end to a turn session.
    pub async fn send_end(
        &self,
        turn_id: &str,
        finish_reason: &str,
        usage: TokenUsage,
    ) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(turn_id).ok_or("session not found")?;
        let frame = StreamFrame::TurnEnd {
            turn_id: turn_id.to_string(),
            finish_reason: finish_reason.to_string(),
            usage: Some(usage),
        };
        let _ = session.tx.send(serde_json::to_string(&frame).unwrap());
        Ok(())
    }

    /// Get count of active sessions.
    pub async fn active_count(&self) -> usize {
        self.sessions.read().await.len()
    }
}
