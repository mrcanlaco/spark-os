# BẢN ĐẶC TẢ KIẾN TRÚC CHIẾN LƯỢC: SPARK OS (V5 - BẢN THỰC THI V1)
**Hệ điều hành Điều phối và Quản trị Hạm đội AI Agentic (AI Dev OS)**

> **Mục tiêu V5:** Loại bỏ sự mơ hồ trong vận hành. Giải quyết triệt để các bài toán phân bổ tài nguyên bộ nhớ (Memory Accounting), quản lý bí mật (Secret Management), chính sách xoay vòng Log (Log Rotation), và điều tuyến API (API Routing). Đặt nền móng thực tế để bắt đầu implement Cycle 1.

---

## I. TẦM NHÌN & PHƯƠNG PHÁP LUẬN (THE VISION)

### 1. Triết lý Cốt lõi
SPARK OS không phải là một công cụ sinh code (code generator) đơn thuần, mà là một **Hệ điều hành điều phối (Orchestration OS)**. Hệ thống chuyển dịch vai trò của lập trình viên từ "Người gõ prompt" (Micro-manager) sang "Cơ trưởng điều phối" (Director) quản lý hạm đội AI Agent bằng phương thức quản trị theo ngoại lệ (Exception Management).

### 2. Sáu Pha Thiết quân luật & Chỉ số Cam kết Kỹ thuật (Phase-Gating & Guardrails)
Mọi tác vụ của AI trong SPARK OS phải đi qua một chu trình 6 pha nghiêm ngặt nhằm hiện thực hóa các cam kết đo lường chất lượng phần mềm công nghiệp:

* **Giảm Defect Escape Rate xuống dưới 5%** thông qua hệ thống cổng kiểm chứng tự động (Automated Verification Gate).
* **Cam kết 100% mã nguồn đi qua Test tự động trước khi merge** (Test Coverage Gate).
* **Triệt tiêu hoàn toàn thao tác triển khai thủ công (Zero Manual Deployment)** — mọi bản phát hành được phân phối đồng bộ qua cấu hình CI Pipeline.

**Chu trình 6 pha vận hành:**

1. **DEFINE (Định nghĩa):** Làm rõ ý đồ người dùng thành Project DNA.
2. **PLAN (Lập kế hoạch):** Bóc tách mục tiêu thành các Task nhỏ trong State.
3. **SPEC (Đặc tả):** Thiết kế chi tiết kiến trúc của Task, Human phê duyệt trước khi code.
4. **BUILD (Xây dựng):** Thực thi viết mã nguồn thông qua kỷ luật TDD (Test-Driven Development).
5. **VERIFY (Kiểm chứng):** Tách biệt thực thể Builder và Verifier để đối soát độc lập, chạy test tự động.
6. **RELEASE (Phát hành):** Tự động đóng gói, cấu hình môi trường và deploy lên Cloud.

---

## II. KHO TÀNG CẢM HỨNG & SỰ ĐỒNG HÓA KỸ THUẬT (TECHNOLOGY SYNTHESIS)

SPARK OS là sự kết tinh và nâng cấp từ những dự án mã nguồn mở xuất sắc nhất thế giới:

* **NousResearch/hermes-agent:** Tận dụng cơ chế Agentic Loop (`Thought → Action → Observation`) và khả năng gọi hàm (Function Calling) bằng JSON. SPARK nâng cấp đóng gói Hermes làm Engine cốt lõi cho các Skill tự trị, neo giữ trạng thái bằng cơ sở dữ liệu local để chống Goal Drift.
* **mattpocock/skills:** Triết lý định nghĩa Skill bằng TypeScript + Zod làm Single Source of Truth. SPARK tự động compile các TS Skills thành JSON Tool Schema cho Hermes, tăng tối đa trải nghiệm lập trình tự động (Type-Safe & Autocomplete).
* **CrewAI:** Mô hình phân vai chuyên biệt (Architect, Coder, QA) và cơ chế phân quyền Hierarchical. SPARK tạo ra "Manager Hermes Agent" đóng vai trò Tổng quản tiếp nhận lệnh từ con người và tự điều phối Sub-Agents bên dưới.
* **AutoGPT:** Khả năng tự sinh mục tiêu (Goal-Driven) và vòng lặp tự sửa lỗi (Self-Healing). SPARK khắc phục lỗi "đốt tiền API" bằng cơ chế giới hạn cứng (Token Budget Guardrails) và cơ chế báo cáo leo thang lên con người (HITL Escalation).

---

## III. KIẾN TRÚC KỸ THUẬT CHI TIẾT (SYSTEM ARCHITECTURE)

```text
                     USER (Director)
                          │
                          ▼ [Approve / Reject / Input]
                 ┌──────────────────┐
                 │  SPARK Web GUI   │ (Command Center Dashboard)
                 └────────┬─────────┘
                          ▲ Websocket (State DB, RFA Queue, Burn Rate)
                          ▼
                 ┌──────────────────┐
                 │  Local Daemon    │ (Node.js Core Engine - Project Isolation)
                 └────────┬─────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
 ┌──────────────┐                  ┌──────────────┐
 │  State Sync  │ (Git Hooks)      │ Skill Router │ (Extensible Agent & Models)
 └───────┬──────┘                  └───────┬──────┘
         │                                 │ Thought -> Action -> Observation
         ▼                                 ▼
 ┌──────────────┐                  ┌──────────────┐
 │ Project DNA  │ (spark.yaml)     │ LLM Engines  │ (Pluggable Model Adapters)
 └──────────────┘                  └──────────────┘
```

### 1. Cấu trúc Lưu trữ hạ tầng `.spark/`

```text
.project-root/
  ├── spark.yaml               # [Tĩnh] Cấu hình cố định. Đẩy lên Git.
  ├── .env.local               # [BẢO MẬT] Chứa API Keys, Deploy Tokens (Bắt buộc Gitignore)
  └── .spark/                  # [Động] Cục bộ của SPARK OS (Bắt buộc Gitignore)
        ├── spark.db           # DB SQLite (WAL Mode)
        ├── spark.db-wal
        ├── /sandbox/          # Không gian cô lập thực thi L3
        └── /audit_logs/       # Nhật ký thực thi (Log Rotation)
```

### 2. Định cấu hình Project DNA (`spark.yaml`)

**Logic Phối hợp giữa `spark.yaml` và `spark.db`:**
* **Chỉ nạp khi khởi động:** `spark.yaml` được Daemon đọc một lần khi khởi động hoặc khi nhận lệnh `spark reload`.
* **Không giám sát thời gian thực:** File watcher KHÔNG theo dõi realtime tệp này.
* **Bàn giao quyền lực:** `budget_cap_usd` được sao chép vào bảng `projects` của `spark.db` lúc `spark init`. Sau đó, `spark.db` là Source of Truth.

```yaml
project:
  name: "TutorX"
  tech_stack: ["NextJS 15", "TailwindCSS", "PostgreSQL"]

deployment:
  provider: "vercel"
  connection_secret_env: "VERCEL_DEPLOY_TOKEN"
  environments:
    staging:
      branch: "spark/agent/*"
      strategy: "sdk_direct"
    production:
      branch: "main"
      strategy: "ci_yaml"

budget:
  budget_cap_usd: 15.0
  shared_overflow_pool: 10.0

model_registry:
  sync_strategy: "auto_update"
  adapters:
    - id: "ollama-local"
      provider: "ollama"
      model_name: "hermes-3-llama-3-8b"
      base_url: "http://localhost:11434"
    - id: "deepseek-cloud"
      provider: "deepseek"
      model_name: "deepseek-coder"
```

### 3. Schema Cơ sở dữ liệu Nhúng (`spark.db` - SQLite WAL Mode)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  budget_cap_usd REAL DEFAULT 15.0,
  budget_used_usd REAL DEFAULT 0.0,
  disk_quota_mb INTEGER DEFAULT 500,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK(status IN ('ACTIVE', 'PAUSED', 'COMPLETED'))
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  parent_task_id TEXT REFERENCES tasks(id),
  title TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'DEFINE',
  status TEXT NOT NULL DEFAULT 'PENDING',
  priority INTEGER DEFAULT 1,
  assigned_model TEXT,
  agent_branch TEXT,
  token_cost_usd REAL DEFAULT 0.0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK(status IN ('PENDING','RUNNING','WAITING_APPROVAL','COMPLETED','FAILED','DEAD')),
  CHECK(phase IN ('DEFINE','PLAN','SPEC','BUILD','VERIFY','RELEASE'))
);

CREATE TRIGGER tasks_updated_at AFTER UPDATE ON tasks
FOR EACH ROW WHEN OLD.updated_at = NEW.updated_at
BEGIN UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TABLE state_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT REFERENCES tasks(id),
  from_phase TEXT NOT NULL,
  to_phase TEXT NOT NULL,
  git_snapshot TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rfa_queue (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  resolution_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  CHECK(type IN ('SPEC_APPROVAL','BREAKAGE','BUDGET_EXCEEDED','CONFLICT','DEAD_LETTER','STAGING_RELEASE_APPROVAL','PROD_RELEASE_APPROVAL')),
  CHECK(status IN ('PENDING','APPROVED','REJECTED','EXPIRED'))
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Kiến trúc Bộ nhớ V1 (Memory Architecture)

* **HOT Memory (< 100MB):** SQLite FTS5 — full-text search ngữ cảnh tác vụ gần đây.
* **WARM Memory (< 500MB):** `sqlite-vec` — embedding vectors cho semantic search.
* **COLD Memory (< 200MB):** JSONL nén — archived history > 30 ngày.
* **EVICT Policy:** Tự động xóa records > 90 ngày idle VÀ `access_count < 3`.

### 5. Mô hình An toàn Bảo mật 3 Tầng (3-Layer Sandbox)

| Tầng | Cơ chế | Khi nào |
|------|--------|---------|
| L1 | File permission scoping (.spark/ + project dir) | Mọi task |
| L2 | Deno/Node flags (--allow-read, --allow-write, deny net) | Skill execution |
| L3 | Docker (--network=none --read-only, volume RO) | Shell/script tasks |

> **Quy tắc Airlock:** Mọi file AI sinh ra phải qua pha VERIFY trước khi tạo PR.

### 6. Quản lý Xung đột Human + AI

* **Branch Isolation:** AI chỉ làm trên `spark/agent/{task_id}`, không commit lên `main`/`dev`.
* **Merge Flow:** AI xong → PR → Human review/merge.
* **Conflict Detection:** Git Watcher phát hiện conflict → pause Agent → RFA.
* **File-Level Lock:** Daemon check `git status --porcelain` + `git fetch origin` + `git rev-list` trước khi assign task.
* **Metadata Sync:** `spark.db` chỉ chứa metadata, không lưu code content.

### 7. Thuật toán Điều tuyến (Skill Router - Heuristic-First)

```text
[Task mới] → security/auth label? → CÓ → Tier 3 (Claude Sonnet)
                    │ KHÔNG
                    ▼
          context > 500 lines? → CÓ → Tier 3
                    │ KHÔNG
                    ▼
          rename/format/docs? → CÓ → Tier 1 (Local Ollama)
                    │ KHÔNG
                    ▼
                Tier 2 (DeepSeek)
```

**Fallback:** Tier 2 fail → retry Tier 3. Hết budget → RFA.

---

## IV. LỘ TRÌNH THỰC THI (STATE-DRIVEN CYCLES)

### CYCLE 1: Khởi tạo Khung xương (The Bone Cycle)
* **1a:** `spark init <name>` → tạo .spark/, spark.yaml, spark.db
* **1b:** `spark status` → hiển thị project/tasks/RFA từ DB
* **1c:** Local Daemon + SQLite WAL concurrent R/W
* **1d:** WebSocket server + Next.js Dashboard skeleton
* **1e:** Real-time state sync (DB → Dashboard < 2s)

### CYCLE 2: Mạch đập thực tế (The Pulse Cycle)
* **2a:** Git Branch Watcher — detect commits, ghi events
* **2b:** Auto phase transition by commit message convention `[phase]`

### CYCLE 3: Tích hợp Bộ não (The Brain Cycle)
* **3a:** Ollama/DeepSeek hybrid setup — pluggable IModelAdapter
* **3b:** AI auto task decomposition từ spark.yaml

### CYCLE 4: Chốt chặn Sinh tử (The Autonomy Cycle)
* **4a:** RFA trigger — WAITING_APPROVAL popup trên Dashboard
* **4b:** Approve callback → AI sinh code vào .spark/sandbox/

---

## V. CHI TIẾT VẬN HÀNH THỰC TẾ (OPERATIONAL DETAILS)

### 1. Chất lượng Phần mềm (Quality Gate)
* Conformity & Readability: đo bằng ESLint/Prettier/SonarLint (deterministic, không AI chấm).
* Test Coverage Circular Risk: V1 dùng Human Spot-check, V2 thêm Mutation Testing (Stryker).

### 2. Quản trị Đa Dự án (Resource Accounting)
* Orchestrator Daemon: hard cap **500MB RAM**.
* Child Processes: `max_old_space_size=250` (250MB/process).
* Concurrency: tối đa `CPU cores - 1` task nặng đồng thời.
* Hibernation: project idle 15 phút → kill child process, wake up khi có event mới.

### 3. Tận dụng Đa dạng AI (Rate Limit & Health Probe)
* Pre-flight Health Probe: ping `/v1/models` trước khi route, timeout 2s → UNHEALTHY → fallback.
* Token Bucket Rate Limiter: Anthropic = 40 req/min, nhỏ giọt request từ 20 dự án.
* Capability Matrix: V1 tải `matrix.json` từ community repo, V2 auto-benchmark.

### 4. Tích hợp Công nghệ (Skill Sandbox & Rollback)
* `spark skill-test <name>` — chạy skill trong thư mục rỗng trước khi đăng ký.
* `spark downgrade @sparkos-skills/xyz@1.0.0` — rollback skill version.

### 5. Cộng đồng Đóng góp
* V1: NPM Registry `@sparkos-skills/` namespace. MIT License.
* V2: Security Reviewed Badge, GitHub RFC process.

### 6. Deploy & Ship
* Secret Management: `.env.local` + gitignore. Không lưu secret trong DB.
* CI/CD Hybrid: Staging = SDK direct (Vercel/AWS), Production = sinh `.github/workflows/deploy.yml`.
* Rollback Trigger: Webhook từ Vercel/Sentry, error rate > 5% → RFA `PROD_ROLLBACK_ALERT`.

### 7. AI Tự tiến hóa (Learning Roadmap)
* V1: Log everything (Decision Logs).
* V2: Preference & Pattern Mining — similarity threshold > 0.85. Nút Unlearn trên Dashboard.
* V3: Auto-suggest refactoring mỗi 15 ngày.

### 8. Bảo mật Sandbox (Log Rotation & Alerting)
* Audit Log Rotation: 50MB/file → .gz → xóa sau 14 ngày.
* Alerting V1: Sandbox chặn > 5 lệnh/giờ → RFA cảnh báo đỏ "Agent nhiễm độc".
* AST Scan: V2 thay regex bằng AST parser chống obfuscation.

### 9. Giám sát Daemon
* Self-Monitoring: RSS/CPU/Disk mỗi 30s (Daemon tự kiểm tra, Dashboard chỉ hiển thị).
* WebSocket Keepalive: native ping/pong, mất pong 10s → "Disconnected".
* Memory: 300MB warning + GC, 500MB kill + force restart.

### 10. Yêu cầu Hệ thống
* **Min:** 16GB RAM, SSD, Node.js 20+, Git 2.40+.
* **Recommend (Local AI):** NVIDIA GPU 8GB VRAM hoặc Apple Silicon 16GB+.
* **Fallback:** Không GPU → auto-route 100% sang API cloud.
* **Disk:** ~2GB Ollama Model + 500MB growth cap cho spark.db.

### 11. Offline Mode
* Mất mạng → queue tasks, auto-resume khi có mạng.
* Local Ollama tier hoạt động offline.
* Dashboard kết nối spark.db qua localhost bình thường.

---

*Bản PRD V5 đầy đủ — nền tảng kỹ thuật cho SPARK OS V1.*