# SPEC — Giai đoạn 1: Vá lỗi nghiêm trọng

> Trạng thái: **Hoàn thành** (03/07/2026 — 10/10 tiêu chí PASS bằng scripts/verify-gd1.mjs). Đọc cùng `CONTEXT.md` trong thư mục này và `CONSTITUTION.md`
> ở gốc dự án. Sau khi người dùng duyệt SPEC này, AI mới được viết `PLAN.md` rồi `TASKS.md`.

## 1. Bối cảnh

Xem `CONTEXT.md`. Ba lỗi dưới đây phải được vá trước khi hệ thống dùng dữ liệu thật, vì mỗi lỗi đều khiến
app "trông như đúng" trong test thông thường nhưng sai ở production.

## 2. Tác nhân (Actors)

- **ADMIN, MANAGER, ACCOUNTANT, STAFF** — người dùng đăng nhập qua `/login`.
- **Hệ thống** — các API route, service, transaction Prisma.

## 3. Yêu cầu chức năng (cú pháp EARS)

### FR-1 — Vai trò phải phản ánh đúng dữ liệu trong token

- Hệ thống **SHALL** trả về vai trò (`role`) đúng như giá trị đã ký trong JWT tại thời điểm đăng nhập,
  không được ghi đè bằng giá trị cố định.
- KHI một request có JWT hợp lệ với `role = STAFF`, hệ thống **SHALL** coi phiên đó có vai trò `STAFF`
  trong toàn bộ vòng đời request (bao gồm mọi kiểm tra quyền trong `verifyAuth`, API route, và response
  của `/api/auth/me`).
- WHERE một API route giới hạn hành động theo vai trò (ví dụ chỉ `ADMIN, MANAGER, ACCOUNTANT` được tạo
  phiếu thu), hệ thống **SHALL** từ chối request với HTTP 403 nếu vai trò thực tế của phiên không nằm
  trong danh sách cho phép.
- KHI vai trò là `STAFF` và request là `GET /api/invoices`, hệ thống **SHALL** chỉ trả về hóa đơn có
  `creatorId` bằng `userId` của phiên đó (hành vi lọc này đã có sẵn trong code, chỉ cần vá để nó *thực sự*
  được kích hoạt vì trước đây `role` luôn là `ADMIN` nên không bao giờ lọc).

### FR-2 — Sinh mã chứng từ không được trùng dưới điều kiện đồng thời

- Hệ thống **SHALL** đảm bảo hai request tạo chứng từ cùng loại (hóa đơn, báo giá, phiếu thu, phiếu chi)
  xảy ra đồng thời **KHÔNG BAO GIỜ** nhận cùng một mã.
- KHI sinh mã chứng từ, hệ thống **SHALL** thực hiện việc này trong cùng transaction với việc tạo bản ghi
  chứng từ đó (không tính mã trước rồi tạo bản ghi sau ngoài transaction).
- Hệ thống **SHALL** vẫn giữ định dạng mã hiện có (`HD000001`, `BG000001`, `PT000001`, `PC000001`,
  `SP000001`, `KH000001`, `NCC000001`, `KHO000001`, `CP000001`) — không đổi format hiển thị.

### FR-3 — Tồn kho phải trung thực (cho phép bán vượt, ghi số âm)

> Đã sửa 03/07/2026 theo quyết định của chủ dự án: nghiệp vụ "bán trước nhập sau" là hợp lệ với cửa hàng
> nhỏ — tồn kho âm phản ánh đúng thực tế và sẽ được bù khi nhập hàng. Cái bị cấm là *nói dối số liệu*.

- KHI tạo hóa đơn có dòng hàng với `productId` khác null, hệ thống **SHALL** trừ tồn kho đúng bằng số lượng
  bán, kể cả khi kết quả âm (ví dụ: tồn 5, bán 8 → tồn mới = −3).
- Hệ thống **SHALL** ghi `StockMovement` với `prevStock`/`newStock` đúng giá trị thật (kể cả âm) —
  **CẤM** dùng `Math.max(0, ...)` hay bất kỳ phép cắt nào làm sai lệch số liệu.
- KHI một dòng hàng khiến tồn kho xuống âm, hệ thống **SHALL** trả về cảnh báo trong response (danh sách
  sản phẩm bị âm kèm mức tồn mới) để người bán biết mà nhập bù — nhưng **KHÔNG** chặn giao dịch.
- WHERE luồng chuyển báo giá thành hóa đơn (`quotations/[id]/convert`), hệ thống **SHALL** trừ kho và ghi
  `StockMovement` giống hệt luồng tạo hóa đơn trực tiếp (quyết định 03/07/2026 — trước đây luồng này không
  trừ kho, gây sai tồn).

## 4. Yêu cầu phi chức năng

- Không được làm chậm luồng tạo hóa đơn quá mức cảm nhận được (mọi kiểm tra thêm vẫn nằm trong 1
  transaction hiện có, không thêm round-trip DB thừa).
- Không phá vỡ API contract hiện tại (response shape của `/api/auth/me`, `/api/invoices` giữ nguyên field).

## 5. Mô hình dữ liệu (thay đổi cần thiết)

- **Mới:** bảng đếm chứng từ atomic. Đề xuất: thêm model `DocumentCounter` (`prefix` unique, `lastNumber`
  Int) trong `prisma/schema.prisma`, cập nhật bằng `UPDATE ... RETURNING` hoặc
  `upsert` + `increment` trong transaction — quyết định cụ thể thuộc về bước `PLAN.md`.
- Không đổi cấu trúc bảng `Invoice`, `User`, `Role` hiện có.

## 6. Xử lý lỗi

| Tình huống | Response |
|---|---|
| JWT không hợp lệ/hết hạn | 401, `{ error: 'Chưa xác thực người dùng' }` (giữ nguyên hiện trạng) |
| Vai trò không đủ quyền | 403, `{ error: 'Bạn không có quyền thực hiện chức năng này' }` (giữ nguyên) |
| Bán vượt tồn (hợp lệ) | 200 kèm `stockWarnings: [{ productId, productName, newStock }]` trong response |
| Trùng mã do lỗi khác (hiếm) | 500 với log server-side đầy đủ, không lộ chi tiết CSDL cho client |

## 7. Tiêu chí chấp nhận (Acceptance Criteria)

- [x] Đăng nhập bằng tài khoản `staff` (seed có sẵn) → `GET /api/auth/me` trả `role: "STAFF"` (không phải
      `"ADMIN"`).
- [x] Tài khoản `staff` gọi `POST /api/receipts` → nhận HTTP 403 (STAFF không có trong danh sách được lập
      phiếu thu).
- [x] Tài khoản `staff` gọi `GET /api/invoices` → chỉ thấy hóa đơn do chính `staff` tạo.
- [x] Viết script/test tạo 10 hóa đơn đồng thời (Promise.all) → 10 mã sinh ra khác nhau hoàn toàn, không
      lỗi unique constraint.
- [x] Tạo hóa đơn với sản phẩm có tồn kho = 5, số lượng đặt = 8 → thành công, tồn kho mới = −3,
      `StockMovement` ghi `prevStock: 5, newStock: -3`, response có `stockWarnings` nêu sản phẩm này.
- [x] Tạo hóa đơn với số lượng ≤ tồn kho → thành công, tồn kho trừ đúng, không có `stockWarnings`.
- [x] Chuyển báo giá (có sản phẩm thực) thành hóa đơn → tồn kho bị trừ + có `StockMovement`, giống hệt
      tạo hóa đơn trực tiếp.
- [x] Toàn bộ acceptance criteria trên được xác minh bằng lệnh `curl`/script thật, không chỉ đọc code.

## 8. Ngoài phạm vi (Out of Scope)

- Kích hoạt đầy đủ bảng `Permission`/`RolePermission` chi tiết (thuộc Giai đoạn 3).
- Validation Zod toàn diện cho mọi route (thuộc Giai đoạn 2).
- Đóng trang đăng ký công khai `/register` (thuộc Giai đoạn 3).
- Middleware xác minh chữ ký JWT đầy đủ thay vì chỉ check tồn tại cookie (thuộc Giai đoạn 3, mục E trong
  báo cáo đánh giá).
