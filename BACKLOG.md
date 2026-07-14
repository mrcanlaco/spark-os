# BACKLOG.md — Danh sách Cycle triển khai SPARK OS

> **Hướng dẫn Agent:** Tìm Cycle đầu tiên có status `TODO`, implement theo acceptance criteria, rồi chuyển status thành `REVIEW`.

---

## Cycle 1a: CLI `spark init` — ✅ DONE
**Mô tả:** Chạy `spark init <name>` tạo .spark/, spark.yaml, .env.local, .gitignore, spark.db.
**Files:** `src/commands/init.ts`, `src/db/schema.ts`, `src/db/connection.ts`, `src/templates/spark.yaml.ts`

## Cycle 1b: CLI `spark status` — ✅ DONE
**Mô tả:** Chạy `spark status` hiển thị project, budget, tasks, RFA queue từ spark.db.
**Files:** `src/commands/status.ts`

## Cycle 1c: Local Daemon + SQLite — ✅ DONE
**Mô tả:** SparkDaemon class khởi động, mở spark.db WAL, health monitor 30s, concurrent R/W test pass.
**Files:** `src/daemon/index.ts`, `src/daemon/health.ts`

## Cycle 1d: WebSocket Server + Next.js Dashboard — ✅ DONE
**Mô tả:** Daemon mở WebSocket server trên port 9000. Next.js Dashboard kết nối WS, hiển thị "Connected".
**Files:** `src/daemon/index.ts`, `dashboard/app/page.tsx`, `dashboard/app/layout.tsx`

## Cycle 1e: Real-time State Sync — ✅ DONE
**Mô tả:** Khi data trong spark.db thay đổi, Dashboard cập nhật trong < 2 giây.
**Files:** `src/daemon/index.ts` (syncState), `dashboard/app/page.tsx`

## Cycle 2a: Git Branch Watcher — ✅ DONE
**Mô tả:** Daemon theo dõi Git commits trên repo, detect thay đổi, ghi event vào DB.
**Files:** `src/daemon/index.ts` (gitTimer), `src/db/schema.ts` (events table)

## Cycle 2b: Auto Phase Transition by Commit — ✅ DONE
**Mô tả:** Commit message theo convention `[phase]` tự động chuyển task phase trong DB.
**Files:** `src/daemon/index.ts` (phaseMatch logic)

## Cycle 3a: Ollama/DeepSeek Hybrid Setup — ✅ DONE
**Mô tả:** Kết nối model AI qua pluggable adapter interface + health probe.
**Files:** `src/models/adapter.ts`, `src/commands/ping-models.ts`

## Cycle 3b: AI Auto Task Decomposition — ✅ DONE
**Mô tả:** Nạp spark.yaml → AI phân tích tech_stack → sinh task list vào spark.db.
**Files:** `src/commands/plan.ts`

## Cycle 4a: RFA Trigger on Dashboard — ✅ DONE
**Mô tả:** Task chuyển WAITING_APPROVAL → Dashboard popup yêu cầu phê duyệt.
**Files:** `dashboard/app/page.tsx` (RFA popup modal)

## Cycle 4b: Approve Callback → AI Code Gen — ✅ DONE
**Mô tả:** Human bấm Approve → WS signal → Daemon unlock task → AI sinh code vào sandbox.
**Files:** `src/daemon/index.ts` (handleApproveRfa, triggerAiCodeGen), `dashboard/app/page.tsx` (approveRfa)

---

## Test Results

### Cycle 1a — PASS (2026-07-14)
- .spark/ structure ✅, spark.db 4 tables ✅, trigger ✅, budget sync ✅, idempotent ✅

### Cycle 1b — PASS (2026-07-14)
- spark status hiển thị project/budget/tasks/RFA ✅

### Cycle 1c — PASS (2026-07-14)
- 50 concurrent writes 59ms, 50 reads 2ms, 0 errors ✅
- Daemon start/stop ✅, health monitor ✅

### Cycle 1d — PASS (2026-07-14)
- layout.tsx + globals.css ✅, @types/ws devDependencies ✅
- Exponential backoff reconnect ✅, WS connection test ✅, Next.js build ✅

### Cycle 1e — PASS (2026-07-14)
- Daemon polls DB mỗi 1s, push STATE_SYNC qua WS ✅
- Change detection bằng JSON hash compare ✅, sync latency < 1s ✅

### Cycle 2a — PASS (2026-07-14)
- events table added ✅, Daemon polls git log mỗi 5s ✅
- GIT_COMMIT event ghi vào DB ✅, Dashboard render Recent Events ✅

### Cycle 2b — PASS (2026-07-14)
- Regex parse [spec] from commit message ✅
- Task phase PLAN→SPEC auto transition ✅, state_transitions logged ✅

### Cycle 3a — PASS (2026-07-14)
- IModelAdapter with ping() + generateText() ✅
- OllamaAdapter + DeepSeekAdapter ✅, fallback logic ✅

### Cycle 3b — PASS (2026-07-14)
- spark plan reads spark.yaml → AI sinh 5 tasks vào DB ✅
- dotenv loads .env.local ✅, JSON cleanup ✅

### Cycle 4a — PASS (2026-07-14)
- RFA popup with task_id + payload ✅, syncState query fixed ✅

### Cycle 4b — PASS (2026-07-14)
- Approve → rfa_queue APPROVED + resolved_at ✅
- Task WAITING_APPROVAL → RUNNING ✅, AI code → .spark/sandbox/ ✅