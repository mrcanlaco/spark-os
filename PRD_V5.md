Dựa trên bản đánh giá cực kỳ sắc bén và thực tế từ Review Round 4, tôi đã tiến hành "đóng đinh" các chi tiết vận hành (Operational Details) và phân định rõ ràng ranh giới giữa những tính năng có thể triển khai ngay trong V1 và những lộ trình dài hạn (V2+).

Sự tự mãn (over-confidence) đã được loại bỏ. Bản **PRD V5** này là một bản vẽ thi công thực dụng, giải quyết triệt để 5 câu hỏi cốt tử được nêu ra ở cuối Round 4 và vá lại các kẽ hở kỹ thuật.

Dưới đây là tài liệu **PRD V5** hoàn chỉnh, đóng gói trong tệp `.md` để anh tiến hành Code ngay lập tức.

```markdown
# BẢN ĐẶC TẢ KIẾN TRÚC CHIẾN LƯỢC: SPARK OS (V5 - BẢN THỰC THI V1)
**Hệ điều hành Điều phối và Quản trị Hạm đội AI Agentic (AI Dev OS)**

> **Mục tiêu V5:** Loại bỏ sự mơ hồ trong vận hành. Giải quyết triệt để các bài toán phân bổ tài nguyên bộ nhớ (Memory Accounting), quản lý bí mật (Secret Management), chính sách xoay vòng Log (Log Rotation), và điều tuyến API (API Routing). Đặt nền móng thực tế để bắt đầu implement Cycle 1.

---

## I. TẦM NHÌN & PHƯƠNG PHÁP LUẬN (THE VISION) [OK — GIỮ NGUYÊN]

## II. KHO TÀNG CẢM HỨNG & SỰ ĐỒNG HÓA KỸ THUẬT (TECHNOLOGY SYNTHESIS) [OK — GIỮ NGUYÊN]

---

## III. KIẾN TRÚC KỸ THUẬT CHI TIẾT (SYSTEM ARCHITECTURE)

### 1. Cấu trúc Lưu trữ hạ tầng `.spark/` `[UPDATED per V5 - Secret Management]`

```text
.project-root/
  ├── spark.yaml               # [Tĩnh] Cấu hình cố định. Đẩy lên Git.
  ├── .env.local               # [BẢO MẬT] Chứa API Keys, Deploy Tokens (Bắt buộc Gitignore)
  └── .spark/                  # [Động] Cục bộ của SPARK OS (Bắt buộc Gitignore)
        ├── spark.db           # DB SQLite (WAL Mode)
        ├── spark.db-wal       
        ├── /sandbox/          # Không gian thực thi L3
        └── /audit_logs/       # Nhật ký thực thi (Log Rotation áp dụng tại đây)

```

### 2. Định cấu hình Project DNA (`spark.yaml`) `[UPDATED per V5 - Capability Matrix]`

```yaml
project:
  name: "TutorX"
  tech_stack: ["NextJS 15", "TailwindCSS", "PostgreSQL"]

deployment:
  provider: "vercel" 
  connection_secret_env: "VERCEL_DEPLOY_TOKEN" # Đọc từ .env.local, tuyệt đối KHÔNG lưu trong DB
  environments:
    staging:
      branch: "spark/agent/*"
      strategy: "sdk_direct" # Gọi trực tiếp qua Vercel API
    production:
      branch: "main"
      strategy: "ci_yaml" # Sinh file .github/workflows/deploy.yml

model_registry:
  sync_strategy: "auto_update" # Tự động cập nhật ma trận điểm năng lực từ SPARK Community
  adapters:
    - id: "claude-sonnet"
      provider: "anthropic"
      model_name: "claude-3-5-sonnet-latest"
      # Ghi đè (Override) điểm năng lực tự động
      capabilities_override:
        reasoning: 0.98
        code_generation: 0.95

```

### 3. Schema Cơ sở dữ liệu Nhúng (`spark.db`)

#### Bảng `projects` `[UPDATED per V5 - Disk Quota]`

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  budget_cap_usd REAL DEFAULT 15.0,
  budget_used_usd REAL DEFAULT 0.0,
  disk_quota_mb INTEGER DEFAULT 500,  -- [NEW] Quota dung lượng ổ cứng cho từng dự án
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

```

*(Các bảng `tasks`, `state_transitions`, `rfa_queue` giữ nguyên cấu trúc chuẩn hóa từ V4).*

---

## IV. LỘ TRÌNH THỰC THI THEO VÒNG LẶP TRẠNG THÁI (STATE-DRIVEN CYCLES) [OK — GIỮ NGUYÊN]

---

## V. CHI TIẾT VẬN HÀNH THỰC TẾ (OPERATIONAL DETAILS)

### B1. CHẤT LƯỢNG PHẦN MỀM: DETERMINISTIC QUALITY GATE `[UPDATED per R4-B1]`

Để tránh rủi ro AI tự chấm điểm thiên vị (Circular validation risk):

* **Điểm Conformity ($C_s$) & Readability ($R_a$):** KHÔNG dùng AI chấm. Bắt buộc dùng công cụ phân tích tĩnh (Deterministic Tools) như **ESLint rules**, **Prettier check** và **SonarLint API**.
* **Test Coverage Circular Risk:** Yêu cầu áp dụng **Mutation Testing** (vd: Stryker) cho V2 để chống lại các file test "chỉ viết cho xanh báo cáo mà không check logic". Ở V1, áp dụng cơ chế **Human Spot-check**: AI pass 100% test nhưng Agent vẫn tạo RFA yêu cầu con người review ngẫu nhiên 1 file cốt lõi.

### B2. QUẢN TRỊ ĐA DỰ ÁN: BÀI TOÁN BỘ NHỚ (RESOURCE ACCOUNTING) `[UPDATED per R4-B2]`

Giải quyết triệt để câu hỏi: *Memory Cap 500MB áp dụng thế nào cho 20 tiến trình?*

* **Orchestrator Daemon (Tiến trình chính):** Cấu hình giới hạn cứng (Hard Cap) = **500MB RAM**. Chỉ làm nhiệm vụ điều phối WebSocket, Git Watch, và SQLite I/O.
* **Active Child Processes (Tiến trình Dự án):**
* Giới hạn `max_old_space_size=250` (250MB RAM / tiến trình con).
* **Giới hạn luồng chạy (Concurrency):** Chạy tối đa số tiến trình = `(CPU Cores - 1)`.


* **Hibernation (Ngủ đông):** Dự án không có active task trong 15 phút sẽ bị Daemon tự động "Kill" tiến trình con để thu hồi RAM. Khi có event mới (commit, webhook), tiến trình sẽ được "Wake up" và phục hồi trạng thái từ DB.
* **Priority Dashboard:** Giao diện GUI bổ sung tính năng Kéo-Thả (Drag & Drop) danh sách Task. Khi kéo, hệ thống tự động update trường `priority` trong SQLite, Scheduler sẽ tự động điều phối lại CPU.

### B3. TẬN DỤNG ĐA DẠNG AI: RATE LIMIT & HEALTH PROBE `[UPDATED per R4-B3]`

* **Pre-flight Health Probe:** Trước khi `Skill Router` phân bổ task, Daemon gửi một request ping/token-check (chi phí 0đ) tới Adapter tương ứng (vd: gọi `/v1/models` của OpenAI/Anthropic). Nếu ping > 2s hoặc lỗi 401 ➔ Đánh dấu Adapter là `UNHEALTHY` và chuyển sang Fallback model.
* **Token Bucket Rate Limiter:** Khai báo giới hạn cấu hình trong Code (vd: Anthropic = 40 req/min). Daemon áp dụng thuật toán Token Bucket Queue để "nhỏ giọt" request của 20 dự án, đảm bảo không bao giờ bị dính lỗi HTTP 429 (Too Many Requests).
* **Capability Matrix Source:** Ở V1, tải định kỳ tệp `matrix.json` từ GitHub Repo trung tâm của cộng đồng SPARK OS. V2 sẽ tự động Benchmark bằng code test.

### B4. TÍCH HỢP CÔNG NGHỆ: SKILL SANDBOX & ROLLBACK `[UPDATED per R4-B4]`

* **Skill Testing:** CLI bổ sung lệnh `spark skill-test <skill-name>`. Lệnh này chạy Skill trong một thư mục rỗng hoàn toàn, đẩy fake input vào để đảm bảo Skill không gây crash Daemon trước khi đăng ký chính thức.
* **Skill Rollback:** CLI hỗ trợ `spark downgrade @sparkos-skills/nextjs@1.0.0` để phục hồi phiên bản Skill an toàn khi bản cập nhật mới bị lỗi.

### B5. CỘNG ĐỒNG ĐÓNG GÓP: LỘ TRÌNH V1 VS V2 `[UPDATED per R4-B5]`

* **Hạ tầng Registry (V1):** Không tự xây chợ ứng dụng. Sử dụng trực tiếp hạ tầng của **NPM Registry** dưới dạng Organization Namespace `npm install @sparkos-skills/xyz`.
* **Bảo mật & Governance (V2):** Xác lập quy trình "Security Reviewed Badge". Community skill có thể được cài đặt, nhưng Dashboard sẽ hiển thị cảnh báo ĐỎ nếu skill đó chưa được Core Team của SPARK OS review mã độc.

### B6. DEPLOY & SHIP: BÍ MẬT & CHIẾN LƯỢC PIPELINE `[UPDATED per R4-B6]`

* **Quản lý Bí mật (Secret Management):** Mọi token (`VERCEL_TOKEN`, `AWS_ACCESS_KEY`) PHẢI được lưu trong tệp `.env.local`. Daemon đọc trực tiếp vào `process.env`. Tệp này bị `.gitignore` chặn hoàn toàn. **Tuyệt đối không có trường nào trong `spark.db` chứa Secret.**
* **CI/CD Integration (Hybrid):**
* *Staging:* Adapter sử dụng trực tiếp Vercel/AWS SDK để đẩy mã nguồn lên môi trường test để lấy Preview URL thật nhanh.
* *Production:* Adapter KHÔNG dùng SDK. Thay vào đó, nó sinh ra file `.github/workflows/deploy.yml` để nhường quyền kiểm soát Production cho hạ tầng CI/CD doanh nghiệp.


* **Rollback Trigger:** SPARK OS tích hợp Webhook API để nhận tín hiệu từ Vercel Analytics/Sentry. Nếu Error rate > 5%, webhook kích hoạt RFA loại `PROD_ROLLBACK_ALERT` lên Dashboard.

### B7. AI TỰ TIẾN HÓA: ĐỊNH LƯỢNG NGƯỠNG SO SÁNH (THRESHOLDS) `[UPDATED per R4-B7]`

* Đưa vào giới hạn thực thi V1: Chỉ thu thập `Decision Logs`. Tính năng Pattern Mining dời sang V2.
* **Similarity Threshold (Dự kiến V2):** Định nghĩa cụ thể khoảng cách Cosine Similarity:
* `> 0.85`: Coi là ngữ cảnh tương tự (Áp dụng lịch sử Reject vào Task mới).
* `< 0.85`: Bỏ qua để tránh over-correct.


* **Guardrails (Nút Unlearn):** Trên Dashboard, lịch sử học tập của AI hiển thị dưới dạng danh sách Rules. Con người có quyền bấm nút `[🗑️ Unlearn]` để bắt AI quên đi một luật lệ học sai.

### B8. XUNG ĐỘT CON NGƯỜI & AI: EDGE CASE ĐỒNG BỘ `[UPDATED per R4-B8]`

* **Khắc phục lỗi "Local Ahead":** Trước khi kiểm tra `git status --porcelain`, Local Daemon tự động thực thi lệnh `git fetch origin` và so sánh khoảng cách giữa nhánh local và remote tracking branch (`git rev-list HEAD...origin/main --count`). Đảm bảo Agent không giẫm chân lên code con người đã commit nhưng quên push.

### B9. BẢO MẬT SANDBOX: LOG ROTATION & ALERTING `[UPDATED per R4-B9]`

* **Chính sách Xoay vòng Log (Audit Log Rotation):**
* Mỗi tệp log trong `/audit_logs/` được giới hạn tối đa **50MB**.
* Tự động nén thành file `.gz` khi đạt giới hạn.
* Thời gian lưu trữ (Retention Policy): Xóa hoàn toàn sau **14 ngày**.


* **Alerting & AST Scan:**
* Trong V1: Cài đặt giới hạn Rate Limit. Nếu Sandbox chặn > 5 câu lệnh/giờ từ Agent, kích hoạt RFA Cảnh báo đỏ báo hiệu dấu hiệu "Agent bị nhiễm độc".
* Trong V2: Sẽ tích hợp Abstract Syntax Tree (AST) Scanner thay cho Regex thông thường để chống kỹ thuật giấu code (Obfuscation).



---

*Bản PRD V5 chính thức khép lại khâu thiết kế kiến trúc. Giao toàn bộ tài liệu này cho đội ngũ kỹ sư để bắt đầu Code Cycle 1a: Khởi tạo CLI `spark init`.*

```

```