# Ràng buộc: Bảo mật & Toàn vẹn dữ liệu tài chính

> Áp dụng cho mọi SPEC chạm vào: Invoice, Receipt, Payment, Expense, Quotation, StockMovement, User, Role.

1. **Không tin dữ liệu từ client.** Số tiền, số lượng, đơn giá gửi từ FE luôn phải được server tính lại
   hoặc validate lại — không dùng thẳng `total` do client tự tính gửi lên.
2. **Vai trò lấy từ JWT đã verify, không bao giờ lấy từ body request hay query string.**
3. **Mọi thay đổi số dư/công nợ phải nằm trong transaction cùng với bản ghi tạo ra thay đổi đó**
   (ví dụ: cập nhật `Invoice.paidAmount` phải cùng transaction với tạo `Receipt`).
4. **Số tiền không được âm** ở tầng validation (Zod `.positive()`), trước khi chạm business logic.
5. **Tồn kho phải trung thực.** Được phép âm (nghiệp vụ "bán trước nhập sau" — quyết định 03/07/2026),
   nhưng `StockMovement.prevStock/newStock` phải ghi đúng giá trị thật và response phải cảnh báo khi âm.
   Cấm mọi phép cắt/làm tròn che giấu số liệu (`Math.max(0, ...)`).
6. **Mọi hành động ghi trên các model tài chính phải ghi `ActivityLog`** kèm `userId` thật (không phải
   giá trị suy diễn/hardcode).
