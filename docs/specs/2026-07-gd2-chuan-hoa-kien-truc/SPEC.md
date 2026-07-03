# SPEC — Giai đoạn 2: Chuẩn hóa kiến trúc nền

> Trạng thái: **Hoàn thành** (03/07/2026 — phạm vi đã được chủ dự án duyệt trước trong
> `DANH-GIA-VA-LO-TRINH.md` Mục 6, GĐ2; chi tiết kỹ thuật do AI đề xuất theo CONSTITUTION).

## 1. Bối cảnh

GĐ1 đã vá lỗi nghiêm trọng nhưng 30 API route vẫn lặp code (auth, log, try/catch), không validate input
(lỗi D), logic nghiệp vụ trộn trong route (lỗi I). GĐ2 dựng "bộ khung" để mọi code sau này viết đúng chuẩn:
phân tầng Route → Validation → Service → Prisma như CONSTITUTION Layer 2.2.

## 2. Tác nhân

- Lập trình viên/AI viết code sau này (hưởng lợi từ khung chuẩn).
- Người dùng cuối (hưởng lợi: dữ liệu bẩn bị chặn ở cửa, lỗi trả về nhất quán).

## 3. Yêu cầu chức năng (EARS)

### FR-1 — Khung hạ tầng server dùng chung
- Hệ thống **SHALL** có helper xác thực + phân quyền dùng chung (`requireAuth(req, roles?)`) thay cho
  khối lặp `verifyAuth` + check role thủ công ở từng route.
- Hệ thống **SHALL** có helper response chuẩn (`ok`, `fail`, `handleError`) — mọi lỗi validation trả 400
  kèm chi tiết field; lỗi hệ thống trả 500 không lộ chi tiết CSDL.
- Hệ thống **SHALL** có helper ghi `ActivityLog` dùng chung (nhận session + action + details).

### FR-2 — Validation Zod cho mọi endpoint ghi dữ liệu
- KHI nhận POST/PUT/PATCH, hệ thống **SHALL** parse body qua Zod schema tương ứng trong
  `src/server/validators/` trước khi chạm logic nghiệp vụ.
- NẾU body không hợp lệ (số tiền âm, số lượng ≤ 0, thiếu trường bắt buộc, kiểu sai), hệ thống **SHALL**
  trả 400 kèm danh sách lỗi theo field, không ghi gì vào DB.
- Phạm vi bắt buộc: invoices, receipts, payments, expenses, quotations, customers, suppliers, products,
  auth (login/register), stock/adjust, settings.

### FR-3 — Tầng Service cho nghiệp vụ tài chính
- Hệ thống **SHALL** gom logic của 3 luồng nặng nhất vào `src/server/services/`:
  `invoice.service.ts` (tạo hóa đơn + trừ kho + QR), `quotation.service.ts` (convert → dùng lại logic
  tạo hóa đơn), `receipt.service.ts` (thu tiền + cập nhật công nợ).
- Route tương ứng **SHALL** chỉ còn: requireAuth → validate → gọi service → trả response.
- WHERE hai luồng tạo hóa đơn (trực tiếp và convert), hệ thống **SHALL** dùng chung một hàm service để
  không bao giờ lệch hành vi nữa.

### FR-4 — "Để cửa" đa tổ chức
- Hệ thống **SHALL** thêm model `Organization` và cột `organizationId` (nullable) vào các bảng nghiệp vụ
  chính (User, Customer, Supplier, Product, Warehouse, Quotation, Invoice, Receipt, Payment, Expense,
  Setting) — KHÔNG xây logic lọc theo tổ chức (ADR-002).

### FR-5 — Chuyển middleware → proxy (Next 16)
- Hệ thống **SHALL** đổi `src/middleware.ts` thành `src/proxy.ts` theo convention mới (đã đọc
  `node_modules/next/dist/docs/.../proxy.md`), giữ nguyên hành vi chặn trang chưa đăng nhập.

## 4. Phi chức năng
- Không đổi API contract: response thành công giữ nguyên shape hiện có (FE không phải sửa).
- `npx tsc --noEmit` sạch; `next build` trong Docker thành công.

## 5. Mô hình dữ liệu
- Model mới `Organization { id, name, createdAt, updatedAt }`; cột `organizationId String?` + relation
  trên 11 bảng nêu ở FR-4. Migration không đụng dữ liệu hiện có (cột nullable).

## 6. Xử lý lỗi
| Tình huống | Response |
|---|---|
| Body sai schema | 400 `{ error: 'Dữ liệu không hợp lệ', details: [{ field, message }] }` |
| Chưa đăng nhập / sai quyền | 401 / 403 (message giữ nguyên như hiện tại) |
| Lỗi hệ thống | 500 `{ error: 'Đã xảy ra lỗi hệ thống' }` + log server đầy đủ |

## 7. Tiêu chí chấp nhận
- [x] Toàn bộ verify-gd1 vẫn 10/10 PASS (không phá hành vi GĐ1).
- [x] POST hóa đơn với `quantity: -5` hoặc `unitPrice: "abc"` → 400 kèm details, DB không đổi.
- [x] POST phiếu thu `amount: -1000` → 400.
- [x] Tạo hóa đơn trực tiếp và qua convert cho cùng sản phẩm → cùng hành vi kho (chung service).
- [x] Bảng `organizations` tồn tại; các bảng chính có cột `organizationId` (nullable).
- [x] Không còn file `src/middleware.ts`; `src/proxy.ts` hoạt động (vào `/` chưa đăng nhập → redirect
      `/login`); log dev không còn cảnh báo deprecated middleware.
- [x] `tsc --noEmit` sạch + Docker build thành công + verify chạy trên container prod.

## 8. Ngoài phạm vi
- Refactor các route GET (đọc) sang service — giữ nguyên, chỉ đổi khi đụng tới.
- RBAC theo bảng Permission chi tiết, đóng `/register`, verify JWT trong proxy (GĐ3).
- Cache dashboard/danh mục (GĐ4). Logic multi-tenant thật (ADR-002).
