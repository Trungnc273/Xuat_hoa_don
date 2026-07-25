# Hướng dẫn cài đặt, chạy & demo

> Dành cho người mới nhận dự án hoặc cài cho khách hàng mới. Cập nhật: 09/07/2026 (sau nâng cấp GĐ1: dashboard lọc ngày, báo giá theo SĐT, mô tả từng dòng báo giá, ẩn barcode).

## 0. Yêu cầu máy

| Thành phần | Bắt buộc | Ghi chú |
|---|---|---|
| Docker Desktop | ✅ (luôn luôn) | Cách cài: https://www.docker.com/products/docker-desktop — đủ để chạy bản production |
| Node.js 22 | ❌ Không cần trên máy khách dùng thật | Chỉ dùng khi lập trình, hoặc 1 lần lúc gieo dữ liệu ban đầu qua Cách A ở mục 2 (Cách B/USB không cần) |
| Git | ❌ Không cần trên máy khách dùng thật | Chỉ dùng khi lập trình (kéo code từ https://github.com/Trungnc273/Xuat_hoa_don). Cài qua USB (mục 2b) không cần Git |
| ngrok | Chỉ khi demo khách | Xem mục 5 — **không** dùng cho vận hành thật |

Máy tối thiểu: 8GB RAM (Docker Desktop chiếm ~2–3GB), Windows 10/11.

**Tóm tắt cho máy khách dùng thật (không phải máy dev):** chỉ cần cài **Docker Desktop**. Git/Node chỉ cần
nếu bàn giao bằng cách kéo mã nguồn (mục 2); nếu bàn giao bằng gói ảnh Docker qua USB (mục 2b — cách khuyến
nghị khi bán cho khách, vì không lộ mã nguồn theo `ADR-002`) thì máy khách không cần cài gì khác ngoài Docker.

---

## 1. Cài cho máy phát triển (dev)

```bash
git clone https://github.com/Trungnc273/Xuat_hoa_don.git
cd Xuat_hoa_don
npm install

# Tạo file .env (sao chép từ .env.example) với nội dung:
#   DATABASE_URL="postgresql://hoadon:hoadon_dev_2026@localhost:5433/web_xuat_hoa_don?schema=public"
#   JWT_SECRET=<chuỗi ngẫu nhiên dài ít nhất 32 ký tự — KHÔNG dùng giá trị mẫu>
#   NEXT_PUBLIC_APP_URL="http://localhost:3000"

docker compose up -d db      # bật PostgreSQL (port 5433)
npx prisma migrate dev       # tạo bảng
npx prisma db seed           # dữ liệu mẫu + tài khoản mặc định
npm run dev                  # → http://localhost:3000
```

**Cập nhật code mới trên máy dev đã cài sẵn:**
```bash
git pull
npm install                  # chỉ cần khi package-lock.json thay đổi
docker compose up -d db
npx prisma migrate dev       # áp migration mới, ví dụ mô tả từng dòng báo giá
npm run dev
```

**Tài khoản mẫu sau khi seed** (đổi hết mật khẩu khi dùng thật):

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| admin | admin123 | ADMIN — toàn quyền, có màn Quản lý tài khoản (/users) |
| manager | manager123 | MANAGER — khách hàng, sản phẩm, kho, báo giá, hóa đơn |
| accountant | accountant123 | ACCOUNTANT — hóa đơn, thu/chi, công nợ |
| staff | staff123 | STAFF — bán hàng, chỉ thấy chứng từ mình tạo |

**Kiểm tra sức khỏe hệ thống** (app phải đang chạy):
```bash
node scripts/verify-gd1.mjs && node scripts/verify-gd2.mjs && node scripts/verify-gd3.mjs
node scripts/verify-mvp.mjs            # trọn luồng nghiệp vụ
```

---

## 2. Cài cho máy cửa hàng (production nội bộ — trọn trong Docker)

```bash
# 1. File .env chỉ cần một dòng (bắt buộc):
#    JWT_SECRET=<chuỗi ngẫu nhiên dài ít nhất 32 ký tự>

# 2. Build và chạy trọn bộ (DB + migrate tự động + app)
docker compose --profile prod up -d --build
```

**Gieo dữ liệu ban đầu (chỉ lần đầu cài):** chọn 1 trong 2:

```powershell
# Cách A — máy có Node.js: chạy seed trỏ vào DB trong Docker
# QUAN TRỌNG: phải npm install trước — nếu bỏ qua, seed sẽ báo lỗi hoặc
# không tạo được tài khoản, dẫn tới đăng nhập báo "sai tài khoản/mật khẩu"
# dù gõ đúng admin/admin123 (không có tài khoản nào trong DB để so khớp).
npm install
npx prisma generate
$env:DATABASE_URL = "postgresql://hoadon:hoadon_dev_2026@localhost:5433/web_xuat_hoa_don?schema=public"
npx prisma db seed

# Cách B — phục hồi từ file backup của máy khác (xem mục 4)
```

**Kiểm tra seed đã chạy đúng chưa:**
```powershell
docker exec hoadon-db psql -U hoadon web_xuat_hoa_don -c "SELECT username FROM users;"
# Phải thấy 4 dòng: admin, manager, accountant, staff. Nếu ra 0 dòng — chạy lại seed ở trên.
```

- Máy chủ mở: `http://localhost:3000`
- Máy khác trong cùng Wi-Fi: `http://<IP-máy-chủ>:3000` (xem IP: `ipconfig`, dòng IPv4)

**Cập nhật phiên bản mới:**
```bash
git pull
docker compose --profile prod up -d --build   # migrate chạy tự động trước khi app lên
```

Ghi chú: bản cập nhật 09/07/2026 có migration thêm trường mô tả/thông số cho từng dòng báo giá. Lệnh production ở trên đã chạy migrate tự động; máy dev cần chạy `npx prisma migrate dev` sau khi pull.

---

## 2b. Cài cho máy khách qua USB — KHÔNG cần Git, KHÔNG cần mã nguồn

Dùng khi bàn giao cho khách hàng thật: khách chỉ nhận file, không nhận mã nguồn (đúng mô hình bán "cài
riêng từng doanh nghiệp" — `ADR-002` trong `CLAUDE.md`). Máy khách **chỉ cần cài Docker Desktop**, không
cần Node.js, không cần Git.

**Chuẩn bị gói cài đặt (làm trên máy dev, 1 lần cho mỗi bản phát hành):**

```bash
# 1. Build image production
docker compose --profile prod build

# 2. Đóng gói cả 3 image thành 1 file .tar.gz để chép qua USB
docker save hoadon-app:latest hoadon-migrate:latest postgres:16-alpine | gzip > release/hoadon-images-<ngay>.tar.gz

# 3. Tạo bản backup CSDL sạch (không lẫn dữ liệu test) để khách có sẵn dữ liệu mẫu/tài khoản mặc định
#    — dùng scripts/backup-db.ps1 chạy nhắm vào một DB vừa migrate+seed sạch, KHÔNG dùng DB dev đang thao tác thử
```

Gói cài đặt hoàn chỉnh chép ra USB gồm:
```
release/
├── hoadon-images-<ngay>.tar.gz   # 3 image Docker (app + migrate + postgres), vài trăm MB
├── hoadon-seed-sach.sql.gz       # backup CSDL sạch: 4 tài khoản mặc định + vài dữ liệu mẫu
├── docker-compose.yml            # bản có sẵn image: hoadon-app:latest / hoadon-migrate:latest (đã pin tên)
└── scripts/
    ├── backup-db.ps1
    └── dang-ky-backup-hang-ngay.ps1
```

**Trên máy khách (chỉ cần Docker Desktop đã cài, KHÔNG cần Git/Node/mã nguồn):**

```powershell
# 1. Chép cả thư mục release\ vào máy khách, ví dụ C:\HoaDon\
cd C:\HoaDon

# 2. Nạp 3 image vào Docker máy khách (chỉ 1 lần)
docker load -i hoadon-images-<ngay>.tar.gz

# 3. Tạo file .env cạnh docker-compose.yml, nội dung 1 dòng:
#    JWT_SECRET=<chuỗi ngẫu nhiên dài ít nhất 32 ký tự — tự sinh riêng cho khách này, đừng dùng lại của máy khác>

# 4. Bật DB trước để phục hồi dữ liệu sạch vào đó
docker compose up -d db

# 5. Phục hồi dữ liệu mẫu (xem mục 4 — cùng quy trình phục hồi backup, chỉ khác tên file)
docker exec -i hoadon-db sh -c "dropdb -U hoadon web_xuat_hoa_don && createdb -U hoadon web_xuat_hoa_don"
Get-Content hoadon-seed-sach.sql.gz -AsByteStream -Raw | docker exec -i hoadon-db sh -c "gunzip | psql -U hoadon web_xuat_hoa_don"

# 6. Bật trọn bộ — KHÔNG có --build (không có Dockerfile/mã nguồn ở đây, chỉ dùng image đã nạp ở bước 2)
docker compose --profile prod up -d

# 7. Kiểm tra
docker exec hoadon-db psql -U hoadon web_xuat_hoa_don -c "SELECT username FROM users;"
# → mở http://localhost:3000, đăng nhập admin/admin123, ĐỔI MẬT KHẨU NGAY (xem checklist mục 3)
```

**Cập nhật phiên bản mới cho khách đã cài qua USB:** lặp lại "Chuẩn bị gói cài đặt" ở trên với bản code mới,
gửi file `hoadon-images-<ngay-moi>.tar.gz` mới cho khách (không cần gửi lại `docker-compose.yml`/dữ liệu),
khách chạy `docker load -i hoadon-images-<ngay-moi>.tar.gz` rồi `docker compose --profile prod up -d`
(Compose tự nhận ra image mới trùng tên `hoadon-app:latest`/`hoadon-migrate:latest`, không cần down trước).

⚠️ **Vì sao phải có `image:` tường minh trong `docker-compose.yml`:** nếu bỏ trống, Docker Compose tự suy
tên image từ tên thư mục chứa file (ví dụ khách đặt thư mục `C:\HoaDon` thay vì `webxuathoadon`), khiến
`docker compose up` không tìm thấy image vừa `docker load` và **âm thầm cố build lại** — nhưng máy khách
không có Dockerfile/mã nguồn nên sẽ báo lỗi. Đã cố định tên image trong `docker-compose.yml` (`image:
hoadon-app:latest`, `image: hoadon-migrate:latest`) để khách đặt thư mục tên gì cũng chạy được — đã kiểm
chứng bằng cách chạy `docker compose --profile prod up -d` (không `--build`) trong thư mục trống hoàn
toàn không có mã nguồn, chỉ có `docker-compose.yml` đã nạp sẵn image, và app lên đúng (`GET /login` → 200).

---

## 3. Checklist máy-làm-server (bắt buộc trước khi dùng thật)

- [ ] **Tắt Sleep**: Settings → System → Power → "put my device to sleep" → **Never**.
- [ ] **Docker Desktop tự khởi động**: Docker Desktop → Settings → General → "Start Docker Desktop when you sign in".
- [ ] **Đăng ký backup tự động 21:00 hằng ngày** (chạy 1 lần, PowerShell quyền Administrator):
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\dang-ky-backup-hang-ngay.ps1
  ```
- [ ] **Đồng bộ thư mục `backups\` ra nơi thứ hai** (Google Drive/USB) — ổ cứng hỏng = mất toàn bộ hóa đơn nếu bỏ qua.
- [ ] Đặt **IP tĩnh** cho máy chủ trong router.
- [ ] Mở firewall cho máy khác trong LAN (PowerShell Admin):
  ```powershell
  New-NetFirewallRule -DisplayName "HoaDon" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
  ```
- [ ] **Đổi toàn bộ mật khẩu mặc định**: đăng nhập admin → menu "Quản lý tài khoản" → Đặt lại mật khẩu từng tài khoản.

---

## 4. Sao lưu & phục hồi

**Sao lưu tay:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
# → backups\hoadon_YYYY-MM-dd_HHmm.sql.gz (tự giữ 30 bản gần nhất)
```

**Phục hồi từ backup** (XÓA toàn bộ dữ liệu hiện tại — chắc chắn rồi mới chạy):
```powershell
docker exec -i hoadon-db sh -c "dropdb -U hoadon web_xuat_hoa_don && createdb -U hoadon web_xuat_hoa_don"
Get-Content backups\hoadon_<ten-file>.sql.gz -AsByteStream -Raw | docker exec -i hoadon-db sh -c "gunzip | psql -U hoadon web_xuat_hoa_don"
```

---

## 5. Demo nhanh cho khách xem (ngrok — public tạm ra Internet)

Khi muốn cho khách xem app đang chạy trên máy mình mà không cần VPS:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo-ngrok.ps1
```

Script sẽ: kiểm tra ngrok đã cài (in hướng dẫn cài nếu chưa) → kiểm tra app đang chạy → **nhắc đổi mật khẩu mặc định** → mở tunnel và in URL công khai dạng `https://xxxx.ngrok-free.app` để gửi khách.

**Cài ngrok lần đầu (1 lần duy nhất):**
1. `winget install ngrok.ngrok` (hoặc tải từ https://ngrok.com/download)
2. Đăng ký tài khoản free tại https://dashboard.ngrok.com
3. `ngrok config add-authtoken <token-của-bạn>`

⚠️ **Giới hạn cần biết:**
- Chỉ dùng **demo tạm thời** — đóng cửa sổ ngrok là link chết; bản free mỗi lần chạy ra URL khác.
- Trong lúc demo, ai có URL đều thấy trang đăng nhập → **bắt buộc đổi mật khẩu mặc định trước**.
- Muốn chạy thật qua Internet lâu dài → thuê VPS (xem `DANH-GIA-VA-LO-TRINH.md` Mục 0b), KHÔNG dùng ngrok.

---

## 6. Sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Đăng nhập báo "Tài khoản hoặc mật khẩu không chính xác" dù gõ đúng `admin/admin123` | Chưa seed dữ liệu hoặc seed thất bại (thường do quên `npm install` trước khi chạy seed — xem mục 2). Kiểm tra: `docker exec hoadon-db psql -U hoadon web_xuat_hoa_don -c "SELECT username FROM users;"` — ra 0 dòng thì chạy lại seed. |
| Đăng nhập báo "Đã xảy ra lỗi hệ thống" | DB chưa chạy. `docker ps` không thấy `hoadon-db` → `docker compose up -d db`. Docker Desktop có thể chưa bật. |
| `Can't reach database server at localhost:5433` | Như trên. |
| App không lên, port 3000 bận | Tiến trình node cũ còn giữ port: PowerShell Admin → `Get-NetTCPConnection -LocalPort 3000 \| % { Stop-Process -Id $_.OwningProcess -Force }` rồi chạy lại. |
| Máy khác trong LAN không vào được | Firewall chưa mở port 3000 — xem mục 3. |
| Sinh mã hóa đơn báo trùng (P2002) | Bộ đếm lệch do phục hồi backup cũ. Đồng bộ lại: xem SQL resync trong `CLAUDE.md` (bài học 03/07/2026). |
| ngrok báo cần authtoken | Chưa chạy `ngrok config add-authtoken` — xem mục 5. |
