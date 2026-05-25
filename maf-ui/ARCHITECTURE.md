# MAF UI 架构文档

## 概述

MAF UI 是 Multi-Agent Framework 的可视化管理桌面应用。基于 Tauri v2 (Rust) + React 18 + TypeScript。

## 系统架构

```
┌──────────────────────────────────────────────┐
│  Tauri WebView (React 18 + TypeScript)       │
│  ┌──────────────────────────────────────────┐│
│  │ Radix UI Themes (组件层)                  ││
│  │ Zustand Store (状态层)                    ││
│  │ Tauri API 封装 (通信层)                   ││
│  └──────────────┬───────────────────────────┘│
│                 │ invoke / events             │
│  ┌──────────────▼───────────────────────────┐│
│  │ Rust 后端 (Tauri commands)               ││
│  │ - commands.rs: 调用 Python 子进程        ││
│  │ - ipc/: WebSocket 通信层                 ││
│  │ - lib.rs: AppState + 事件发射            ││
│  └──────────────┬───────────────────────────┘│
└─────────────────┼────────────────────────────┘
                  │ stdio (JSON)
         ┌────────▼────────┐
         │ Python MAF 进程  │
         │ (multi-agent-    │
         │  framework)      │
         └─────────────────┘
```

## 前端架构

### 状态管理
单一 Zustand store (`src/stores/useAppStore.ts`) 管理所有状态。

### 数据流
```
用户操作 → Store Action → API 调用 → Store 更新 → 组件重渲染
                                    ↓ (失败时)
                               Mock 数据降级
```

### 组件层级
```
App.tsx
├── RadixTheme (主题提供者)
├── ErrorBoundary (全局错误捕获)
├── NotificationProvider (通知系统)
├── Layout
│   ├── Sidebar (导航)
│   ├── Header (搜索/主题/通知)
│   └── 页面内容 (通过 lazy loading)
│       ├── WorkflowView (DAG 编辑)
│       ├── LogPanel (日志)
│       ├── TaskPanel (任务)
│       ├── ConfigPanel (配置)
│       ├── MonitorDashboard (监控)
│       ├── AgentManager (Agent 管理)
│       └── PerformanceMonitor (性能)
├── GlobalSearch (Cmd+K)
├── CommandPalette (Cmd+Shift+P)
└── AIAssistantPanel (AI 助手)
```

### 数据持久化
| 数据 | 存储位置 | Key |
|------|---------|-----|
| Providers | localStorage | `maf-providers` |
| Custom Agents | localStorage | `maf-custom-agents` |
| 主题设置 | localStorage | `maf-active-theme-id` |
| 任务历史 | IndexedDB | DataManager |
| 日志历史 | IndexedDB | DataManager |
| 用户偏好 | localStorage | `maf-preferences` |

## 后端架构

### Tauri 命令 (`src-tauri/src/commands.rs`)
每个命令启动一个 Python 子进程，通过 stdin/stdout 通信：
- `get_agents` — 获取 Agent 列表
- `get_config` — 获取配置
- `save_config` — 保存配置
- `run_task` — 执行任务（长运行，流式输出）
- `get_logs` / `clear_logs` — 日志管理
- `get_metrics` — 指标数据
- `save_custom_agent` / `delete_custom_agent` / `get_custom_agents` — 自定义 Agent

### 事件系统 (`src-tauri/src/lib.rs`)
Rust → 前端的事件推送：
- `task_started` / `task_progress` / `task_completed` / `task_failed`
- `log_entry` / `metrics_update`

### IPC 层 (`src-tauri/src/ipc/`)
WebSocket 双向通信：
- `/ws/control` — 持久控制通道
- `/ws/turnstile` — 会话级通信

## 样式系统

### 设计令牌 (`src/styles/design-system.css`)
- `--gray-1` ~ `--gray-12`：灰度色阶
- `--accent-1` ~ `--accent-12`：主色调色阶
- `--blue-*`, `--green-*`, `--red-*`, `--amber-*`：语义色
- `--status-*`：状态色（idle, running, done, error, warning）

### 组件样式
- 默认使用 Radix UI Themes 组件（自带样式）
- 自定义样式用内联 style 对象 + CSS 变量
- 动画用 `<style>` 标签注入 keyframes

### 主题切换
Radix Theme Provider 在 `App.tsx` 中动态设置 `appearance`（dark/light）。
所有 CSS 变量自动切换。
