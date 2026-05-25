use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Emitter;

mod commands;
pub mod ipc;

// ── 事件类型 ──────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct TaskStartedEvent {
    pub task_id: String,
    pub task_description: String,
}

#[derive(Clone, Serialize)]
pub struct TaskProgressEvent {
    pub task_id: String,
    pub phase: String,
    pub detail: String,
}

#[derive(Clone, Serialize)]
pub struct TaskCompletedEvent {
    pub task_id: String,
    pub result: String,
}

#[derive(Clone, Serialize)]
pub struct TaskFailedEvent {
    pub task_id: String,
    pub error: String,
}

// ── 事件发射辅助函数 ──────────────────────────────────────

pub fn emit_task_started(app: &tauri::AppHandle, event: TaskStartedEvent) {
    app.emit("task_started", event)
        .unwrap_or_else(|e| eprintln!("Failed to emit task_started: {}", e));
}

pub fn emit_task_progress(app: &tauri::AppHandle, event: TaskProgressEvent) {
    app.emit("task_progress", event)
        .unwrap_or_else(|e| eprintln!("Failed to emit task_progress: {}", e));
}

pub fn emit_task_completed(app: &tauri::AppHandle, event: TaskCompletedEvent) {
    app.emit("task_completed", event)
        .unwrap_or_else(|e| eprintln!("Failed to emit task_completed: {}", e));
}

pub fn emit_task_failed(app: &tauri::AppHandle, event: TaskFailedEvent) {
    app.emit("task_failed", event)
        .unwrap_or_else(|e| eprintln!("Failed to emit task_failed: {}", e));
}

pub fn emit_log_entry(app: &tauri::AppHandle, log: LogEntry) {
    app.emit("log_entry", log)
        .unwrap_or_else(|e| eprintln!("Failed to emit log_entry: {}", e));
}

pub fn emit_metrics_update(app: &tauri::AppHandle, metrics: MetricsData) {
    app.emit("metrics_update", metrics)
        .unwrap_or_else(|e| eprintln!("Failed to emit metrics_update: {}", e));
}

/// Task execution state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskState {
    pub id: String,
    pub status: String,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<u64>,
}

/// Application state shared across commands
pub struct AppState {
    pub maf_process: Mutex<Option<String>>,
    pub log_buffer: Mutex<Vec<LogEntry>>,
    pub metrics: Mutex<MetricsData>,
    pub tasks: Mutex<HashMap<String, TaskState>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub source: String,
    pub message: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetricsData {
    pub total_tasks: u64,
    pub completed_tasks: u64,
    pub failed_tasks: u64,
    pub total_tokens: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub avg_duration_ms: f64,
    pub agent_metrics: Vec<AgentMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentMetric {
    pub name: String,
    pub calls: u64,
    pub avg_duration_ms: f64,
    pub total_tokens: u64,
    pub success_rate: f64,
}

pub fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            maf_process: Mutex::new(None),
            log_buffer: Mutex::new(Vec::new()),
            metrics: Mutex::new(MetricsData::default()),
            tasks: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_metrics,
            commands::get_logs,
            commands::clear_logs,
            commands::run_task,
            commands::get_task_status,
            commands::get_config,
            commands::save_config,
            commands::get_agents,
            commands::get_workflows,
            commands::save_workflow,
            commands::read_window_info,
            commands::save_custom_agent,
            commands::delete_custom_agent,
            commands::get_custom_agents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
