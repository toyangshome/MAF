//! IPC module for MAF-UI Tauri backend.
//!
//! Provides the WebSocket-based transport layer for real-time
//! bidirectional communication between the frontend and backend.

pub mod codec;
pub mod proxy;
pub mod turnstile;
pub mod ws_handler;
