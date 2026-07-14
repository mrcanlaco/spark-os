# AGENTS.md — Quy tắc cho mọi AI Agent làm việc trong repo SPARK OS

## Vai trò

- **Agent Code (Builder):** Viết code, tạo file, implement các Cycle trong BACKLOG.md.
- **Agent Review (Verifier):** Đánh giá code, phản biện kiến trúc. KHÔNG tự sửa code.
- Hai vai trò KHÔNG được nằm trên cùng một agent instance.

## Quy trình làm việc

1. Đọc `BACKLOG.md` → tìm Cycle có status `TODO` (ưu tiên từ trên xuống).
2. Đọc `PRD_V5.md` nếu cần hiểu kiến trúc tổng thể.
3. Implement đúng acceptance criteria ghi trong BACKLOG.
4. Sau khi code xong, cập nhật status Cycle thành `REVIEW` trong BACKLOG.md.
5. KHÔNG tự chuyển thành `DONE` — chỉ Reviewer mới được đánh dấu `DONE`.

## Cấu trúc dự án

```
spark-os/
├── AGENTS.md            # File này — quy tắc cho agent
├── BACKLOG.md           # Danh sách Cycle + acceptance criteria
├── PRD_V5.md            # Tài liệu kiến trúc (chỉ đọc, không sửa)
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts         # CLI entry point (commander)
│   ├── commands/        # Mỗi CLI command = 1 file
│   ├── daemon/          # Local Daemon + health monitor
│   ├── db/              # SQLite schema + connection
│   └── templates/       # Template generators
└── test-workspace/      # Thư mục test thủ công (gitignore)
```

## Quy tắc code

- TypeScript strict mode. Không `any` trừ khi cast từ DB query.
- Dùng `better-sqlite3` (sync API). Không dùng async DB wrapper.
- Không thêm dependency mới nếu stdlib hoặc dependency hiện có đủ dùng.
- Mỗi file mới phải nằm đúng thư mục theo cấu trúc ở trên.
- Không sửa file ngoài scope của Cycle đang implement.
- Không thêm comment inline trừ khi logic phức tạp không rõ ràng.
- Schema DB: mọi thay đổi phải backward-compatible (thêm cột OK, xóa/đổi tên NOT OK).

## Quy tắc commit

- Format: `cycle/<id>: <mô tả ngắn>` (ví dụ: `cycle/1d: add websocket server`)
- Mỗi Cycle = 1 commit (squash nếu cần).
- Không commit file trong `test-workspace/`, `.spark/`, `.env.local`.

## Quy tắc test

- Sau khi implement, tự chạy acceptance test ghi trong BACKLOG.
- Ghi kết quả test vào cuối BACKLOG.md dưới mục `## Test Results`.
- Nếu test fail, sửa code rồi test lại (tối đa 3 lần). Nếu vẫn fail → ghi lại lỗi, chuyển status thành `BLOCKED`.

## Cấm

- KHÔNG sửa AGENTS.md, PRD_V5.md.
- KHÔNG cài thêm dependency chưa được approve (liệt kê trong BACKLOG nếu cần).
- KHÔNG tạo branch mới — code trực tiếp trên working directory.
- KHÔNG chạy `npm publish` hoặc deploy.