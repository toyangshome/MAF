//! IPC transport layer.
//!
//! The primary transport is **WebSocket**.
//! Two endpoints share the same listener:
//!
//! * `/ws/control`  – persistent bidirectional command/result channel
//! * `/ws/turnstile` – ephemeral per-communication session
