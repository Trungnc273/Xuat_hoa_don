# SPEC — <Tên tính năng>

> Trạng thái: **Nháp** | Chờ duyệt | Đã duyệt | Đang thực thi | Hoàn thành
> Cách dùng: sao chép thư mục `_TEMPLATE` thành `docs/specs/YYYY-MM-<ten-ngan>/`, điền các mục dưới.
> Người không rành code chỉ cần điền tốt Mục 1, 2, 3, 7, 8 — AI sẽ hỏi lại nếu thiếu thông tin
> cho các mục kỹ thuật (4, 5, 6).

## 1. Bối cảnh

<!-- Vì sao cần tính năng này? Ai đang đau ở đâu? Viết như kể chuyện, không cần thuật ngữ. -->

## 2. Tác nhân (Actors)

<!-- Ai dùng tính năng này? (vai trò nào: ADMIN/MANAGER/ACCOUNTANT/STAFF, hay hệ thống tự chạy?) -->

## 3. Yêu cầu chức năng (cú pháp EARS)

<!-- Mỗi yêu cầu một gạch đầu dòng, dùng từ khóa:
     - "Hệ thống SHALL <hành vi>"                          → yêu cầu luôn đúng
     - "KHI <sự kiện>, hệ thống SHALL <hành vi>"           → phản ứng với sự kiện
     - "NẾU <điều kiện lỗi>, hệ thống SHALL <hành vi>"     → xử lý tình huống xấu
     - "WHERE <phạm vi/tính năng>, hệ thống SHALL <hành vi>" → chỉ áp dụng trong phạm vi
     Tránh từ mơ hồ: "nhanh", "thân thiện", "hợp lý", "nếu cần". -->

### FR-1 — <tên yêu cầu>

- ...

## 4. Yêu cầu phi chức năng

<!-- Hiệu năng, tương thích ngược, giới hạn dung lượng... Không có thì ghi "Không có yêu cầu đặc biệt". -->

## 5. Mô hình dữ liệu

<!-- Bảng/cột mới hoặc thay đổi trong prisma/schema.prisma. AI đề xuất nếu bạn không rõ. -->

## 6. Xử lý lỗi

| Tình huống | Response |
|---|---|
| ... | ... |

## 7. Tiêu chí chấp nhận (Acceptance Criteria)

<!-- Danh sách kiểm được bằng hành động thật (bấm gì, thấy gì / gọi API gì, nhận gì).
     Quy tắc: nếu không mô tả được cách kiểm chứng, yêu cầu đó chưa đủ rõ để làm. -->

- [ ] ...

## 8. Ngoài phạm vi (Out of Scope)

<!-- Liệt kê rõ những thứ NGHE có vẻ liên quan nhưng KHÔNG làm trong spec này, để AI không tiện tay làm thêm. -->

- ...
