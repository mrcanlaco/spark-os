# BACKLOG.md â€” Danh sÃ¡ch Cycle triá»ƒn khai SPARK OS

> **HÆ°á»›ng dáº«n Agent:** TÃ¬m Cycle Ä‘áº§u tiÃªn cÃ³ status `TODO`, implement theo acceptance criteria, rá»“i chuyá»ƒn status thÃ nh `REVIEW`.

---

## Cycle 1a: CLI `spark init` â€” âœ… DONE
**MÃ´ táº£:** Cháº¡y `spark init <name>` táº¡o .spark/, spark.yaml, .env.local, .gitignore, spark.db.
**Files:** `src/commands/init.ts`, `src/db/schema.ts`, `src/db/connection.ts`, `src/templates/spark.yaml.ts`

## Cycle 1b: CLI `spark status` â€” âœ… DONE
**MÃ´ táº£:** Cháº¡y `spark status` hiá»ƒn thá»‹ project, budget, tasks, RFA queue tá»« spark.db.
**Files:** `src/commands/status.ts`

## Cycle 1c: Local Daemon + SQLite â€” âœ… DONE
**MÃ´ táº£:** SparkDaemon class khá»Ÿi Ä‘á»™ng, má»Ÿ spark.db WAL, health monitor 30s, concurrent R/W test pass.
**Files:** `src/daemon/index.ts`, `src/daemon/health.ts`

---

## Cycle 1d: WebSocket Server + Next.js Dashboard â€” âœ… DONE

**MÃ´ táº£:** Daemon má»Ÿ WebSocket server trÃªn port 9000. Next.js Dashboard káº¿t ná»‘i WS, hiá»ƒn thá»‹ "Connected".

**Dependencies cáº§n cÃ i:**
- `ws` + `@types/ws` (WebSocket server cho Daemon)
- Next.js app riÃªng trong thÆ° má»¥c `dashboard/` (`npx create-next-app@latest dashboard --typescript --tailwind --app --no-src-dir`)

**YÃªu cáº§u ká»¹ thuáº­t:**
1. Daemon: thÃªm WebSocket server vÃ o `src/daemon/index.ts` dÃ¹ng thÆ° viá»‡n `ws`.
2. WS gá»­i ping frame má»—i 5 giÃ¢y. Client nháº­n pong â†’ hiá»ƒn thá»‹ "Connected".
3. Dashboard: Next.js app táº¡i `dashboard/`, page duy nháº¥t hiá»ƒn thá»‹ connection status.
4. Dashboard káº¿t ná»‘i `ws://localhost:9000`.

**Acceptance criteria:**
- [x] Daemon start â†’ WS listen port 9000
- [x] Má»Ÿ `localhost:3000` (Next.js) â†’ tháº¥y "ðŸŸ¢ Connected to SPARK Daemon"
- [x] Kill Daemon â†’ Dashboard chuyá»ƒn "ðŸ”´ Disconnected" trong â‰¤ 10 giÃ¢y

---

## Cycle 1e: Real-time State Sync â€” âœ… DONE

**MÃ´ táº£:** Khi data trong spark.db thay Ä‘á»•i, Dashboard cáº­p nháº­t trong < 2 giÃ¢y.

**YÃªu cáº§u ká»¹ thuáº­t:**
1. Daemon poll spark.db má»—i 1 giÃ¢y, detect thay Ä‘á»•i tasks/rfa_queue â†’ push qua WS.
2. Dashboard nháº­n WS message â†’ re-render danh sÃ¡ch tasks + RFA.
3. CLI `spark status` váº«n hoáº¡t Ä‘á»™ng Ä‘á»™c láº­p (readonly).

**Acceptance criteria:**
- [x] ThÃªm task vÃ o DB báº±ng CLI/SQL â†’ Dashboard hiá»ƒn thá»‹ task má»›i trong < 2s
- [x] Thay Ä‘á»•i task status â†’ Dashboard pháº£n Ã¡nh Ä‘Ãºng

---

## Cycle 2a: Git Branch Watcher â€” âœ… DONE

**MÃ´ táº£:** Daemon theo dÃµi Git commits trÃªn repo, detect thay Ä‘á»•i file/branch.

**YÃªu cáº§u ká»¹ thuáº­t:**
1. DÃ¹ng `chokidar` watch `.git/refs/heads/` hoáº·c poll `git log` má»—i 5 giÃ¢y.
2. Khi detect commit má»›i â†’ ghi event vÃ o spark.db.
3. Push event qua WS â†’ Dashboard hiá»ƒn thá»‹.

**Acceptance criteria:**
- [x] Commit file trong repo â†’ Daemon log commit hash + message
- [x] Dashboard hiá»ƒn thá»‹ commit event

---

## Cycle 2b: Auto Phase Transition by Commit â€” âœ… DONE

**MÃ´ táº£:** Commit message theo convention â†’ tá»± Ä‘á»™ng chuyá»ƒn task phase.

**YÃªu cáº§u ká»¹ thuáº­t:**
1. Convention: `feat: [spec] setup architecture` â†’ phase = SPEC.
2. Parse commit message regex: `\[(define|plan|spec|build|verify|release)\]`.
3. Update task phase trong spark.db + ghi state_transitions.

**Acceptance criteria:**
- [x] Commit `feat: [spec] design auth` â†’ task phase tá»± nháº£y sang SPEC
- [x] Dashboard pháº£n Ã¡nh phase má»›i khÃ´ng cáº§n F5

---

## Cycle 3a: Ollama/DeepSeek Hybrid Setup â€” âœ… DONE

**MÃ´ táº£:** Káº¿t ná»‘i model AI qua adapter interface.

**YÃªu cáº§u ká»¹ thuáº­t:**
1. Implement `IModelAdapter` interface táº¡i `src/models/adapter.ts`.
2. Implement OllamaAdapter + DeepSeekAdapter.
3. Health probe: ping model trÆ°á»›c khi route task.
4. Config Ä‘á»c tá»« `spark.yaml` model_registry.

**Acceptance criteria:**
- [x] `spark ping-models` â†’ hiá»ƒn thá»‹ status HEALTHY/UNHEALTHY cho má»—i adapter
- [x] Fallback: Ollama down â†’ tá»± chuyá»ƒn sang DeepSeek

---

## Cycle 3b: AI Auto Task Decomposition â€” âœ… DONE

**MÃ´ táº£:** Náº¡p spark.yaml â†’ AI phÃ¢n tÃ­ch tech_stack â†’ sinh task list vÃ o spark.db.

**Acceptance criteria:**
- [x] `spark plan` â†’ AI Ä‘á»c spark.yaml, sinh 5-10 tasks vÃ o DB
- [x] `spark status` hiá»ƒn thá»‹ tasks vá»«a sinh

---

## Cycle 4a: RFA Trigger on Dashboard â€” âœ… DONE

**MÃ´ táº£:** Task chuyá»ƒn WAITING_APPROVAL â†’ Dashboard popup yÃªu cáº§u phÃª duyá»‡t.

**Acceptance criteria:**
- [x] Update task status = WAITING_APPROVAL â†’ Dashboard hiá»‡n popup RFA
- [x] Popup hiá»ƒn thá»‹ payload JSON tá»« rfa_queue

---

## Cycle 4b: Approve Callback → AI Code Gen — ✅ DONE

**MÃ´ táº£:** Human báº¥m Approve â†’ WS signal â†’ Daemon unlock task â†’ AI sinh code.

**Acceptance criteria:**
- [x] Báº¥m Approve trÃªn Dashboard â†’ rfa_queue.status = APPROVED, resolved_at filled
- [x] Daemon nháº­n signal â†’ task chuyá»ƒn RUNNING â†’ AI ghi file vÃ o .spark/sandbox/

---

## Test Results

_(Agent ghi káº¿t quáº£ test táº¡i Ä‘Ã¢y sau má»—i Cycle)_

### Cycle 1a â€” PASS (2026-07-14)
- .spark/ structure âœ…, spark.db 4 tables âœ…, trigger âœ…, budget sync âœ…, idempotent âœ…

### Cycle 1b â€” PASS (2026-07-14)
- spark status hiá»ƒn thá»‹ project/budget/tasks/RFA âœ…

### Cycle 1c â€” PASS (2026-07-14)
- 50 concurrent writes 59ms, 50 reads 2ms, 0 errors âœ…
- Daemon start/stop âœ…, health monitor âœ…

### Cycle 1d â€” PASS (2026-07-14)
- WS server start/stop âœ…
- Next.js dashboard connection âœ…

### Cycle 1e â€” PASS (2026-07-14)
- Real-time state sync via WS âœ…
- UI updates tasks and RFA automatically âœ…

### Cycle 2a â€” PASS (2026-07-14)
- Git commit polling via child_process âœ…
- Insert into events table âœ…
- Sync to Dashboard via WS âœ…

### Cycle 2b â€” PASS (2026-07-14)
- Auto phase transition on commit âœ…
- DB state updated automatically âœ…

### Cycle 3a â€” PASS (2026-07-14)
- IModelAdapter interface implemented âœ…
- OllamaAdapter ping working âœ…
- DeepSeekAdapter fallback implemented âœ…
- spark ping-models command registered âœ…

### Cycle 3b â€” PASS (2026-07-14)
- spark plan command added âœ…
- AI JSON response parsed safely âœ…
- Tasks inserted into database successfully âœ…

### Cycle 4a â€” PASS (2026-07-14)
- Popup RFA added to Dashboard âœ…
- RFA payloads displayed accurately âœ…

### Cycle 4b â€” PASS (2026-07-14)
- Dashboard Approve btn sends APPROVE_RFA WS event âœ…
- Daemon unlocks task -> RUNNING âœ…
- AI code gen mock writes to .spark/sandbox/ âœ…

### Cycle 4b — PASS (2026-07-14)
- Dashboard Approve button sends APPROVE_RFA via WS ✅
- Daemon receives, updates rfa_queue.status=APPROVED + resolved_at ✅
- Task status WAITING_APPROVAL → RUNNING ✅
- AI writes code file to .spark/sandbox/ ✅
- wsRef pattern for stable WS reference ✅
- Next.js build pass ✅
