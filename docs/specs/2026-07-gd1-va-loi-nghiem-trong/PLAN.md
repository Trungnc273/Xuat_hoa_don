# PLAN — Giai đoạn 1: Vá lỗi nghiêm trọng

> Trạng thái: **Hoàn thành** (03/07/2026). Đáp án câu hỏi Mục 6: (1) Phương án A — convert CÓ trừ kho; (2) CHO PHÉP bán âm kho (mọi vai trò), ghi số liệu trung thực + cảnh báo. Sinh từ `SPEC.md` ngày 03/07/2026. Đã tự đối chiếu với `CONSTITUTION.md`
> (không phát hiện xung đột — chi tiết ở Mục 5). Sau khi duyệt PLAN, AI sinh `TASKS.md` rồi mới sửa code.

## 1. Cách tiếp cận theo từng yêu cầu

### FR-1 — Vai trò đúng theo token (lỗi A)

**Nguyên nhân gốc:** 3 chỗ hardcode `role: 'ADMIN'`:
1. `src/lib/auth.ts` → `verifyJWT()` ghi đè `role: 'ADMIN'` sau khi decode — **đây là chỗ chí mạng** vì mọi API đều đi qua nó.
2. `src/app/api/auth/login/route.ts` → response trả `role: 'ADMIN'` (chỉ sai hiển thị, nhưng FE sẽ tin theo).
3. `src/app/api/auth/me/route.ts` → response trả `role: 'ADMIN'` thay vì `user.role.name` (FE dùng response này để ẩn/hiện menu → hiện tại mọi user thấy toàn bộ menu).
4. `src/app/api/auth/register/route.ts` → response cũng trả `role: 'ADMIN'` (sai hiển thị).

**Sửa:** xóa các ghi đè, trả đúng `decoded.role` / `user.role.name`. Không đổi cấu trúc JWT (payload đã chứa `role` đúng từ lúc ký — chỉ chỗ đọc bị phá).

**Không sửa trong FR này:** logic phân quyền chi tiết theo bảng Permission (Giai đoạn 3). Các check `['ADMIN','MANAGER',...].includes(session.role)` hiện có trong các route sẽ tự động hoạt động đúng sau khi vá.

### FR-2 — Sinh mã chứng từ atomic (lỗi B)

**Thiết kế:** thêm model vào `prisma/schema.prisma`:

```prisma
model DocumentCounter {
  prefix     String @id            // "HD", "BG", "PT", "PC", "SP", "KH", "NCC", "KHO", "CP"
  lastNumber Int    @default(0)
  @@map("document_counters")
}
```

Viết lại `generateDocumentCode(tx, prefix)` trong `src/lib/utils.ts`:
- Nhận **transaction client** (`tx`) làm tham số — bắt buộc gọi bên trong `$transaction` (đúng FR-2 và CONSTITUTION Layer 2.4).
- Dùng `tx.documentCounter.upsert({ where: {prefix}, create: {prefix, lastNumber: 1}, update: {lastNumber: {increment: 1}} })` rồi đọc `lastNumber` từ kết quả trả về. Upsert + increment là atomic ở tầng row-lock của Postgres → 2 request đồng thời tuần tự hóa tự nhiên, không trùng.
- Bỏ hoàn toàn nhánh `count()` và khối `try/catch` nuốt lỗi (vá luôn lỗi H trong báo cáo đánh giá).

**Điểm gọi phải sửa (9 chỗ, tất cả chuyển vào trong transaction):** `invoices/route.ts`, `quotations/route.ts`, `quotations/[id]/convert/route.ts` (hiện gọi 2 lần — gộp còn 1 lần trong transaction, QR sinh sau khi có mã thật), `receipts/route.ts`, `payments/route.ts`, `expenses/route.ts`, `customers/route.ts`, `suppliers/route.ts`, `products/route.ts` (+ `products/import` nếu có sinh mã).

**Seed dữ liệu cũ:** migration kèm bước khởi tạo `DocumentCounter` từ mã lớn nhất hiện có của mỗi bảng (dữ liệu toàn test nhưng làm đúng ngay để sau này cài cho khách từ backup không bị lệch bộ đếm).

### FR-3 — Chặn bán vượt kho (lỗi C)

**Sửa trong `invoices/route.ts` (POST), bên trong transaction hiện có:**
1. Trước khi tạo hóa đơn: gom `productId` của các dòng hàng, đọc tồn kho một lượt.
2. Nếu có dòng `quantity > stock` → `throw` lỗi có cấu trúc `{ productId, productName, requested, available }[]` → transaction rollback toàn bộ (thỏa "không tạo một phần") → route trả 400 đúng format Mục 6 của SPEC.
3. Trừ kho bằng `updateMany({ where: { id, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })` và kiểm `count === 1` — chốt chặn thứ hai chống race giữa 2 hóa đơn đồng thời (kiểm tra ở bước 1 chỉ là để trả lỗi đẹp; bước 3 mới là bảo đảm thật).
4. Bỏ `Math.max(0, ...)`.

## 2. Danh sách file thay đổi

| File | Loại thay đổi |
|---|---|
| `prisma/schema.prisma` | Thêm model `DocumentCounter` |
| `prisma/migrations/<mới>` | Migration tạo bảng + backfill bộ đếm từ mã lớn nhất hiện có |
| `src/lib/auth.ts` | Xóa ghi đè `role: 'ADMIN'` trong `verifyJWT` |
| `src/app/api/auth/{login,me,register}/route.ts` | Trả đúng `role` thật |
| `src/lib/utils.ts` | Viết lại `generateDocumentCode(tx, prefix)` |
| 9 route sinh mã (liệt kê ở FR-2) | Chuyển sinh mã vào trong transaction |
| `src/app/api/invoices/route.ts` | Kiểm tồn kho + trừ kho an toàn (FR-3) |
| `scripts/verify-gd1.mjs` (mới) | Script kiểm tra tự động 7 tiêu chí chấp nhận |

## 3. Rủi ro & cách giảm

- **FE có thể đang lệ thuộc hành vi "ai cũng là ADMIN"** (menu, nút bấm ẩn theo role). Sau khi vá, đăng nhập bằng staff/accountant có thể thấy menu khác đi — đây là **hành vi đúng**, nhưng cần soát nhanh các trang dashboard để chắc không trang nào crash khi `role !== 'ADMIN'`. Giảm rủi ro: test UI đăng nhập cả 4 vai trò sau khi vá.
- **Route nào quên chuyển sinh mã vào transaction** sẽ lỗi TypeScript ngay (đổi chữ ký hàm bắt buộc nhận `tx`) — thiết kế cố ý để compiler bắt sót, không dựa vào trí nhớ.
- **Migration backfill bộ đếm** phải chạy sau khi bảng đã có dữ liệu — viết trong cùng file migration SQL, đã an toàn cho cả DB trống (max = 0).

## 4. Cách kiểm chứng (mapping với Acceptance Criteria)

Viết `scripts/verify-gd1.mjs` chạy bằng `node`, gọi API thật trên `http://localhost:3000`:
login 4 vai trò → check `role` trả đúng; staff POST receipts → expect 403; staff GET invoices → chỉ thấy của mình; `Promise.all` tạo 10 hóa đơn → 10 mã khác nhau; tạo hóa đơn vượt kho → 400 + tồn kho không đổi + không có StockMovement mới; tạo hóa đơn hợp lệ → 200 + kho trừ đúng. In bảng PASS/FAIL từng tiêu chí.

## 5. Đối chiếu CONSTITUTION

- Layer 1.4 (không tắt kiểm tra quyền): FR-1 chính là khôi phục nó ✓
- Layer 2.3 (ghi ≥2 bảng phải transaction): FR-2, FR-3 đều nằm trong transaction ✓
- Layer 2.4 (cấm `count()+1`): FR-2 xóa bỏ ✓
- Layer 2.6 (cân nhắc `organizationId` cho bảng mới): `DocumentCounter` là bảng hạ tầng đếm mã, khi có multi-tenant thì prefix sẽ ghép thêm orgId — chấp nhận không thêm cột ngay, ghi chú lại. ✓ (nêu rõ để người duyệt biết)

## 6. Câu hỏi cho con người (cần trả lời trước khi thực thi)

1. **Phát hiện khi đối chiếu code:** đường **"chuyển báo giá → hóa đơn" hiện KHÔNG trừ kho**, trong khi tạo hóa đơn trực tiếp CÓ trừ kho. Hai đường tạo cùng loại chứng từ nhưng hành xử khác nhau → tồn kho sẽ sai nếu bán qua báo giá. Xử lý thế nào?
   - **Phương án A (khuyến nghị):** convert cũng trừ kho + kiểm tồn kho như FR-3, cùng làm trong GĐ1 vì cùng bản chất lỗi C.
   - Phương án B: giữ nguyên, ghi vào backlog GĐ2 (chấp nhận tồn kho sai tạm thời).
2. Khi hết hàng, có cho phép vai trò ADMIN/MANAGER **ghi đè** bán âm kho không (một số cửa hàng cho phép "bán trước nhập sau")? Mặc định theo SPEC là **không ai được** — xác nhận đúng ý bạn?
