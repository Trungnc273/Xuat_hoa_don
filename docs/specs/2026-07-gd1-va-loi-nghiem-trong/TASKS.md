# TASKS — Giai đoạn 1: Vá lỗi nghiêm trọng

> Trạng thái: **Hoàn thành** (03/07/2026 — verify 10/10 PASS, xem scripts/verify-gd1.mjs) (danh sách này sinh sẵn từ PLAN.md để duyệt một lượt; chỉ thực thi sau khi
> PLAN được duyệt và 2 câu hỏi ở PLAN Mục 6 được trả lời). AI tích [x] sau khi xong từng task.
> Mỗi task nguyên tử, có DoD (Definition of Done), ước tính ≤ 4 giờ.

## Nhóm 1 — FR-1: Vai trò đúng theo token

- [x] **T1.1** Xóa ghi đè `role: 'ADMIN'` trong `verifyJWT` (`src/lib/auth.ts`).
      *DoD:* decode token của staff trả `role: 'STAFF'`. Ước tính: 0.5h.
- [x] **T1.2** Trả đúng role thật trong response của `login`, `me`, `register` route.
      *DoD:* `GET /api/auth/me` với token staff trả `"role": "STAFF"`. Ước tính: 0.5h.
- [x] **T1.3** Đăng nhập UI bằng cả 4 vai trò seed, soát các trang dashboard không crash/trắng trang khi
      `role !== 'ADMIN'`.
      *DoD:* 4 vai trò đều vào được dashboard; ghi lại khác biệt menu (nếu có) vào ghi chú task. Ước tính: 1h.

## Nhóm 2 — FR-2: Sinh mã chứng từ atomic

- [x] **T2.1** Thêm model `DocumentCounter` vào `prisma/schema.prisma`, tạo migration kèm SQL backfill
      bộ đếm từ mã lớn nhất hiện có của 9 bảng.
      *DoD:* `prisma migrate dev` chạy sạch trên DB hiện tại; bảng `document_counters` có 9 dòng với
      `lastNumber` khớp mã lớn nhất từng bảng. Ước tính: 2h.
- [x] **T2.2** Viết lại `generateDocumentCode(tx, prefix)` — chữ ký mới bắt buộc nhận transaction client;
      xóa nhánh `count()` và try/catch nuốt lỗi.
      *DoD:* gọi ngoài transaction → lỗi TypeScript; unit gọi 2 lần liên tiếp ra 2 mã liền nhau. Ước tính: 1h.
- [x] **T2.3** Cập nhật 9 route sinh mã sang chữ ký mới, chuyển điểm gọi vào trong `$transaction`
      (route nào chưa có transaction thì bọc mới).
      *DoD:* `npx tsc --noEmit` sạch; tạo thử 1 bản ghi mỗi loại qua API đều thành công, mã nối tiếp đúng.
      Ước tính: 3h.
- [x] **T2.4** Riêng `quotations/[id]/convert`: gộp 2 lần sinh mã còn 1, sinh QR sau khi có mã thật trong
      transaction.
      *DoD:* convert 1 báo giá → hóa đơn có mã và QR chứa đúng mã đó, bộ đếm chỉ tăng 1. Ước tính: 1h.

## Nhóm 3 — FR-3: Chặn bán vượt kho

- [x] **T3.1** Thêm kiểm tra tồn kho + trừ kho bằng `decrement` có điều kiện trong `invoices/route.ts`,
      bỏ `Math.max(0, ...)`; lỗi trả 400 với `details[]` đúng format SPEC Mục 6.
      *DoD:* tạo hóa đơn vượt kho bị chặn, tồn kho và StockMovement không đổi; hóa đơn hợp lệ trừ kho đúng.
      Ước tính: 2h.
- [x] **T3.2** *(Chờ trả lời câu hỏi 1 trong PLAN)* Áp cùng logic trừ kho + kiểm tồn cho
      `quotations/[id]/convert`.
      *DoD:* convert báo giá có sản phẩm vượt tồn → bị chặn; đủ tồn → trừ kho + ghi StockMovement như tạo
      hóa đơn trực tiếp. Ước tính: 1.5h.

## Nhóm 4 — Kiểm chứng & chốt

- [x] **T4.1** Viết `scripts/verify-gd1.mjs` chạy 7 tiêu chí chấp nhận của SPEC bằng API thật, in bảng
      PASS/FAIL.
      *DoD:* chạy `node scripts/verify-gd1.mjs` trên app đang chạy → 7/7 PASS. Ước tính: 2h.
- [x] **T4.2** Chạy verify trên bản Docker prod (`--profile prod`), backup DB trước khi test.
      *DoD:* 7/7 PASS trên container prod; file backup mới trong `backups/`. Ước tính: 0.5h.
- [x] **T4.3** Cập nhật tài liệu: tích các mục GĐ1 trong `DANH-GIA-VA-LO-TRINH.md`, thêm bài học mới (nếu
      có) vào `CLAUDE.md`, đổi trạng thái SPEC/PLAN thành "Hoàn thành".
      *DoD:* tài liệu khớp hiện trạng code. Ước tính: 0.5h.

**Tổng ước tính:** ~15.5h làm việc.
