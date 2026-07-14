# SPARK OS

**AI Fleet Orchestration System** | **Hệ điều hành Điều phối Hạm đội AI**

SPARK OS transforms developers from "prompt typists" into "fleet directors" — orchestrating AI agent fleets through 6 rigorous development phases: DEFINE → PLAN → SPEC → BUILD → VERIFY → RELEASE.

SPARK OS chuyển dịch vai trò lập trình viên từ "Người gõ prompt" sang "Cơ trưởng điều phối" — quản lý hạm đội AI Agent qua 6 pha phát triển nghiêm ngặt.

## Quick Start

```bash
# Install / Cài đặt
npm install
cd dashboard && npm install && cd ..

# Initialize project / Khởi tạo dự án
npx tsx src/index.ts init my-project

# Check status / Xem trạng thái
npx tsx src/index.ts status

# AI generates task list / AI sinh danh sách task
npx tsx src/index.ts plan

# Health check AI models / Kiểm tra kết nối AI
npx tsx src/index.ts ping-models

# Start Daemon (WebSocket port 9000)
npx tsx src/index.ts daemon

# Start Dashboard (port 3000)
cd dashboard && npm run dev
```

## Architecture / Kiến trúc

```
USER (Director)
      │
      ▼ [Approve / Reject]
┌──────────────────┐
│  SPARK Web GUI   │  Next.js Dashboard (localhost:3000)
└────────┬─────────┘
         ▲ WebSocket
         ▼
┌──────────────────┐
│  Local Daemon    │  Node.js (localhost:9000)
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
State Sync   Skill Router
(Git Hooks)  (Hermes Engine)
    │              │
    ▼              ▼
spark.yaml    LLM Engines
(Project DNA) (Ollama / DeepSeek)
```

## Project Structure / Cấu trúc dự án

```
spark-os/
├── src/
│   ├── index.ts              # CLI entry point (commander)
│   ├── commands/
│   │   ├── init.ts           # spark init — create .spark/, DB, config
│   │   ├── status.ts         # spark status — display project state
│   │   ├── plan.ts           # spark plan — AI task decomposition
│   │   └── ping-models.ts    # spark ping-models — AI health check
│   ├── daemon/
│   │   ├── index.ts          # WebSocket server, git watcher, state sync
│   │   └── health.ts         # RAM/CPU self-monitoring
│   ├── db/
│   │   ├── schema.ts         # SQLite schema (5 tables + trigger)
│   │   └── connection.ts     # better-sqlite3 WAL connection
│   ├── models/
│   │   └── adapter.ts        # IModelAdapter + Ollama/DeepSeek adapters
│   └── templates/
│       └── spark.yaml.ts     # Default project config template
├── dashboard/                # Next.js Dashboard app
│   └── app/
│       ├── layout.tsx
│       ├── globals.css
│       └── page.tsx          # Real-time tasks, RFA popup, events
├── AGENTS.md                 # Rules for AI agents working in this repo
├── BACKLOG.md                # Cycle tracker + test results
└── PRD_V5.md                 # Full architecture specification
```

## Features / Tính năng V1

**CLI Commands**
- `spark init` — Initialize project with .spark/, SQLite DB, config files
- `spark status` — Display project state, tasks, budget, RFA queue
- `spark plan` — AI reads spark.yaml and generates development tasks
- `spark ping-models` — Health check configured AI model adapters
- `spark daemon` — Start local daemon with WebSocket server
- `spark reload` — Reload config (Windows-compatible SIGHUP alternative)

**Local Daemon**
- SQLite WAL mode — concurrent read/write, ACID transactions
- WebSocket server (port 9000) — real-time state sync < 1s
- Git watcher — auto-detect commits every 5s
- Phase transition — parse `[phase]` in commit messages → auto-update task state
- Health monitor — 300MB warning + GC, 500MB kill + restart, 30s interval

**Dashboard (Next.js)**
- Real-time connection status with exponential backoff reconnect
- Live task list with color-coded status badges
- RFA approval popup with JSON payload display
- Recent git events timeline
- Approve/Reject buttons → WebSocket callback to Daemon

**AI Integration**
- Pluggable `IModelAdapter` interface (Ollama, DeepSeek, extensible)
- Heuristic-first skill router (cost-based → capability-based)
- Fallback: cheap model first → escalate on failure
- Token budget tracking per task with project-level caps

**Security**
- `.env.local` for secrets (gitignored, never in DB)
- AI-generated code written to `.spark/sandbox/` (not directly to project)
- 3-layer sandbox: L1 file scoping → L2 runtime flags → L3 Docker isolation
- Airlock rule: all AI output goes through VERIFY phase before merge

**RFA System (Human-in-the-Loop)**
- Agent pauses on high-risk decisions → creates approval request
- Dashboard popup shows payload details
- Human approves → Daemon unlocks task → AI generates code
- Full audit trail: resolved_at timestamp, resolution notes

## Configuration / Cấu hình (`spark.yaml`)

```yaml
project:
  name: "MyApp"
  tech_stack: ["NextJS 15", "TailwindCSS", "PostgreSQL"]

budget:
  budget_cap_usd: 15.0
  shared_overflow_pool: 10.0

model_registry:
  adapters:
    - id: "ollama-local"
      provider: "ollama"
      model_name: "hermes-3-llama-3-8b"
      base_url: "http://localhost:11434"
    - id: "deepseek-cloud"
      provider: "deepseek"
      model_name: "deepseek-coder"
```

## System Requirements / Yêu cầu hệ thống

| | Minimum | Recommended (Local AI) |
|---|---------|----------------------|
| **RAM** | 16GB | 16GB+ |
| **Storage** | SSD, 10GB free | SSD, 10GB free |
| **GPU** | Not required | NVIDIA 8GB VRAM / Apple Silicon 16GB |
| **Runtime** | Node.js 20+, Git 2.40+ | Node.js 20+, Git 2.40+ |
| **Fallback** | Auto-route to cloud API | Local Ollama + cloud API |

## Development Cycles / Các Cycle phát triển

All 11 cycles completed ✅ — see [BACKLOG.md](BACKLOG.md) for details.

| Cycle | Description | Status |
|-------|------------|--------|
| 1a | CLI `spark init` | ✅ |
| 1b | CLI `spark status` | ✅ |
| 1c | Local Daemon + SQLite WAL | ✅ |
| 1d | WebSocket + Dashboard | ✅ |
| 1e | Real-time state sync | ✅ |
| 2a | Git branch watcher | ✅ |
| 2b | Auto phase transition | ✅ |
| 3a | Multi-AI adapter setup | ✅ |
| 3b | AI task decomposition | ✅ |
| 4a | RFA trigger popup | ✅ |
| 4b | Approve → AI code gen | ✅ |

## License

MIT