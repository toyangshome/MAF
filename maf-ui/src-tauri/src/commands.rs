use crate::{
    AppState, LogEntry, MetricsData, TaskState,
    TaskStartedEvent, TaskProgressEvent, TaskCompletedEvent, TaskFailedEvent,
};
use serde::{Deserialize, Serialize};
use tauri::State;

// ── 常量 ───────────────────────────────────────────────────

/// 获取 MAF Python 框架项目路径
/// 优先从环境变量 MAF_DIR 读取，未设置时使用默认值
fn get_maf_dir() -> String {
    std::env::var("MAF_DIR")
        .unwrap_or_else(|_| "D:\\ZeneWorkMainNexus\\ClaudeWorkSpace\\multi-agent-framework".to_string())
}

// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRequest {
    pub task: String,
    pub workflow: Option<String>,
    pub agent: Option<String>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    pub id: String,
    pub status: String,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub agent_type: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub workflow_type: String,
    pub description: String,
}

// ── 命令实现 ──────────────────────────────────────────────

#[tauri::command]
pub fn get_metrics(state: State<AppState>) -> Result<MetricsData, String> {
    let metrics = state.metrics.lock().map_err(|e| e.to_string())?;
    Ok(metrics.clone())
}

#[tauri::command]
pub fn get_logs(
    state: State<AppState>,
    level: Option<String>,
    source: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let logs = state.log_buffer.lock().map_err(|e| e.to_string())?;
    let mut filtered: Vec<LogEntry> = logs
        .iter()
        .filter(|log| {
            level.as_ref().map_or(true, |l| log.level == *l)
                && source.as_ref().map_or(true, |s| log.source == *s)
        })
        .cloned()
        .collect();

    if let Some(limit) = limit {
        filtered.truncate(limit);
    }
    Ok(filtered)
}

#[tauri::command]
pub fn clear_logs(state: State<AppState>) -> Result<(), String> {
    let mut logs = state.log_buffer.lock().map_err(|e| e.to_string())?;
    logs.clear();
    Ok(())
}

/// 启动 MAF Python 进程执行任务，通过 JSON 协议获取结果
#[tauri::command]
pub async fn run_task(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    request: TaskRequest,
) -> Result<TaskResult, String> {
    let maf_dir = get_maf_dir();
    let task_id = uuid::Uuid::new_v4().to_string();
    let start_time = std::time::Instant::now();

    // 注册任务为 running 状态
    {
        let mut tasks = state.tasks.lock().map_err(|e| e.to_string())?;
        tasks.insert(
            task_id.clone(),
            TaskState {
                id: task_id.clone(),
                status: "running".into(),
                output: None,
                error: None,
                duration_ms: None,
            },
        );
    }

    // 添加日志条目
    {
        let mut logs = state.log_buffer.lock().map_err(|e| e.to_string())?;
        logs.push(LogEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: "info".into(),
            source: "orchestrator".into(),
            message: format!("Task started: {}", request.task),
            metadata: None,
        });
    }

    // 发射 task_started 事件
    crate::emit_task_started(
        &app_handle,
        TaskStartedEvent {
            task_id: task_id.clone(),
            task_description: request.task.clone(),
        },
    );

    // 构建命令行参数
    let mut cmd = tokio::process::Command::new("python");
    cmd.arg("-m")
        .arg("maf.main")
        .arg("run")
        .arg("--format")
        .arg("json");

    if let Some(ref workflow) = request.workflow {
        cmd.arg("--workflow").arg(workflow);
    }
    if let Some(ref agent) = request.agent {
        cmd.arg("--agent").arg(agent);
    }

    cmd.arg(&request.task);

    // 设置环境变量：PYTHONPATH 指向 MAF 项目目录
    cmd.env("PYTHONPATH", &maf_dir)
        .env("MAF_DIR", &maf_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .kill_on_drop(true);

    // 异步启动子进程
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start MAF process: {}", e))?;

    // 获取 stdout/stderr 句柄
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // 发射 task_progress 事件
    crate::emit_task_progress(
        &app_handle,
        TaskProgressEvent {
            task_id: task_id.clone(),
            phase: "executing".into(),
            detail: format!("Running MAF task: {}", request.task),
        },
    );

    // 并发读取 stdout 和 stderr
    let stdout_task = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut reader = tokio::io::BufReader::new(stdout);
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf).await.map(|_| buf)
    });

    let stderr_task = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut reader = tokio::io::BufReader::new(stderr);
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf).await.map(|_| buf)
    });

    // 等待进程完成
    let exit_status = child
        .wait()
        .await
        .map_err(|e| format!("Process wait failed: {}", e))?;

    // 收集输出
    let stdout_bytes = stdout_task
        .await
        .map_err(|e| format!("stdout task failed: {}", e))?
        .map_err(|e| format!("stdout read failed: {}", e))?;

    let stderr_bytes = stderr_task
        .await
        .map_err(|e| format!("stderr task failed: {}", e))?
        .map_err(|e| format!("stderr read failed: {}", e))?;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    // 构建任务结果
    let result = if exit_status.success() {
        let output = String::from_utf8_lossy(&stdout_bytes).to_string();
        TaskResult {
            id: task_id.clone(),
            status: "completed".into(),
            output: Some(output),
            error: None,
            duration_ms: Some(duration_ms),
        }
    } else {
        let error = String::from_utf8_lossy(&stderr_bytes).to_string();
        TaskResult {
            id: task_id.clone(),
            status: "failed".into(),
            output: None,
            error: Some(if error.is_empty() {
                format!("Process exited with code: {:?}", exit_status.code())
            } else {
                error
            }),
            duration_ms: Some(duration_ms),
        }
    };

    // 更新任务状态
    {
        let mut tasks = state.tasks.lock().map_err(|e| e.to_string())?;
        tasks.insert(
            task_id.clone(),
            TaskState {
                id: task_id.clone(),
                status: result.status.clone(),
                output: result.output.clone(),
                error: result.error.clone(),
                duration_ms: result.duration_ms,
            },
        );
    }

    // 更新指标
    {
        let mut metrics = state.metrics.lock().map_err(|e| e.to_string())?;
        metrics.total_tasks += 1;
        if result.status == "completed" {
            metrics.completed_tasks += 1;
        } else {
            metrics.failed_tasks += 1;
        }
        // 更新平均耗时
        let total = metrics.completed_tasks + metrics.failed_tasks;
        if total > 0 {
            metrics.avg_duration_ms =
                (metrics.avg_duration_ms * (total - 1) as f64 + duration_ms as f64) / total as f64;
        }
    }

    // 发射最终事件
    if result.status == "completed" {
        crate::emit_task_completed(
            &app_handle,
            TaskCompletedEvent {
                task_id: task_id.clone(),
                result: result.output.clone().unwrap_or_default(),
            },
        );
    } else {
        crate::emit_task_failed(
            &app_handle,
            TaskFailedEvent {
                task_id: task_id.clone(),
                error: result.error.clone().unwrap_or_default(),
            },
        );
    }

    // 发射指标更新事件
    if let Ok(metrics) = state.metrics.lock() {
        crate::emit_metrics_update(&app_handle, metrics.clone());
    }

    Ok(result)
}

/// 查询任务执行状态
#[tauri::command]
pub fn get_task_status(state: State<AppState>, task_id: String) -> Result<TaskResult, String> {
    let tasks = state.tasks.lock().map_err(|e| e.to_string())?;
    match tasks.get(&task_id) {
        Some(task) => Ok(TaskResult {
            id: task.id.clone(),
            status: task.status.clone(),
            output: task.output.clone(),
            error: task.error.clone(),
            duration_ms: task.duration_ms,
        }),
        None => Ok(TaskResult {
            id: task_id,
            status: "not_found".into(),
            output: None,
            error: None,
            duration_ms: None,
        }),
    }
}

/// 通过 Python 子进程读取 MAF YAML 配置文件
/// 使用 stdin 传递 MAF_DIR 路径，避免将用户数据拼入代码字符串
#[tauri::command]
pub async fn get_config() -> Result<serde_json::Value, String> {
    let maf_dir = get_maf_dir();
    let python_script = r#"
import json, sys, os

maf_dir = sys.stdin.readline().strip()
sys.path.insert(0, maf_dir)
from maf.config import load_config
c = load_config()
print(json.dumps({
    "default_provider": c.default_provider,
    "default_model": c.default_model,
    "max_retries": c.max_retries,
    "timeout": c.timeout,
    "log_level": c.log_level,
    "agent_templates": {k: v.model_dump() for k, v in c.agent_templates.items()},
    "workflows": {k: v.model_dump() for k, v in c.workflows.items()},
}))
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n", maf_dir).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to load config: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse config JSON: {}", e))
}

/// 保存配置到 MAF YAML 文件
/// 通过 stdin 传递 JSON 数据，避免命令注入风险
#[tauri::command]
pub async fn save_config(config: serde_json::Value) -> Result<(), String> {
    let maf_dir = get_maf_dir();
    let config_json = serde_json::to_string(&config).map_err(|e| e.to_string())?;

    let python_script = r#"
import json, sys, yaml

maf_dir = sys.stdin.readline().strip()
config_json = sys.stdin.readline().strip()

sys.path.insert(0, maf_dir)
config_data = json.loads(config_json)
config_path = maf_dir + r"\maf.yaml"
with open(config_path, 'w', encoding='utf-8') as f:
    yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)
print("OK")
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n{}\n", maf_dir, config_json).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to save config: {}", stderr));
    }

    Ok(())
}

/// 从配置中读取已注册的 agent 列表
#[tauri::command]
pub async fn get_agents() -> Result<Vec<AgentInfo>, String> {
    let maf_dir = get_maf_dir();
    let python_script = r#"
import json, sys

maf_dir = sys.stdin.readline().strip()
sys.path.insert(0, maf_dir)
from maf.config import load_config
c = load_config()

agents = []
# 内置 agent 类型
builtin_agents = [
    {"name": "decomposer", "type": "builtin", "description": "Task decomposition into subtasks"},
    {"name": "coder", "type": "builtin", "description": "Code generation and implementation"},
    {"name": "reviewer", "type": "builtin", "description": "Code review and quality analysis"},
    {"name": "tester", "type": "builtin", "description": "Test generation and execution"},
    {"name": "searcher", "type": "builtin", "description": "Information retrieval and research"},
]
agents.extend(builtin_agents)

# 从配置的 agent_templates 中读取自定义 agent
for name, tmpl in c.agent_templates.items():
    desc = tmpl.system_prompt[:100] if tmpl.system_prompt else "Custom agent"
    agents.append({"name": name, "type": "custom", "description": desc})

print(json.dumps(agents))
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n", maf_dir).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to get agents: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse agents JSON: {}", e))
}

/// 从配置中读取可用工作流
#[tauri::command]
pub async fn get_workflows() -> Result<Vec<WorkflowInfo>, String> {
    let maf_dir = get_maf_dir();
    let python_script = r#"
import json, sys

maf_dir = sys.stdin.readline().strip()
sys.path.insert(0, maf_dir)
from maf.config import load_config
c = load_config()

workflows = []
# 内置工作流类型
builtin_workflows = [
    {"name": "dev_loop", "type": "dev_loop", "description": "Code -> Review -> Test loop"},
    {"name": "code_review", "type": "code_review", "description": "Automated code review workflow"},
    {"name": "bug_fix", "type": "bug_fix", "description": "Bug detection and fix workflow"},
    {"name": "feature_dev", "type": "feature_dev", "description": "Feature development workflow"},
]
workflows.extend(builtin_workflows)

# 从配置的 workflows 中读取自定义工作流
for name, wf in c.workflows.items():
    workflows.append({
        "name": name,
        "type": wf.type,
        "description": f"Custom workflow (strategy: {wf.strategy}, max_iter: {wf.max_iterations})"
    })

print(json.dumps(workflows))
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n", maf_dir).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to get workflows: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse workflows JSON: {}", e))
}

/// 保存工作流到 MAF YAML 文件
#[tauri::command]
pub async fn save_workflow(workflow: serde_json::Value) -> Result<(), String> {
    let maf_dir = get_maf_dir();
    let workflow_json = serde_json::to_string(&workflow).map_err(|e| e.to_string())?;

    let python_script = r#"
import json, sys, yaml, os

maf_dir = sys.stdin.readline().strip()
workflow_json = sys.stdin.readline().strip()

sys.path.insert(0, maf_dir)
workflow_data = json.loads(workflow_json)

# Load existing config
from maf.config import load_config
c = load_config()

# Update workflows section
if 'workflows' not in c.__dict__ or c.workflows is None:
    c.workflows = {}

nodes = workflow_data.get('nodes', [])
for node in nodes:
    name = node.get('id', f'node-{len(c.workflows)}')
    c.workflows[name] = {
        'type': node.get('agentType', 'custom'),
        'label': node.get('label', name),
        'dependencies': node.get('dependencies', []),
        'status': node.get('status', 'idle'),
    }

# Save back
config_path = os.path.join(maf_dir, 'maf.yaml')
with open(config_path, 'w', encoding='utf-8') as f:
    yaml.dump(c.__dict__ if hasattr(c, '__dict__') else {}, f, default_flow_style=False, allow_unicode=True)
print("OK")
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n{}\n", maf_dir, workflow_json).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to save workflow: {}", stderr));
    }

    Ok(())
}

/// 读取当前窗口信息（位置、大小等）
#[tauri::command]
pub fn read_window_info(window: tauri::Window) -> Result<serde_json::Value, String> {
    let label = window.label().to_string();
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "label": label,
        "width": size.width,
        "height": size.height,
        "x": position.x,
        "y": position.y,
    }))
}

// ── 自定义 Agent 命令 ──────────────────────────────────────

/// 保存自定义 Agent 到 JSON 配置文件
#[tauri::command]
pub async fn save_custom_agent(agent: serde_json::Value) -> Result<(), String> {
    let maf_dir = get_maf_dir();
    let agent_json = serde_json::to_string(&agent).map_err(|e| e.to_string())?;

    let python_script = r#"
import json, sys, os

maf_dir = sys.stdin.readline().strip()
agent_json = sys.stdin.readline().strip()

agent_data = json.loads(agent_json)
config_path = os.path.join(maf_dir, 'custom_agents.json')

# Load existing custom agents
agents = []
if os.path.exists(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        agents = json.load(f)

# Update or add
agent_id = agent_data.get('id', '')
found = False
for i, a in enumerate(agents):
    if a.get('id') == agent_id:
        agents[i] = agent_data
        found = True
        break
if not found:
    agents.append(agent_data)

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(agents, f, ensure_ascii=False, indent=2)
print("OK")
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n{}\n", maf_dir, agent_json).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to save custom agent: {}", stderr));
    }

    Ok(())
}

/// 删除自定义 Agent
#[tauri::command]
pub async fn delete_custom_agent(agent_id: String) -> Result<(), String> {
    let maf_dir = get_maf_dir();

    let python_script = r#"
import json, sys, os

maf_dir = sys.stdin.readline().strip()
agent_id = sys.stdin.readline().strip()

config_path = os.path.join(maf_dir, 'custom_agents.json')
if not os.path.exists(config_path):
    print("OK")
    sys.exit(0)

with open(config_path, 'r', encoding='utf-8') as f:
    agents = json.load(f)

agents = [a for a in agents if a.get('id') != agent_id]

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(agents, f, ensure_ascii=False, indent=2)
print("OK")
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n{}\n", maf_dir, agent_id).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to delete custom agent: {}", stderr));
    }

    Ok(())
}

/// 获取自定义 Agent 列表
#[tauri::command]
pub async fn get_custom_agents() -> Result<serde_json::Value, String> {
    let maf_dir = get_maf_dir();

    let python_script = r#"
import json, sys, os

maf_dir = sys.stdin.readline().strip()
config_path = os.path.join(maf_dir, 'custom_agents.json')

if not os.path.exists(config_path):
    print("[]")
    sys.exit(0)

with open(config_path, 'r', encoding='utf-8') as f:
    agents = json.load(f)

print(json.dumps(agents))
"#;

    let mut child = tokio::process::Command::new("python")
        .arg("-c")
        .arg(python_script)
        .env("PYTHONPATH", &maf_dir)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW - 不弹出控制台窗口
        .spawn()
        .map_err(|e| format!("Failed to start Python: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        tokio::io::AsyncWriteExt::write_all(&mut stdin, format!("{}\n", maf_dir).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
    }
    let output = child.wait_with_output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to get custom agents: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("Failed to parse custom agents JSON: {}", e))
}
