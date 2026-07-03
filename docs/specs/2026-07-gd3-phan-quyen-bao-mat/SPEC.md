# SPEC — Giai đoạn 3: Phân quyền & bảo mật

> Trạng thái: **Hoàn thành** (03/07/2026 — verify GĐ1 10/10 + GĐ2 4/4 + GĐ3 8/8 PASS trên dev lẫn prod Docker). Quyết định chủ dự án: Admin tạo tài khoản ở
> **màn quản lý tài khoản riêng** trong dashboard; đóng đăng ký công khai.

## 1. Bối cảnh
GĐ1 làm vai trò chạy đúng nhưng quyền vẫn hardcode theo mảng tên vai trò trong từng route; bảng
Permission/RolePermission trong CSDL (đã seed) chưa được dùng. Trang `/register` mở công khai — sai với
mô hình nội bộ (Mục 0b báo cáo đánh giá). Proxy chỉ kiểm tra "có cookie", token giả vẫn vào được UI.
Upload không giới hạn.

## 2. Tác nhân
- **ADMIN** — quản lý tài khoản nhân viên ở màn riêng.
- **MANAGER / ACCOUNTANT / STAFF** — quyền theo bảng Permission (nguồn sự thật duy nhất).

## 3. Yêu cầu chức năng (EARS)

### FR-1 — Màn quản lý tài khoản của Admin
- Hệ thống **SHALL** có trang `/users` trong dashboard, chỉ hiện trên menu và truy cập được với ADMIN.
- WHERE trang `/users`, ADMIN **SHALL** xem danh sách tài khoản (username, email, vai trò, ngày tạo),
  tạo tài khoản mới (username, email, mật khẩu, vai trò), đổi vai trò và đặt lại mật khẩu tài khoản khác.
- Hệ thống **SHALL KHÔNG** cho xóa tài khoản (chứng từ tham chiếu creatorId — CONSTITUTION Layer 1.2);
  ADMIN cũng **SHALL KHÔNG** tự đổi vai trò của chính mình (tránh tự khóa hệ thống).

### FR-2 — Đóng đăng ký công khai
- Hệ thống **SHALL** gỡ trang đăng ký công khai `/register`; truy cập đường dẫn này chuyển hướng `/login`.
- API `POST /api/auth/register` **SHALL** yêu cầu phiên ADMIN (trở thành API tạo tài khoản nội bộ).

### FR-3 — RBAC theo bảng Permission (nguồn sự thật duy nhất)
- KHI kiểm tra quyền ở API ghi dữ liệu, hệ thống **SHALL** đối chiếu bảng `RolePermission` theo cặp
  (action, subject) — ví dụ ('CREATE', 'Invoice') — thay cho mảng tên vai trò hardcode; action `ALL`
  bao trùm mọi action của subject đó.
- Hệ thống **SHALL** cache mapping quyền trong bộ nhớ (TTL ngắn) để không truy vấn DB mỗi request.
- Quyền theo seed hiện tại là chuẩn nghiệp vụ (ADMIN: tất; MANAGER: Customer/Supplier/Product/Quotation/
  Invoice/Warehouse; ACCOUNTANT: Invoice/Receipt/Payment/Expense + đọc Customer/Supplier; STAFF: đọc/tạo/sửa
  Customer/Product/Quotation + đọc/tạo Invoice).

### FR-4 — Proxy xác minh chữ ký JWT
- KHI nhận request trang có cookie `token`, proxy **SHALL** xác minh chữ ký HMAC-SHA256 và hạn dùng của
  JWT bằng WebCrypto (không thêm dependency); token sai/hết hạn bị đối xử như chưa đăng nhập.

### FR-5 — Giới hạn upload
- Hệ thống **SHALL** chỉ nhận file ảnh (jpg/jpeg/png/webp) tối đa 5MB ở `/api/upload`;
  loại khác hoặc quá cỡ → 400 với thông báo rõ.

## 4. Phi chức năng
- verify-gd1 + verify-gd2 vẫn PASS toàn bộ. tsc sạch, Docker build OK.

## 5. Mô hình dữ liệu
Không đổi schema (dùng bảng Role/Permission/RolePermission sẵn có).

## 6. Xử lý lỗi
| Tình huống | Response |
|---|---|
| Không đủ quyền (permission) | 403, message giữ nguyên |
| Tự đổi vai trò chính mình | 400 `{ error: 'Không thể tự thay đổi vai trò của chính mình' }` |
| File sai loại/quá 5MB | 400 kèm lý do |

## 7. Tiêu chí chấp nhận
- [x] verify-gd1 10/10 + verify-gd2 4/4 PASS.
- [x] ADMIN tạo tài khoản mới qua API `/api/users` → đăng nhập được bằng tài khoản đó.
- [x] STAFF gọi `GET /api/users` hoặc `POST /api/users` → 403.
- [x] Người chưa đăng nhập `POST /api/auth/register` → 401.
- [x] `GET /register` → chuyển hướng `/login`.
- [x] MANAGER `POST /api/payments` → 403 (theo Permission: chỉ ADMIN/ACCOUNTANT có quyền Payment).
- [x] Cookie token giả (sai chữ ký) vào `/` → bị chuyển hướng `/login` (proxy verify thật).
- [x] Upload file .exe hoặc ảnh > 5MB → 400; ảnh png nhỏ → thành công.
- [x] ADMIN PATCH đổi vai trò chính mình → 400.

## 8. Ngoài phạm vi
- Trang UI đổi mật khẩu cá nhân của từng user (tự đổi) — backlog GĐ4.
- Quản lý sửa/xóa Permission động qua UI — dùng seed cố định.
- Khóa/vô hiệu hóa tài khoản (cần thêm cột `isActive`) — backlog GĐ4.
