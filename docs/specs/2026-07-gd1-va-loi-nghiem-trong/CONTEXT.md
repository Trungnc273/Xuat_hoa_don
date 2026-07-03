# CONTEXT — Giai đoạn 1: Vá lỗi nghiêm trọng

## Nỗi đau của người dùng

Chủ dự án vừa nhận lại một hệ thống "vibe-coded" chưa qua kiểm chứng, dự định đưa vào dùng thật cho một
cửa hàng/xưởng nhỏ với nhiều nhân viên có vai trò khác nhau (Admin, Quản lý, Kế toán, Nhân viên). Rủi ro
lớn nhất không phải thiếu tính năng mà là **dữ liệu tài chính sai/bị lộ mà không ai biết**, vì hệ thống
"trông như hoạt động đúng" khi chỉ test bằng 1 tài khoản admin.

## Thuật ngữ nghiệp vụ

- **Chứng từ**: hóa đơn (HD), báo giá (BG), phiếu thu (PT), phiếu chi (PC) — mỗi loại có mã tăng dần riêng.
- **Vai trò (Role)**: ADMIN (toàn quyền), MANAGER (quản lý), ACCOUNTANT (thu/chi), STAFF (bán hàng, chỉ
  xem chứng từ do mình tạo).
- **Xuất kho theo hóa đơn**: khi tạo hóa đơn có sản phẩm thực (`productId` khác null), hệ thống tự trừ tồn
  kho và ghi `StockMovement` loại `OUT`.

## Ràng buộc & giả định

- Dữ liệu hiện tại toàn bộ là **dữ liệu test**, được phép xóa/reset tự do trong giai đoạn này.
- Chưa có khách hàng thật dùng hệ thống — không cần lo về việc phá vỡ dữ liệu đang chạy.
- Không đổi bộ vai trò hiện có (ADMIN/MANAGER/ACCOUNTANT/STAFF) — đã xác nhận đúng nhu cầu.
- Không cần đa tổ chức (multi-tenant) ở giai đoạn này — chỉ 1 công ty dùng hệ thống.

## Nguồn tham chiếu

Toàn bộ 3 lỗi trong SPEC này đã được xác định kèm bằng chứng cụ thể (đường dẫn file, đoạn code) tại
`DANH-GIA-VA-LO-TRINH.md` Mục 2 (lỗi A, B, C).
