# SPEC — Giai đoạn 4: Hoàn thiện MVP & phát hành

> Trạng thái: **Hoàn thành** (03/07/2026 — 31/31 PASS trên prod Docker gồm cả restart test; demo-ngrok.ps1 là script tương tác, người dùng tự chạy). Yêu cầu bổ sung từ chủ dự án: bộ tài liệu cài đặt/chạy
> hoàn chỉnh + cơ chế public port bằng ngrok để demo nhanh cho khách.

## 1. Bối cảnh
GĐ1–3 đã xong phần lõi. GĐ4 là bước cuối trước khi coi MVP hoàn thành theo tiêu chí nghiệm thu
(DANH-GIA-VA-LO-TRINH.md Mục 7): tối ưu đọc, kiểm thử trọn luồng nghiệp vụ, và đóng gói trải nghiệm
cài đặt/demo cho người không rành kỹ thuật.

## 2. Yêu cầu chức năng (EARS)

### FR-1 — Cache dữ liệu đọc nhiều
- Hệ thống **SHALL** cache in-memory (TTL) cho: dashboard (30s), settings (5 phút), categories (5 phút).
- KHI dữ liệu nguồn thay đổi qua API ghi tương ứng (PUT settings, POST/PUT/DELETE categories), hệ thống
  **SHALL** xóa cache liên quan ngay (không đợi hết TTL).
- Không dùng Redis (CONSTITUTION Layer 2.5 — chưa có nhu cầu đo được).

### FR-2 — Kiểm thử trọn luồng nghiệm thu MVP
- Hệ thống **SHALL** có script `verify-mvp.mjs` chạy tuần tự luồng thật: Admin tạo tài khoản nhân viên →
  tạo sản phẩm (kèm tồn kho) → tạo khách hàng → nhân viên tạo báo giá → chuyển thành hóa đơn (kho trừ đúng)
  → kế toán lập phiếu thu đủ tiền → hóa đơn thành PAID → công nợ về 0 → dashboard & nhật ký phản ánh đúng.
- Script **SHALL** kiểm tra sống sót sau khởi động lại: `docker restart` container app + db → dữ liệu
  nguyên vẹn, đăng nhập lại được.
- Hệ thống **SHALL** smoke-test mọi trang dashboard bằng cả 4 vai trò (không trang nào 500).

### FR-3 — Public port bằng ngrok (demo cho khách)
- Hệ thống **SHALL** có script `scripts/demo-ngrok.ps1`: kiểm tra ngrok đã cài (hướng dẫn cài nếu chưa),
  cảnh báo đổi mật khẩu mặc định trước khi public, chạy `ngrok http 3000` và in URL công khai.
- Tài liệu **SHALL** ghi rõ: ngrok chỉ dùng demo tạm thời, KHÔNG phải cách triển khai production
  (URL đổi mỗi lần chạy bản free; muốn chạy thật qua Internet → VPS, xem Mục 0b báo cáo).

### FR-4 — Bộ tài liệu cài đặt & vận hành hoàn chỉnh
- `HUONG-DAN-CAI-DAT.md` **SHALL** bao quát: yêu cầu máy, cài từ số 0 (dev + máy cửa hàng), tài khoản
  mẫu, checklist máy-làm-server, backup/phục hồi, demo ngrok, sự cố thường gặp, cập nhật phiên bản mới
  (git pull → rebuild).

## 3. Phi chức năng
- Toàn bộ verify gd1/gd2/gd3 vẫn PASS. tsc sạch, Docker build OK.

## 4. Tiêu chí chấp nhận
- [x] verify-gd1 10/10 + gd2 4/4 + gd3 8/8 PASS (regression).
- [x] verify-mvp PASS trọn luồng trên bản Docker prod, bao gồm test khởi động lại container.
- [x] Smoke 18 trang dashboard × 4 vai trò: không response 500.
- [x] Gọi dashboard 2 lần liên tiếp: lần 2 nhanh hơn rõ rệt (cache hit) và sau khi tạo hóa đơn mới
      ≤30s dashboard phản ánh số mới.
- [x] Đổi settings qua PUT → GET ngay sau đó thấy giá trị mới (cache được xóa chủ động).
- [x] `demo-ngrok.ps1` chạy được (nếu máy có ngrok) hoặc in hướng dẫn cài rõ ràng (nếu chưa).
- [x] HUONG-DAN-CAI-DAT.md đủ các mục ở FR-4.

## 5. Ngoài phạm vi
- User tự đổi mật khẩu, khóa tài khoản (isActive) — backlog sau MVP.
- HTTPS/tường lửa cho VPS — chỉ làm khi có khách lớn thuê VPS thật.
