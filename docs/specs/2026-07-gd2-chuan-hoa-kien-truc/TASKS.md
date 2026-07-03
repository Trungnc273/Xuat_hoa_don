# TASKS — Giai đoạn 2: Chuẩn hóa kiến trúc nền

> Trạng thái: **Hoàn thành** (03/07/2026 — verify GĐ1 10/10 + GĐ2 4/4 PASS trên dev lẫn prod Docker). PLAN gộp vào SPEC (phạm vi đã duyệt trước ở lộ trình);
> quyết định kỹ thuật ghi ngay trong từng task.

- [x] **T1** Khung hạ tầng `src/server/`: `http.ts` (ok/fail/handleError), `auth.ts` (requireAuth),
      `activity-log.ts` (ghi log chung). *DoD:* tsc sạch, dùng được từ 1 route mẫu.
- [x] **T2** Validators Zod (`src/server/validators/`): invoice, receipt, payment, expense, quotation,
      customer, supplier, product, auth, stock-adjust, setting. *DoD:* body bẩn → 400 + details.
- [x] **T3** Services: `invoice.service.ts` (hàm `createInvoiceCore(tx-scope, ...)` dùng chung),
      `quotation.service.ts` (convert gọi lại core), `receipt.service.ts`. *DoD:* 2 luồng tạo hóa đơn
      chung 1 hàm; verify-gd1 vẫn PASS.
- [x] **T4** Refactor các route ghi sang khung mới (requireAuth + validator + service/inline gọn).
      *DoD:* response shape không đổi; tsc sạch.
- [x] **T5** Migration `Organization` + `organizationId` nullable trên 11 bảng. *DoD:* migrate dev sạch,
      dữ liệu cũ nguyên vẹn.
- [x] **T6** Đổi `src/middleware.ts` → `src/proxy.ts` (export `proxy`). *DoD:* redirect login còn hoạt
      động, hết cảnh báo deprecated.
- [x] **T7** Kiểm chứng: verify-gd1 (dev + prod Docker) + script verify-gd2 cho tiêu chí mới; backup;
      cập nhật tài liệu; commit/push. *DoD:* SPEC Mục 7 tích đủ.
