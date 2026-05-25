<div align="center">

# MAF UI

### Multi-Agent Framework Visual Interface

<p>
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-latest-DEA584?style=flat-square&logo=rust&logoColor=white" alt="Rust">
</p>

<p>
  <img src="https://img.shields.io/github/license/toyangshome/MAF?style=flat-square" alt="License">
  <img src="https://img.shields.io/github/stars/toyangshome/MAF?style=flat-square" alt="Stars">
  <img src="https://img.shields.io/github/issues/toyangshome/MAF?style=flat-square" alt="Issues">
</p>

**A beautiful, modern desktop application for managing multi-agent AI workflows**

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Contributing](#-contributing)

---

</div>

## Features

<table>
<tr>
<td width="50%">

### Workflow Editor
- **DAG Visualization** — Interactive directed acyclic graph with ReactFlow
- **Drag & Drop** — Intuitive node creation and connection
- **Cycle Detection** — Automatic circular dependency prevention
- **Auto Layout** — Smart graph arrangement algorithms

</td>
<td width="50%">

### Agent Management
- **Custom Agents** — Create and configure your own AI agents
- **Provider Support** — OpenAI, Anthropic, DeepSeek, Ollama
- **Tool Configuration** — Enable/disable agent capabilities
- **System Prompts** — Fine-tune agent behavior

</td>
</tr>
<tr>
<td width="50%">

### Task Management
- **Task Submission** — Submit tasks with strategy selection
- **Dependency Tracking** — Visualize task dependencies
- **Batch Operations** — Multi-select and bulk actions
- **Real-time Status** — Live task progress updates

</td>
<td width="50%">

### Monitoring Dashboard
- **Performance Metrics** — Execution time, token usage, success rates
- **Visual Charts** — Line charts, heatmaps, radar charts
- **Health Gauges** — System health at a glance
- **Export Reports** — Generate and download reports

</td>
</tr>
<tr>
<td width="50%">

### Log Viewer
- **Real-time Streaming** — Live log updates
- **Level Filtering** — Filter by info/warn/error/debug
- **Search** — Full-text log search
- **Export** — Download logs as JSON

</td>
<td width="50%">

### Developer Experience
- **Keyboard Shortcuts** — Fast navigation with hotkeys
- **Command Palette** — `Cmd+Shift+P` for quick actions
- **Global Search** — `Cmd+K` to search anything
- **i18n Support** — Chinese & English

</td>
</tr>
</table>

---

## Quick Start

### Prerequisites

```bash
Node.js 18+   # JavaScript runtime
pnpm          # Package manager
Rust 1.70+    # For Tauri backend
Python 3.10+  # For MAF framework (optional)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/toyangshome/MAF.git
cd MAF

# Install dependencies
pnpm install
```

### Development

```bash
# Desktop app with backend (recommended)
pnpm tauri dev

# Browser only (with mock data)
pnpm dev
```

### Build

```bash
# Build executable
pnpm tauri build --no-bundle

# Output: src-tauri/target/release/maf-ui.exe
```

---

## Architecture

<div align="center">

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri WebView                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React 18 + TypeScript                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ Radix UI    │  │   Zustand   │  │   ReactFlow  │  │  │
│  │  │ Components  │  │   Store     │  │   (DAG)      │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │ invoke / events                   │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │                Rust Backend (Tauri)                   │  │
│  │  Commands • IPC • WebSocket • AppState                │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ stdio (JSON)
                  ┌────────▼────────┐
                  │  Python MAF     │
                  │  Multi-Agent    │
                  │  Framework      │
                  └─────────────────┘
```

</div>

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop** | Tauri v2 | Cross-platform desktop framework |
| **Frontend** | React 18 + TypeScript | UI development |
| **UI Library** | Radix UI Themes | Accessible, themeable components |
| **State** | Zustand | Lightweight state management |
| **Charts** | Recharts | Data visualization |
| **DAG** | ReactFlow | Workflow graph editor |
| **Build** | Vite 5 | Fast HMR and bundling |
| **Backend** | Rust | Native performance |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + K` | Global Search |
| `Cmd + Shift + P` | Command Palette |
| `Cmd + B` | Toggle Sidebar |
| `1` - `7` | Switch Pages |
| `Cmd + N` | New Task |
| `Cmd + Z` | Undo |
| `Cmd + Shift + Z` | Redo |
| `?` | Show Help |

---

## Project Structure

```
maf-ui/
├── src/
│   ├── api/                  # Tauri API wrapper with mock fallback
│   ├── components/           # Shared UI components
│   │   ├── Layout/           # App shell, sidebar, header
│   │   ├── ErrorBoundary/    # Error handling
│   │   ├── Toast/            # Notifications
│   │   └── ui/               # Base components
│   ├── features/             # Feature modules
│   │   ├── AgentManager/     # Agent CRUD operations
│   │   ├── WorkflowView/     # DAG editor
│   │   ├── TaskPanel/        # Task management
│   │   ├── LogPanel/         # Log viewer
│   │   ├── ConfigPanel/      # Configuration
│   │   ├── MonitorDashboard/ # Analytics dashboard
│   │   └── AIAssistant/      # AI helper panel
│   ├── stores/               # Zustand state management
│   ├── hooks/                # Custom React hooks
│   ├── i18n/                 # Internationalization
│   ├── styles/               # Design tokens & themes
│   ├── types/                # TypeScript definitions
│   └── utils/                # Utility functions
├── src-tauri/
│   ├── src/
│   │   ├── commands.rs       # Tauri commands
│   │   ├── lib.rs            # App state & events
│   │   └── ipc/              # WebSocket layer
│   └── Cargo.toml
└── package.json
```

---

## Screenshots

<div align="center">

> **Tip**: Run `pnpm tauri dev` to see the app in action!

| Workflow Editor | Agent Management |
|:---:|:---:|
| DAG visualization with drag-and-drop | Create and configure AI agents |

| Task Panel | Monitor Dashboard |
|:---:|:---:|
| Track task dependencies and status | Real-time performance metrics |

</div>

---

## Configuration

### Providers

Configure AI providers in the Settings page:

```typescript
interface ProviderOption {
  id: string;           // 'openai' | 'anthropic' | 'deepseek' | 'ollama'
  label: string;        // Display name
  models: string[];     // Available models
}
```

### Custom Agents

Create agents with custom configurations:

```typescript
interface CustomAgent {
  name: string;         // Agent name
  type: string;         // 'coder' | 'reviewer' | 'tester' | 'custom'
  model: string;        // AI model to use
  provider: string;     // Provider ID
  temperature: number;  // 0-2
  maxTokens: number;    // 256-32768
  systemPrompt: string; // Behavior definition
  tools: string[];      // Enabled capabilities
}
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using Tauri, React, and Rust**

<p>
  <img src="https://img.shields.io/badge/Made_with-Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=white" alt="Made with Tauri">
</p>

</div>
