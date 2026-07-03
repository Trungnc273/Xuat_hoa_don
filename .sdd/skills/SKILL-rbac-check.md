# Skill: Kiểm tra RBAC đúng chuẩn trong API Route

Dùng khi thêm/sửa bất kỳ API route nào có ghi dữ liệu.

## Khuôn mẫu chuẩn

```ts
const session = await verifyAuth(req);
if (!session) {
  return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
}
if (!hasPermission(session, 'CREATE', 'Invoice')) {   // action, subject theo bảng Permission
  return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
}
```

## Điểm kiểm tra bắt buộc trước khi coi là xong

1. `session.role` phải đến từ JWT đã `verifyJWT()` thật — không phải giá trị hardcode (xem ADR/lesson
   02/07/2026 trong `CLAUDE.md`: bug từng ghi đè cứng `role: 'ADMIN'`).
2. Test bằng **ít nhất 2 vai trò**: một vai trò được phép, một vai trò KHÔNG được phép — xác nhận vai trò
   không được phép nhận đúng lỗi 403, không lọt qua.
3. Nếu route có logic "chỉ xem dữ liệu của chính mình" (như STAFF chỉ xem hóa đơn mình tạo), test riêng
   trường hợp đó bằng 2 user cùng vai trò khác nhau.
4. Không kiểm tra quyền chỉ ở FE (ẩn nút) mà bỏ qua ở API — FE chỉ là UX, API mới là chốt chặn thật.
