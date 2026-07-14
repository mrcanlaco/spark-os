# SPARK OS

**AI Fleet Orchestration System** — v2.0.0

SPARK OS transforms developers from "prompt typists" into "fleet directors" — orchestrating AI agent fleets through 6 rigorous development phases: DEFINE → PLAN → SPEC → BUILD → VERIFY → RELEASE.

## Quick Start

```bash
# Install
npm install
cd dashboard && npm install && cd ..

# Initialize project
npx tsx src/index.ts init my-project

# Check status (budget %, tasks, audit logs)
npx tsx src/index.ts status

# AI generates task list (with token tracking)
npx tsx src/index.ts plan

# View AI decision logs + recurring patterns
npx tsx src/index.ts decisions

# Health check AI models
npx tsx src/index.ts ping-models

# Start Daemon (WebSocket port 9000)
npx tsx src/index.ts daemon

# Start Dashboard (port 3000)
cd dashboard && npm run dev
```

## Architecture

```
USER (Director)
      │
      ▼ [Approve / Reject]
┌──────────────────┐
│  SPARK Web GUI   │  Next.js Dashboard (localhost:3000)
│  Budget Bar      │  Health Monitor, Audit Viewer
│  RFA Approve/    │  Hibernation Badge
│  Reject + Notes  │
└────────┬─────────┘
         ▲ WebSocket (STATE_SYNC)
         ▼
┌──────────────────┐
│  Local Daemon    │  Node.js (localhost:9000)
│  Audit Logger    │  Decision Logs, Hibernation
│  Resource Acct   │  500MB cap, CPU-1 concurrency
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
    │
    ▼
spark.db (SQLite WAL)
├── projects        (budget tracking, hibernation)
├── tasks           (token cost per task)
├── rfa_queue       (approve/reject + notes)
├── events          (git commits, system events)
├── state_transitions (phase change audit)
└── decision_logs   (AI call tracking, pattern mining)
```

## Project Structure

```
spark-os/
├── src/
│   ├── index.ts              # CLI entry point (commander) — v2.0.0
│   ├── commands/
│   │   ├── init.ts           # spark init — create .spark/, DB, config
│   │   ├── status.ts         # spark status — project state + budget % + audit stats
│   │   ├── plan.ts           # spark plan — AI task decomposition + token tracking
│   │   ├── ping-models.ts    # spark ping-models — AI health check
│   │   └── decisions.ts      # spark decisions — AI decision logs + pattern mining [V2]
│   ├── daemon/
│   │   ├── index.ts          # WS server, git watcher, state sync, hibernation [V2]
│   │   ├── health.ts         # RAM/CPU monitoring + resource accounting [V2]
│   │   └── audit.ts          # Audit log rotation (50MB→.gz, 14d retention) [V2]
│   ├── db/
│   │   ├── schema.ts         # SQLite schema (6 tables + 2 triggers) [V2]
│   │   └── connection.ts     # better-sqlite3 WAL connection
│   ├── models/
│   │   └── adapter.ts        # IModelAdapter + GenerateResult with token/cost [V2]
│   └── templates/
│       └── spark.yaml.ts     # Default project config template
├── dashboard/                # Next.js Dashboard app
│   └── app/
│       ├── layout.tsx
│       ├── globals.css
│       └── page.tsx          # Budget bar, health panel, reject + notes [V2]
├── AGENTS.md                 # Rules for AI agents working in this repo
├── BACKLOG.md                # Cycle tracker + test results (18 cycles)
└── PRD_V5.md                 # Full architecture specification
```

## Features

### V1 — Foundation (Cycles 1a–4b) ✅

**CLI Commands**
- `spark init` — Initialize project with .spark/, SQLite DB, config files
- `spark status` — Display project state, tasks, budget, RFA queue
- `spark plan` — AI reads spark.yaml and generates development tasks
- `spark ping-models` — Health check configured AI model adapters
- `spark daemon` — Start local daemon with WebSocket server

**Local Daemon**
- SQLite WAL mode — concurrent read/write, ACID transactions
- WebSocket server (port 9000) — real-time state sync < 1s
- Git watcher — auto-detect commits every 5s
- Phase transition — parse `[phase]` in commit messages → auto-update task state
- Health monitor — 300MB warning + GC, 500MB kill + restart

**Dashboard (Next.js)**
- Real-time connection with exponential backoff reconnect
- Live task list with color-coded status badges
- RFA approval popup with JSON payload display
- Recent git events timeline

**AI Integration**
- Pluggable `IModelAdapter` interface (Ollama, DeepSeek, extensible)
- Fallback: cheap model first → escalate on failure

**RFA System (Human-in-the-Loop)**
- Agent pauses on high-risk decisions → creates approval request
- Human approves → Daemon unlocks task → AI generates code

---

### V2 — Operations (Cycles 5a–7b) ✅

**Cycle 5a: Audit Log Rotation + Decision Logs**
- `AuditLogger` class writes JSON lines to `.spark/audit_logs/spark-YYYY-MM-DD.log`
- Auto-rotation at 50MB → gzip compression
- Cleanup files older than 14 days
- Daemon logs every action: approve, reject, phase transition, AI code gen, health events, hibernation
- `spark status` shows audit log file count and total size

**Cycle 5b: Token Budget Tracking**
- `IModelAdapter.generateText()` returns `GenerateResult { text, tokens_used, cost_usd }`
- Per-task cost tracking via `tasks.token_cost_usd`
- SQLite trigger `budget_sync_on_task_cost` auto-syncs to `projects.budget_used_usd`
- Budget >= 90% of cap → auto-creates `BUDGET_EXCEEDED` RFA
- `spark status` shows budget percentage

**Cycle 5c: Reject RFA + Resolution Notes**
- Dashboard Reject button with resolution note input
- WS message `REJECT_RFA` → daemon sets `rfa_queue.status = REJECTED`
- `resolution_note` saved on RFA, `error_message` set on task
- Task status → FAILED on rejection
- Full audit trail for rejected decisions

**Cycle 6a: Process Resource Accounting**
- `HealthReport` includes `rss_mb`, `cpu_count`, `max_concurrent_tasks`, `status`
- Concurrent task limit: `CPU cores - 1`
- Child processes spawned with `--max-old-space-size=250` (250MB cap)
- Dashboard health panel: RSS, CPU, active tasks, daemon uptime
- Thresholds: 300MB warning + GC, 500MB kill + graceful shutdown

**Cycle 6b: Project Hibernation**
- Tracks `last_activity_at` per project
- Idle > 15 minutes → project status changes to `HIBERNATED`
- Any new event (git commit, WS message) → automatic wake-up to `ACTIVE`
- `HIBERNATED` status enforced by CHECK constraint
- Dashboard shows hibernation badge

**Cycle 7a: Decision Log + Pattern Mining**
- `decision_logs` table: task_id, prompt_hash, model, tokens_used, cost_usd
- Every AI call inserts a decision log entry
- `spark decisions` command shows recent 20 decisions with task context
- Pattern detection: groups by `prompt_hash`, flags >= 3 occurrences
- Suggests caching or template reuse for recurring patterns

**Cycle 7b: Dashboard V2**
- **Budget bar** with color coding (green < 50%, yellow < 90%, red >= 90%)
- **Health panel** showing RSS memory, CPU count, active/max tasks, daemon uptime
- **Reject button** with resolution note text input on both inline RFA list and modal
- **Audit log stats** panel showing file count and total size
- **Hibernation badge** when project is idle

## Development Cycles

All 18 cycles completed ✅ — see [BACKLOG.md](BACKLOG.md) for details + test results.

| Phase | Cycle | Description | Status |
|-------|-------|------------|--------|
| V1 | 1a | CLI `spark init` | ✅ |
| V1 | 1b | CLI `spark status` | ✅ |
| V1 | 1c | Local Daemon + SQLite WAL | ✅ |
| V1 | 1d | WebSocket + Dashboard | ✅ |
| V1 | 1e | Real-time state sync | ✅ |
| V1 | 2a | Git branch watcher | ✅ |
| V1 | 2b | Auto phase transition | ✅ |
| V1 | 3a | Multi-AI adapter setup | ✅ |
| V1 | 3b | AI task decomposition | ✅ |
| V1 | 4a | RFA trigger popup | ✅ |
| V1 | 4b | Approve → AI code gen | ✅ |
| **V2** | **5a** | **Audit log rotation + decision logs** | ✅ |
| **V2** | **5b** | **Token budget tracking** | ✅ |
| **V2** | **5c** | **Reject RFA + resolution notes** | ✅ |
| **V2** | **6a** | **Process resource accounting** | ✅ |
| **V2** | **6b** | **Project hibernation** | ✅ |
| **V2** | **7a** | **Decision log + pattern mining** | ✅ |
| **V2** | **7b** | **Dashboard V2** | ✅ |

## V2 Test Results (56/56 PASS)

| Category | Tests | Result |
|----------|-------|--------|
| Schema (6 tables, 2 triggers) | 8 | ✅ |
| Column validation | 8 | ✅ |
| CHECK constraints (status, RFA types) | 11 | ✅ |
| Budget trigger (cost sync, accumulation) | 2 | ✅ |
| Reject RFA flow | 5 | ✅ |
| Decision logs + pattern mining | 3 | ✅ |
| Audit logs (JSON lines, file naming) | 3 | ✅ |
| Resource accounting | 2 | ✅ |
| File structure (14 files) | 14 | ✅ |

**Build checks:** `tsc --noEmit` 0 errors ✅ | `next build` compiled ✅
**WS integration:** STATE_SYNC with health/audit/uptime/hibernation ✅ | REJECT_RFA via WS ✅

## Configuration (`spark.yaml`)

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

## System Requirements

| | Minimum | Recommended (Local AI) |
|---|---------|----------------------|
| **RAM** | 16GB | 16GB+ |
| **Storage** | SSD, 10GB free | SSD, 10GB free |
| **GPU** | Not required | NVIDIA 8GB VRAM / Apple Silicon 16GB |
| **Runtime** | Node.js 20+, Git 2.40+ | Node.js 20+, Git 2.40+ |
| **Fallback** | Auto-route to cloud API | Local Ollama + cloud API |

## License

MIT
