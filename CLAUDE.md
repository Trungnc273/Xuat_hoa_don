@AGENTS.md
@CONSTITUTION.md

---

# Bộ nhớ ngữ cảnh dự án (DNA)

> Đọc file này để hiểu *tại sao* hệ thống trông như hiện tại, không chỉ *nó là gì*.
> Cập nhật file này khi có quyết định kiến trúc mới hoặc bài học mới — đừng để nó lỗi thời.

## Kiến trúc hệ thống (tóm tắt)

Next.js 16 monolith: `src/app/(dashboard)` = giao diện, `src/app/api` = API nội bộ, `prisma/` = schema
CSDL PostgreSQL. Không có service riêng biệt. Xác thực bằng JWT tự ký lưu trong cookie HttpOnly, middleware
(`src/middleware.ts`) chặn trang chưa đăng nhập ở tầng route.

Nghiệp vụ lõi: Khách hàng/NCC → Sản phẩm+Kho → Báo giá → **chuyển đổi thành** Hóa đơn → Phiếu thu (cập nhật
công nợ hóa đơn). Song song có Phiếu chi, Chi phí, Nhật ký hoạt động, Cài đặt công ty (dùng cho VietQR).

Triển khai: Docker Compose, 2 chế độ —
- **dev**: `docker compose up -d db` (chỉ DB, port 5433) + `npm run dev` (app chạy trực tiếp trên máy)
- **prod**: `docker compose --profile prod up -d --build` (DB + migrate + app đều trong Docker, port 3000)

Chi tiết đầy đủ: xem `DANH-GIA-VA-LO-TRINH.md` (báo cáo đánh giá gốc) và `HUONG-DAN-CAI-DAT.md` (vận hành).

## Quyết định kiến trúc (ADR log)

### ADR-001 — Không tách FE/BE thành 2 server riêng
**Ngày:** 02/07/2026. **Quyết định:** Giữ nguyên monolith Next.js, phân tầng logic bên trong (Route →
Validation → Service → Prisma) thay vì tách hạ tầng. **Lý do:** quy mô MVP nội bộ không cần độ phức tạp
vận hành của kiến trúc phân tán; tách sớm chỉ tạo chi phí không có lợi ích tương xứng.

### ADR-002 — Không xây SaaS/multi-tenant ngay, chỉ "để cửa"
**Ngày:** 02/07/2026. **Quyết định:** Bán theo mô hình cài riêng từng doanh nghiệp (on-premise/self-hosted),
không xây bản thuê bao tháng. Chỉ thêm cột `organizationId` khi tạo bảng mới ở Giai đoạn 2 để không tự khóa
đường, không xây logic cách ly tenant đầy đủ. **Lý do:** chi tiết ở `DANH-GIA-VA-LO-TRINH.md` Mục 0b —
chi phí kỹ thuật SaaS vượt sức đội 1 người; phân khúc khách hàng (xưởng/hộ kinh doanh nhỏ) không hợp thuê bao.

### ADR-003 — Triển khai nội bộ: máy cá nhân làm server, Docker hóa từ đầu
**Ngày:** 02/07/2026. **Quyết định:** Giai đoạn đầu chạy trên máy cá nhân của chủ cửa hàng (mạng LAN), đóng
gói Docker ngay từ đầu để việc chuyển sang VPS sau này chỉ là đổi máy chủ, không đổi cách cài.
**Hệ quả bắt buộc:** backup tự động hằng ngày ra nơi thứ hai (xem `scripts/backup-db.ps1`), tắt sleep máy,
Docker Desktop tự khởi động.

## Bài học kinh nghiệm (Lessons Learned)

- **02/07/2026 — Lỗi phân quyền im lặng nguy hiểm nhất khi nó "trông như hoạt động".**
  `verifyJWT()` trong `src/lib/auth.ts` từng ghi đè cứng `role: 'ADMIN'` bất kể token thật chứa gì. App chạy
  bình thường, không báo lỗi, nhưng toàn bộ RBAC vô nghĩa. **Bài học:** khi review code xác thực/phân quyền,
  phải viết test đăng nhập bằng tài khoản KHÔNG phải admin và xác nhận bị chặn đúng chỗ — không chỉ test
  đường "happy path" bằng tài khoản admin.
- **02/07/2026 — Sinh mã bằng `count()+1` là bẫy race condition kinh điển.** Nhìn qua thấy đúng (test 1
  người dùng không phát hiện được), chỉ vỡ khi có ≥2 người thao tác đồng thời hoặc có bản ghi bị xóa.
  **Bài học:** mọi mã định danh nghiệp vụ (invoice code, order code...) phải sinh trong transaction có khóa,
  không suy ra từ phép đếm.
- **02/07/2026 — Cổng 5432 xung đột với container Postgres của dự án khác trên cùng máy dev.** Đặt Postgres
  của dự án này ở cổng 5433 để cô lập. **Bài học:** trên máy dev dùng chung cho nhiều dự án, không giả định
  cổng mặc định còn trống — luôn kiểm tra `docker ps` trước khi gán cổng.
- **02/07/2026 — `npm run dev` treo tiến trình cũ vẫn giữ cổng 3000 sau khi "tắt".** Khi chuyển từ dev sang
  chạy Docker prod, phải chủ động kill process node cũ trước, không chỉ dừng background task trong tool.

- **03/07/2026 — Sinh mã tuần tự hóa transaction → phải nới maxWait/timeout.** Khi chuyển sinh mã vào
  transaction (khóa row bộ đếm), 10 request đồng thời xếp hàng tuần tự; Prisma mặc định chỉ chờ 2s để vào
  transaction nên 3 request cuối fail "Unable to start a transaction". Giải pháp: `{ maxWait: 10000,
  timeout: 20000 }` cho các transaction nặng (tạo hóa đơn, convert). **Bài học:** thêm khóa tuần tự thì
  phải nghĩ ngay đến hàng đợi phía sau nó.

## Việc đang dang dở / điểm tiếp theo

- Giai đoạn 0 (nền tảng vận hành) đã xong: Docker hóa, backup, hướng dẫn cài đặt.
- **Giai đoạn 1 đã xong (03/07/2026)**: vá 3 lỗi nghiêm trọng + lỗi G (JWT_SECRET) + lỗi H (nuốt lỗi sinh mã).
  Kiểm chứng 10/10 PASS bằng `scripts/verify-gd1.mjs`. Nghiệp vụ đã chốt: cho phép bán âm kho (cảnh báo,
  không chặn); convert báo giá có trừ kho.
- **Tiếp theo: Giai đoạn 2** — phân tầng Service + Zod validation + `organizationId` + chuyển middleware →
  proxy (Next 16 deprecated middleware). Cần viết SPEC mới theo template trước khi làm.
- Vai trò hệ thống hiện dùng: ADMIN, MANAGER, ACCOUNTANT, STAFF (đã xác nhận đúng nhu cầu người dùng).
- Git: repo https://github.com/Trungnc273/Xuat_hoa_don (private), quy ước mỗi task một commit.
