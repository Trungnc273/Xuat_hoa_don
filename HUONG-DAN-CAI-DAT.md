# Hướng dẫn cài đặt & vận hành

> Dành cho người mới nhận dự án hoặc cài cho khách hàng mới.
> Yêu cầu duy nhất: **Docker Desktop** (và Node.js 22 nếu muốn lập trình).

---

## 1. Cài cho máy phát triển (dev)

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file cấu hình
#    Sao chép .env.example thành .env rồi điền:
#    DATABASE_URL="postgresql://hoadon:hoadon_dev_2026@localhost:5433/web_xuat_hoa_don?schema=public"
#    JWT_SECRET=<chuỗi ngẫu nhiên dài, KHÔNG dùng giá trị mẫu>

# 3. Bật CSDL (PostgreSQL trong Docker, port 5433)
docker compose up -d db

# 4. Tạo bảng + dữ liệu mẫu
npx prisma migrate dev
npx prisma db seed

# 5. Chạy app
npm run dev
# → http://localhost:3000
```

**Tài khoản mẫu sau khi seed** (đổi mật khẩu ngay khi dùng thật):

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| admin | admin123 | ADMIN |
| manager | manager123 | MANAGER |
| accountant | accountant123 | ACCOUNTANT |
| staff | staff123 | STAFF |

---

## 2. Cài cho máy cửa hàng (production nội bộ, chạy trọn trong Docker)

```bash
# 1. Tạo file .env chỉ cần một dòng (bắt buộc, không có sẽ không chạy):
#    JWT_SECRET=<chuỗi ngẫu nhiên dài ít nhất 32 ký tự>

# 2. Build và chạy trọn bộ (DB + migrate + app)
docker compose --profile prod up -d --build
```

**Gieo dữ liệu ban đầu (chỉ lần đầu cài):** chọn 1 trong 2 cách:

```powershell
# Cách A — máy này có sẵn Node.js: chạy seed trỏ vào DB trong Docker
$env:DATABASE_URL = "postgresql://hoadon:hoadon_dev_2026@localhost:5433/web_xuat_hoa_don?schema=public"
npx prisma db seed

# Cách B — phục hồi từ file backup của một máy khác (xem mục 4)


- Máy chủ mở: `http://localhost:3000`
- Máy khác trong cùng Wi-Fi: `http://<IP-máy-chủ>:3000` (xem IP bằng `ipconfig`)

---

## 3. Checklist máy-làm-server (bắt buộc trước khi dùng thật)

- [ ] **Tắt chế độ Sleep**: Settings → System → Power → "When plugged in, put my device to sleep" → **Never**.
- [ ] **Docker Desktop tự khởi động**: Docker Desktop → Settings → General → bật "Start Docker Desktop when you sign in".
- [ ] Container có `restart: unless-stopped` — Docker bật lại là app tự chạy.
- [ ] **Đăng ký backup hằng ngày** (chạy 1 lần, quyền Administrator):
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\dang-ky-backup-hang-ngay.ps1
  ```
- [ ] **Đồng bộ thư mục `backups\` ra nơi thứ hai** (Google Drive/USB). Ổ cứng hỏng = mất toàn bộ hóa đơn nếu bỏ qua bước này.
- [ ] Đặt IP tĩnh cho máy chủ trong router (để địa chỉ `http://<IP>:3000` không đổi).
- [ ] Đổi toàn bộ mật khẩu mặc định của tài khoản mẫu.

---

## 4. Sao lưu & phục hồi

**Sao lưu tay:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
# → backups\hoadon_YYYY-MM-dd_HHmm.sql.gz (tự giữ 30 bản gần nhất)
```

**Phục hồi từ backup** (XÓA toàn bộ dữ liệu hiện tại — chắc chắn rồi mới chạy):
```powershell
# Giải nén rồi nạp vào DB
docker exec -i hoadon-db sh -c "dropdb -U hoadon web_xuat_hoa_don && createdb -U hoadon web_xuat_hoa_don"
Get-Content backups\hoadon_<ten-file>.sql.gz -AsByteStream -Raw | docker exec -i hoadon-db sh -c "gunzip | psql -U hoadon web_xuat_hoa_don"
```

---

## 5. Sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| App báo "Đã xảy ra lỗi hệ thống" khi đăng nhập | DB chưa chạy. Kiểm tra `docker ps` — nếu không thấy `hoadon-db`, chạy `docker compose up -d db`. Docker Desktop có thể chưa bật. |
| `Can't reach database server at localhost:5433` | Như trên — Docker Desktop tắt hoặc container chưa lên. |
| Máy khác trong LAN không vào được | Windows Firewall chặn port 3000: mở PowerShell Admin → `New-NetFirewallRule -DisplayName "HoaDon" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow` |
| Trùng port 5433 | Sửa port trong `docker-compose.yml` và `DATABASE_URL` trong `.env` cho khớp nhau. |
