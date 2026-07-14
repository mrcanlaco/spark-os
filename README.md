# SPARK OS

**Hệ điều hành Điều phối và Quản trị Hạm đội AI Agentic**

SPARK OS chuyển dịch vai trò lập trình viên từ "Người gõ prompt" sang "Cơ trưởng điều phối" — quản lý hạm đội AI Agent qua 6 pha nghiêm ngặt: DEFINE → PLAN → SPEC → BUILD → VERIFY → RELEASE.

## Quick Start

```bash
# Cài đặt
npm install
cd dashboard && npm install && cd ..

# Khởi tạo dự án
npx tsx src/index.ts init my-project

# Xem trạng thái
npx tsx src/index.ts status

# AI sinh task list từ spark.yaml
npx tsx src/index.ts plan

# Kiểm tra kết nối AI models
npx tsx src/index.ts ping-models

# Khởi chạy Daemon (WebSocket port 9000)
npx tsx src/index.ts daemon

# Dashboard (port 3000)
cd dashboard && npm run dev
```

## Kiến trúc

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

## Cấu trúc dự án

```
spark-os/
├── src/
│   ├── index.ts              # CLI entry point (commander)
│   ├── commands/
│   │   ├── init.ts           # spark init — tạo .spark/, DB, config
│   │   ├── status.ts         # spark status — hiển thị project state
│   │   ├── plan.ts           # spark plan — AI sinh task list
│   │   └── ping-models.ts    # spark ping-models — health check AI
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
├── AGENTS.md                 # Quy tắc cho AI agents làm việc trong repo
├── BACKLOG.md                # Cycle tracker + test results
└── PRD_V5.md                 # Tài liệu kiến trúc chi tiết
```

## Tính năng V1

- **CLI Commands:** `init`, `status`, `plan`, `ping-models`, `daemon`, `reload`
- **SQLite WAL:** 5 bảng (projects, tasks, state_transitions, rfa_queue, events) + CHECK constraints + auto-update trigger
- **Local Daemon:** WebSocket server, health monitor (300MB warning / 500MB kill), git watcher (5s poll)
- **Real-time Dashboard:** Next.js + Tailwind, WebSocket sync < 1s, RFA approval popup
- **Git Integration:** Auto-detect commits, parse `[phase]` convention → auto phase transition
- **Multi-AI Router:** Pluggable IModelAdapter (Ollama local + DeepSeek API), heuristic fallback
- **AI Task Planning:** Đọc spark.yaml → AI phân tích tech stack → sinh task list vào DB
- **RFA System:** Human-in-the-loop approval — Agent dừng khi cần phê duyệt, Dashboard popup, Approve → AI sinh code vào sandbox
- **Security:** .env.local cho secrets (gitignored), code sinh vào .spark/sandbox/ (không trực tiếp vào project)

## Cấu hình (`spark.yaml`)

```yaml
project:
  name: "MyApp"
  tech_stack: ["NextJS 15", "TailwindCSS", "PostgreSQL"]

budget:
  budget_cap_usd: 15.0

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

- **Minimum:** 16GB RAM, SSD, Node.js 20+, Git 2.40+
- **Local AI:** NVIDIA GPU 8GB VRAM hoặc Apple Silicon 16GB+
- **Fallback:** Không GPU → auto-route sang API cloud

## License

MIT