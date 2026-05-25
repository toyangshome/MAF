# MAF UI

Multi-Agent Framework 可视化管理桌面应用。

## 技术栈

Tauri v2 (Rust) + React 18 + TypeScript + Radix UI Themes + Zustand

## 快速开始

```bash
pnpm install

# 开发模式（推荐）
pnpm tauri dev

# 仅前端（浏览器，mock 数据）
pnpm dev

# 构建桌面应用
pnpm tauri build --no-bundle
# 产物: src-tauri/target/release/maf-ui.exe
```

**环境要求**: Node.js 18+, pnpm, Rust 1.70+

## 功能

| 模块 | 说明 |
|------|------|
| 工作流编辑器 | DAG 可视化，拖拽节点，循环检测，自动布局 |
| 日志查看器 | 实时日志流，级别过滤，搜索，导出 |
| 任务管理 | 任务提交，状态跟踪，依赖可视化，批量操作 |
| 配置管理 | Provider/Model 配置，YAML 导入导出 |
| 监控仪表板 | 趋势图，热力图，雷达图，健康仪表盘 |
| Agent 管理 | 创建/编辑 Agent，Provider 自定义，工具配置 |
| 全局搜索 | Cmd+K 搜索，Cmd+Shift+P 指令面板 |
| 主题 & 国际化 | 暗色/亮色切换，中英文 |

## 快捷键

| 键 | 功能 |
|----|------|
| `Cmd+K` | 全局搜索 |
| `Cmd+Shift+P` | 指令面板 |
| `Cmd+B` | 切换侧边栏 |
| `1`-`7` | 切换页面 |
| `?` | 快捷键帮助 |

## 项目结构

```
src/
├── api/tauri.ts            # Tauri API 封装（自动 mock 降级）
├── types/index.ts          # 核心类型
├── stores/useAppStore.ts   # Zustand 全局状态
├── features/               # 功能模块
│   ├── AgentManager/       # Agent 管理
│   ├── WorkflowView/       # 工作流 DAG
│   ├── LogPanel/           # 日志
│   ├── TaskPanel/          # 任务
│   ├── ConfigPanel/        # 配置
│   ├── MonitorDashboard/   # 监控
│   ├── AIAssistant/        # AI 助手
│   └── PerformanceMonitor/ # 性能
├── components/             # 共享组件
├── stores/                 # 状态管理
├── i18n/                   # 国际化
└── styles/                 # 全局样式
src-tauri/
├── src/commands.rs         # Rust 命令（Python 子进程）
├── src/lib.rs              # AppState + 事件
└── src/ipc/                # WebSocket IPC
```

## 开发文档

- `CLAUDE.md` — Claude Code 开发指南（详细规则和约定）
- `ARCHITECTURE.md` — 系统架构详解
