//! WebSocket frame codec definitions for the IPC layer.
//!
//! Defines the JSON wire protocol for both control and turnstile channels.

use serde::{Deserialize, Serialize};

// ── Control channel frames ───────────────────────────────────────────

/// Client → Server on the control channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ControlFrame {
    /// Start a new agent task.
    Start {
        task_id: String,
        task_description: String,
        #[serde(default)]
        config: Option<serde_json::Value>,
    },
    /// Pause a running task.
    Pause { task_id: String },
    /// Resume a paused task.
    Resume { task_id: String },
    /// Cancel a running task.
    Cancel { task_id: String },
    /// Keepalive ping.
    Ping,
}

/// Server → Client on the control channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamFrame {
    /// Task execution started.
    TaskStarted {
        task_id: String,
        task_description: String,
    },
    /// Task progress update.
    TaskProgress {
        task_id: String,
        phase: String,
        detail: String,
    },
    /// Task completed successfully.
    TaskCompleted {
        task_id: String,
        result: String,
        #[serde(default)]
        usage: Option<TokenUsage>,
    },
    /// Task failed.
    TaskFailed {
        task_id: String,
        error: String,
        #[serde(default)]
        recoverable: bool,
    },
    /// Turn started (turnstile channel).
    TurnStart { turn_id: String },
    /// Turn streaming delta (turnstile channel).
    TurnDelta { turn_id: String, delta: String },
    /// Turn completed (turnstile channel).
    TurnEnd {
        turn_id: String,
        finish_reason: String,
        #[serde(default)]
        usage: Option<TokenUsage>,
    },
    /// Error frame.
    Error {
        #[serde(default)]
        task_id: Option<String>,
        code: String,
        message: String,
        #[serde(default)]
        recoverable: bool,
    },
    /// Keepalive pong.
    Pong,
}

// ── Turnstile channel frames ─────────────────────────────────────────

/// Client → Server on the turnstile channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TurnFrame {
    /// Ask the agent a question (start a turn).
    Ask {
        turn_id: String,
        #[serde(default)]
        conversation_id: Option<String>,
        payload: TurnPayload,
        #[serde(default)]
        context: Option<serde_json::Value>,
    },
    /// Keepalive ping.
    Ping,
}

/// The prompt payload for a turn.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnPayload {
    pub prompt: String,
    #[serde(default)]
    pub system: Option<String>,
    #[serde(default)]
    pub tools: Option<Vec<String>>,
}

// ── Shared types ─────────────────────────────────────────────────────

/// Token usage statistics.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub total_tokens: u64,
}
