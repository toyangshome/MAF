//! WebSocket upgrade handler for the Axum-based IPC server.
//!
//! Endpoints:
//! * `/ws/control`  – persistent bidirectional command/result channel
//! * `/ws/turnstile` – ephemeral per-communication session
//!
//! These handlers are mounted on the Axum router and forward WS traffic
//! to the Tauri AppHandle via broadcast channels.

use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
    routing::get,
    Router,
};
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::AppState;

/// Shared broadcast sender for control events.
/// In a full deployment, this would be wired to the Tauri event system.
pub type ControlTx = broadcast::Sender<String>;

/// Build a sub-router that serves both WS endpoints.
pub fn ws_router() -> Router<Arc<WsState>> {
    Router::new()
        .route("/ws/control", get(control_upgrade))
        .route("/ws/turnstile", get(turnstile_upgrade))
}

/// Shared state for the WS handler layer.
pub struct WsState {
    pub control_tx: broadcast::Sender<String>,
    pub app_state: Arc<AppState>,
}

// ── Control channel ──────────────────────────────────────────────────

async fn control_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<WsState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_control(socket, state))
}

/// Persistent bidirectional control channel.
///
/// Protocol: JSON frames on both directions.
/// - Client → Server: ControlFrame (Start, Pause, Resume, Cancel, Ping)
/// - Server → Client: StreamFrame (TaskStarted, TaskProgress, TaskCompleted, TaskFailed, Error, Ping)
async fn handle_control(socket: WebSocket, state: Arc<WsState>) {
    use axum::extract::ws::Message;
    use futures_util::{SinkExt, StreamExt};

    let (mut sink, mut stream) = socket.split();
    let mut rx = state.control_tx.subscribe();

    // Forward broadcast events to WS client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sink.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Receive commands from client
    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(text) => {
                eprintln!("[control] received: {}", &text[..text.len().min(200)]);
                // Parse and dispatch control frames
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                    let frame_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    match frame_type {
                        "start" => {
                            let task_id = val
                                .get("task_id")
                                .and_then(|t| t.as_str())
                                .unwrap_or("unknown")
                                .to_string();
                            eprintln!("[control] start task: {}", task_id);
                            // Emit a task_started event through the broadcast channel
                            let _ = state.control_tx.send(
                                serde_json::json!({
                                    "type": "task_started",
                                    "task_id": task_id,
                                    "task_description": val.get("task_description")
                                })
                                .to_string(),
                            );
                        }
                        "ping" => {
                            let _ = state.control_tx.send(
                                serde_json::json!({"type": "pong"}).to_string(),
                            );
                        }
                        other => {
                            eprintln!("[control] unknown frame type: {}", other);
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    send_task.abort();
}

// ── Turnstile channel ────────────────────────────────────────────────

async fn turnstile_upgrade(
    ws: WebSocketUpgrade,
    State(state): State<Arc<WsState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_turnstile(socket, state))
}

/// Ephemeral per-communication turnstile channel.
///
/// Protocol: JSON frames.
/// - Client → Server: TurnFrame (ask, ping)
/// - Server → Client: StreamFrame (turn-start, turn-delta, turn-end, error, pong)
async fn handle_turnstile(socket: WebSocket, _state: Arc<WsState>) {
    use axum::extract::ws::Message;
    use futures_util::{SinkExt, StreamExt};

    let (mut sink, mut stream) = socket.split();

    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(text) => {
                eprintln!("[turnstile] received: {}", &text[..text.len().min(200)]);
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                    let frame_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    match frame_type {
                        "ask" => {
                            let turn_id = val
                                .get("turn_id")
                                .and_then(|t| t.as_str())
                                .unwrap_or("unknown")
                                .to_string();

                            // Send turn-start
                            let _ = sink
                                .send(Message::Text(
                                    serde_json::json!({
                                        "type": "turn-start",
                                        "turn_id": turn_id
                                    })
                                    .to_string(),
                                ))
                                .await;

                            // Simulate streaming response (placeholder)
                            let prompt = val
                                .get("payload")
                                .and_then(|p| p.get("prompt"))
                                .and_then(|p| p.as_str())
                                .unwrap_or("");

                            let response = format!("Echo: {}", prompt);
                            for word in response.split_whitespace() {
                                let _ = sink
                                    .send(Message::Text(
                                        serde_json::json!({
                                            "type": "turn-delta",
                                            "turn_id": turn_id,
                                            "delta": format!("{} ", word)
                                        })
                                        .to_string(),
                                    ))
                                    .await;
                                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                            }

                            // Send turn-end
                            let _ = sink
                                .send(Message::Text(
                                    serde_json::json!({
                                        "type": "turn-end",
                                        "turn_id": turn_id,
                                        "finish_reason": "stop",
                                        "usage": {
                                            "prompt_tokens": prompt.len() / 4,
                                            "completion_tokens": response.len() / 4,
                                            "total_tokens": (prompt.len() + response.len()) / 4
                                        }
                                    })
                                    .to_string(),
                                ))
                                .await;
                        }
                        "ping" => {
                            let _ = sink
                                .send(Message::Text(
                                    serde_json::json!({"type": "pong"}).to_string(),
                                ))
                                .await;
                        }
                        other => {
                            eprintln!("[turnstile] unknown frame type: {}", other);
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}
