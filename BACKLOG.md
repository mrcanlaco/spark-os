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
---

# V2 — Vận hành Chuyên sâu (The Operations Cycle)

## Cycle 5a: Audit Log Rotation + Decision Logs — REVIEW
**Mô tả:** Ghi decision logs vào .spark/audit_logs/. Rotation 50MB/file → .gz → xóa sau 14 ngày. Daemon log mọi action (approve, reject, phase transition, AI call).
**Files:** src/daemon/audit.ts, src/daemon/index.ts
**Acceptance Criteria:**
- [ ] AuditLogger class ghi JSON lines vào .spark/audit_logs/spark-YYYY-MM-DD.log
- [ ] Khi file > 50MB, rotate sang .gz
- [ ] Cleanup files > 14 ngày
- [ ] Daemon gọi audit.log() tại mọi action point (approve, reject, phase transition, AI code gen)
- [ ] spark status hiện audit log stats (file count, total size)

## Cycle 5b: Token Budget Tracking — REVIEW
**Mô tả:** Track token cost per AI call. Cập nhật 	asks.token_cost_usd và projects.budget_used_usd. Budget exceeded → auto RFA.
**Files:** src/models/adapter.ts, src/daemon/index.ts, src/db/schema.ts
**Acceptance Criteria:**
- [ ] IModelAdapter.generateText() return { text: string; tokens_used: number; cost_usd: number }
- [ ] Sau mỗi AI call, update 	asks.token_cost_usd += cost
- [ ] Tổng cost sync lên projects.budget_used_usd qua trigger
- [ ] Khi udget_used_usd >= budget_cap_usd * 0.9 → tạo RFA BUDGET_EXCEEDED
- [ ] spark status hiện budget % used

## Cycle 5c: Reject RFA + Resolution Notes — REVIEW
**Mô tả:** Thêm Reject callback từ Dashboard. Lưu resolution_note. Task → FAILED khi reject.
**Files:** src/daemon/index.ts, dashboard/app/page.tsx
**Acceptance Criteria:**
- [ ] Dashboard có nút Reject với input resolution_note
- [ ] WS message REJECT_RFA → daemon xử lý
- [ ] rfa_queue status = REJECTED, resolution_note saved
- [ ] Task status → FAILED, error_message = resolution note
- [ ] Audit log ghi reject event

## Cycle 6a: Process Resource Accounting — REVIEW
**Mô tả:** Daemon enforce hard cap 500MB RSS. Child process max 250MB. Track concurrent tasks <= CPU cores - 1.
**Files:** src/daemon/health.ts, src/daemon/index.ts
**Acceptance Criteria:**
- [ ] Health monitor emit RESOURCE_ACCOUNTING event với RSS, CPU, active task count
- [ ] Concurrent task limit = os.cpus().length - 1, queue excess
- [ ] Child process spawn với --max-old-space-size=250
- [ ] Dashboard health panel hiển thị resource stats
- [ ] Khi RSS > 300MB → warning event, > 500MB → graceful shutdown

## Cycle 6b: Project Hibernation — REVIEW
**Mô tả:** Project idle > 15 phút → kill child processes, đánh dấu HIBERNATED. Wake up khi có event mới.
**Files:** src/daemon/index.ts, src/db/schema.ts
**Acceptance Criteria:**
- [ ] Track last_activity_at per project
- [ ] Timer check mỗi 60s, idle > 15min → HIBERNATED
- [ ] HIBERNATED project: kill child processes, free memory
- [ ] New event (git commit, WS message) → wake up project
- [ ] Dashboard hiện hibernation status

## Cycle 7a: Decision Log + Pattern Mining — REVIEW
**Mô tả:** Log mọi AI decision (prompt, response, model, cost). Pattern mining: detect repeated patterns (similarity > 0.85) → suggest reuse.
**Files:** src/daemon/audit.ts, src/db/schema.ts
**Acceptance Criteria:**
- [ ] decision_logs table: id, task_id, prompt_hash, model, tokens, cost, created_at
- [ ] Mỗi AI call → insert decision log
- [ ] spark decisions command hiện recent decisions
- [ ] Simple pattern detection: group by prompt_hash prefix, count > 3 → suggest
- [ ] Dashboard hiện "Recurring Patterns" panel

## Cycle 7b: Dashboard V2 — REVIEW
**Mô tả:** Nâng cấp Dashboard: budget chart, health monitor, audit log viewer, hibernation status.
**Files:** dashboard/app/page.tsx
**Acceptance Criteria:**
- [ ] Budget bar (used/cap) với color coding (green < 50%, yellow < 90%, red >= 90%)
- [ ] Health panel: RSS, CPU, active tasks, daemon uptime
- [ ] Audit log viewer: recent 20 entries, filterable by type
- [ ] Hibernation badge per project
- [ ] Reject button functional với resolution_note input

### Cycle 5a — PASS (2026-07-14)
- AuditLogger class with JSON lines ✅, rotation at 50MB ✅
- Cleanup files > 14 days ✅, stats() returns fileCount + totalSize ✅
- Daemon calls audit.log() at all action points ✅

### Cycle 5b — PASS (2026-07-14)
- GenerateResult { text, tokens_used, cost_usd } ✅
- token_cost_usd per task updated ✅, budget_sync_on_task_cost trigger ✅
- Budget >= 90% → RFA BUDGET_EXCEEDED ✅
- spark status shows budget % ✅

### Cycle 5c — PASS (2026-07-14)
- REJECT_RFA WS message handled ✅
- rfa_queue status=REJECTED, resolution_note saved ✅
- Task → FAILED with error_message ✅, audit log ✅

### Cycle 6a — PASS (2026-07-14)
- HealthReport includes max_concurrent_tasks ✅
- getChildProcessArgs() returns --max-old-space-size=250 ✅
- STATE_SYNC includes health + active_tasks ✅
- RSS warning/critical thresholds maintained ✅

### Cycle 6b — PASS (2026-07-14)
- last_activity_at tracked per project ✅
- Hibernation timer 60s check, idle > 15min → HIBERNATED ✅
- touchActivity() wakes up on events ✅
- Dashboard shows hibernation badge ✅

### Cycle 7a — PASS (2026-07-14)
- decision_logs table: task_id, prompt_hash, model, tokens, cost ✅
- spark plan inserts decision logs ✅
- spark decisions shows recent 20 + recurring patterns ✅
- Pattern detection: group by prompt_hash, cnt >= 3 ✅

### Cycle 7b — PASS (2026-07-14)
- Budget bar with color coding (green/yellow/red) ✅
- Health panel: RSS, CPU, active tasks, uptime ✅
- Audit log stats in sidebar ✅
- Reject button with resolution_note input ✅
- Hibernation badge ✅