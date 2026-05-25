# MAF UI — Claude Code 开发指南

## 项目概述

MAF UI (Multi-Agent Framework Visual Interface) 是一个 Tauri v2 桌面应用，用于可视化管理多智能体框架。
前端 React 18 + TypeScript，后端 Rust (Tauri v2)，调用 Python MAF 框架执行任务。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 桌面框架 | Tauri v2 | Rust 后端 + WebView 前端 |
| 前端 | React 18 + TypeScript | SPA |
| UI 组件 | @radix-ui/themes | 所有 UI 组件应优先使用 Radix Themes |
| 状态管理 | Zustand | 单一全局 store |
| 图表 | Recharts | 数据可视化 |
| DAG 图 | ReactFlow | 工作流可视化 |
| 构建 | Vite 5 | HMR 热更新 |

## 开发命令

```bash
pnpm dev            # 浏览器开发（mock 数据，无后端）
pnpm tauri dev      # 桌面开发（有后端，推荐）
pnpm build          # 前端构建
pnpm tauri build --no-bundle  # 构建 exe（跳过 MSI 打包）
```

## 关键规则

### UI 组件
- **必须使用 Radix UI Themes**：`import { Button, Dialog, TextField, ... } from '@radix-ui/themes'`
- 不要手写 `<button style={...}>`，用 `<Button>` 组件
- 不要手写 `<input>`，用 `<TextField.Root>`
- 不要手写 `<select>`，用 `<Select>`（`src/components/ui/Select.tsx` 包装了 Radix Themes Select）
- 颜色用 CSS 变量：`var(--gray-*)`, `var(--accent-*)`, `var(--blue-*)` 等

### 状态管理
- 全局状态在 `src/stores/useAppStore.ts`（Zustand store）
- 读取：`const x = useAppStore((s) => s.x)`
- 更新：`useAppStore.setState({ x: value })` 或调用 store action
- 持久化：providers、customAgents、主题等用 localStorage

### TypeScript
- 严格模式，不用 `as any`
- 类型定义在 `src/types/index.ts`

### 样式
- 内联样式对象 + CSS 变量（不用 CSS Modules / Tailwind）
- 间距用 4px 的倍数
- 暗色/亮色主题通过 CSS 变量自动切换

## 目录结构

```
src/
├── api/tauri.ts                # Tauri invoke 封装 + mock 降级
├── types/index.ts              # 核心类型定义 + 默认常量
├── stores/useAppStore.ts       # Zustand 全局状态（所有状态在这）
├── features/                   # 功能模块（每个独立）
│   ├── AgentManager/           # Agent 管理 + 编辑对话框
│   ├── WorkflowView/           # DAG 工作流编辑器
│   ├── LogPanel/               # 日志查看器
│   ├── TaskPanel/              # 任务管理
│   ├── ConfigPanel/            # 配置管理
│   ├── MonitorDashboard/       # 监控仪表板
│   ├── AIAssistant/            # AI 助手面板
│   ├── PerformanceMonitor/     # 性能监控
│   └── Comments/               # 评论系统
├── components/
│   ├── Layout/                 # 布局（Sidebar, Header, SplitPanel）
│   ├── ui/                     # 基础 UI（Select, Switch, Dialog 等）
│   ├── GlobalSearch/           # Cmd+K 搜索
│   ├── CommandPalette/         # Cmd+Shift+P 指令面板
│   ├── Toast/                  # 通知系统
│   ├── ErrorBoundary/          # 错误边界
│   └── ...
├── hooks/                      # 自定义 hooks
├── commands/                   # 命令注册表
├── communication/              # WebSocket 通信
├── storage/                    # IndexedDB + localStorage
├── i18n/                       # 中英文翻译
├── themes/                     # 主题定义
├── utils/                      # 工具函数
└── styles/                     # 全局 CSS（globals.css, design-system.css）

src-tauri/
├── src/commands.rs             # Tauri 命令（调用 Python 子进程）
├── src/lib.rs                  # AppState + 事件系统
├── src/ipc/                    # WebSocket IPC 层
└── Cargo.toml
```

## 重要文件说明

### `stores/useAppStore.ts`
整个应用的状态中心。包含：
- 数据：agents, logs, tasks, metrics, config, providers, customAgents, workflowNodes
- UI：theme, currentPage, sidebarCollapsed, loading, error
- 操作：fetchAll, submitTask, saveConfig, addProvider, addCustomAgent 等
- 持久化：providers → localStorage `maf-providers`，customAgents → `maf-custom-agents`

### `api/tauri.ts`
所有 Tauri invoke 调用的封装。非 Tauri 环境自动降级为 mock 数据（通过 `isTauri()` 检测）。

### `features/AgentManager/AgentEditorDialog.tsx`
Agent 创建/编辑对话框。Provider 从 store 读取（不是硬编码）。使用 Radix Themes 组件。

### `pages/settings.tsx`
设置页面。包含 Provider 管理（增删改 Provider 和模型）、默认配置、Agent 模板。

## 常见操作

### 添加新的设置项
1. 在 `useAppStore.ts` 添加 state + action
2. 在 `pages/settings.tsx` 添加 UI
3. 需要持久化时加 localStorage helper

### 添加新页面
1. 在 `features/` 下创建目录和组件
2. 在 `App.tsx` 的 `pages` 对象中注册
3. 在 `Sidebar.tsx` 添加导航项

### 修改 Agent 编辑器
文件：`src/features/AgentManager/AgentEditorDialog.tsx`
- Provider 列表从 `useAppStore((s) => s.providers)` 读取
- Model 列表根据选中 Provider 过滤

## API 降级机制

`src/api/tauri.ts` 中每个函数都会先尝试 `invoke()`。如果不是 Tauri 环境（浏览器 `pnpm dev`），
invoke 会失败，`fetchAll` 会捕获错误并使用 `src/mock/` 中的 mock 数据。

## 已知问题

- `pnpm tauri build` 时 WiX 工具集下载可能超时（网络问题），用 `--no-bundle` 跳过
- Python 子进程需要 Python 在 PATH 中且 MAF 框架目录存在
- Radix Themes v3 的 CSS 嵌套 `calc()` 可能产生 Vite 构建警告（不影响功能）

## 构建产物

- `src-tauri/target/release/maf-ui.exe` — 可执行文件（22MB）
- `dist/` — 前端静态文件
