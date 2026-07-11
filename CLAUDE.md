@AGENTS.md
@CONSTITUTION.md

---

# Bộ nhớ ngữ cảnh dự án (DNA)

> Đọc file này để hiểu *tại sao* hệ thống trông như hiện tại, không chỉ *nó là gì*.
> Cập nhật file này khi có quyết định kiến trúc mới hoặc bài học mới — đừng để nó lỗi thời.

## Kiến trúc hệ thống (tóm tắt)

Next.js 16 monolith: `src/app/(dashboard)` = giao diện, `src/app/api` = API nội bộ, `prisma/` = schema
CSDL PostgreSQL. Không có service riêng biệt. Xác thực bằng JWT tự ký lưu trong cookie HttpOnly, middleware
(`src/proxy.ts`) chặn trang chưa đăng nhập ở tầng route.

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

- **03/07/2026 — Bắt buộc env var lúc nạp module làm vỡ `next build` trong Docker.** Ném lỗi thiếu
  `JWT_SECRET` ở top-level module khiến build stage (không có env runtime) chết. Giải pháp: kiểm tra lười
  trong hàm `getJwtSecret()` — vẫn chặn runtime, không chặn build.
- **03/07/2026 — Verify phải chắc chắn mình đang gọi đúng tiến trình.** Một dev server mồ côi giữ port 3000
  khiến "verify prod" thực chất chạy trên dev (kết quả đẹp giả), còn container prod không lên được vì kẹt
  port; đồng thời log build bị cắt (`| tail -3`) che mất lỗi build fail. **Bài học:** trước khi verify,
  xác nhận tiến trình phục vụ port (docker ps + kill node mồ côi); không pipe-cắt log của lệnh có thể fail.
- **03/07/2026 — Trộn 2 phiên bản code trên cùng DB làm lệch bộ đếm mã.** Ảnh cũ (count()+1) tạo chứng từ
  vượt xa `document_counters` → ảnh mới sinh mã trùng (P2002). Đã có sẵn SQL resync bộ đếm theo MAX(code)
  từng bảng (xem lịch sử chat 03/07 hoặc migration backfill làm mẫu) — chạy khi nghi ngờ lệch.
- **04/07/2026 — [ĐÃ SỬA] Bug thật: seed.ts tạo mã cứng (SP000001...) TRƯỚC khi document_counters biết đến chúng.**
  Migration backfill bộ đếm chạy lúc DB còn RỖNG (trước seed) → counter = 0, nhưng seed lại tạo sản phẩm/
  khách hàng/NCC/kho với mã cứng. Lần đầu tạo mới qua UI, bộ đếm tăng lên 1 → sinh lại đúng mã đã bị seed
  chiếm → lỗi P2002 trên `code`, nhưng message cũ gộp chung thành "SKU/Barcode đã tồn tại" khiến chủ dự án
  tưởng nhầm là lỗi double-submit (giả thuyết ban đầu SAI, đã sửa sau khi xem log thật). **Bài học kép:**
  (1) mọi migration backfill dựa trên dữ liệu hiện có phải chạy SAU cùng, hoặc seed phải tự đồng bộ lại
  counter ở bước cuối (đã thêm `resyncCounter()` vào seed.ts) — không giả định thứ tự chạy; (2) thông báo
  lỗi P2002 phải phân biệt theo `error.meta.target`, không gộp chung nhiều nguyên nhân vào 1 message —
  gộp chung khiến chẩn đoán sai hướng, phải xin log thật mới lộ ra nguyên nhân đúng.
- **04/07/2026 — Form không khóa nút Lưu → double-submit trùng SKU/barcode qua ngrok.** Khách demo qua
  ngrok (độ trễ cao hơn localhost) bấm "Lưu sản phẩm" nhiều lần vì modal đóng chậm → request 2 tạo trùng
  SKU với request 1 vừa thành công, nhận nhầm lỗi "SKU đã tồn tại" tưởng là bug dữ liệu trong khi sản phẩm
  đã tạo thành công từ lần bấm đầu. **Bài học:** mọi form ghi dữ liệu phải có state `saving` khóa nút submit
  ngay khi bấm — không chỉ để UX đẹp, mà để loại cả một lớp lỗi "trùng dữ liệu giả" gây hiểu lầm là bug backend.
- **03/07/2026 — Hướng dẫn cài prod bỏ sót `npm install` trước bước seed.** Khách hàng đầu tiên clone
  repo, làm đúng `HUONG-DAN-CAI-DAT.md` nhưng chạy thẳng `npx prisma db seed` mà chưa `npm install` →
  seed không tạo được tài khoản (bảng `users` rỗng), đăng nhập báo "sai tài khoản/mật khẩu" — dễ hiểu lầm
  là lỗi app trong khi DB đơn giản là trống. **Bài học:** tài liệu hướng dẫn phải tự đủ điều kiện tiên
  quyết ở từng bước, không giả định người đọc suy ra được; luôn kèm câu lệnh kiểm tra kết quả (ví dụ
  `SELECT username FROM users`) ngay sau bước có thể âm thầm thất bại.

- **11/07/2026 — Audit toàn bộ src sau đợt tính năng mới (price tiers, backup, quotation workspace).**
  Tìm thấy và sửa: (1) DELETE /api/invoices/[id] xóa CỨNG chứng từ và KHÔNG hoàn kho — vi phạm
  CONSTITUTION Layer 1.2, đã chuyển thành hủy mềm (CANCELLED) + hoàn kho, giữ nguyên endpoint;
  (2) PUT invoice/quotation nhận status chuỗi tùy ý — đã whitelist enum; (3) sửa được báo giá đã
  CONVERTED gây lệch số với hóa đơn đã sinh — đã chặn. **Bài học:** mỗi đợt thêm tính năng phải audit
  lại các route [id] (sửa/xóa) — code sinh nhanh hay quên ràng buộc chứng từ tài chính của Layer 1.2.

## Việc đang dang dở / điểm tiếp theo

- Giai đoạn 0 (nền tảng vận hành) đã xong: Docker hóa, backup, hướng dẫn cài đặt.
- **Giai đoạn 1 đã xong (03/07/2026)**: vá 3 lỗi nghiêm trọng + lỗi G (JWT_SECRET) + lỗi H (nuốt lỗi sinh mã).
  Kiểm chứng 10/10 PASS bằng `scripts/verify-gd1.mjs`. Nghiệp vụ đã chốt: cho phép bán âm kho (cảnh báo,
  không chặn); convert báo giá có trừ kho.
- **Giai đoạn 2 đã xong (03/07/2026)**: khung src/server (http/auth/activity-log), Zod validators, services
  (invoice core dùng chung cho tạo trực tiếp + convert), Organization/organizationId (nullable, chưa dùng),
  middleware → proxy. Verify GĐ1 10/10 + GĐ2 4/4 trên dev lẫn prod Docker.
- **Giai đoạn 3 đã xong (03/07/2026)**: RBAC theo bảng Permission (src/server/rbac.ts, cache 60s), màn
  Quản lý tài khoản /users cho ADMIN (tạo/đổi vai trò/đặt lại mật khẩu; không xóa, không tự đổi vai trò),
  đóng /register công khai, proxy verify JWT bằng WebCrypto, upload chỉ ảnh ≤5MB. Verify 22/22.
- **Giai đoạn 4 đã xong (03/07/2026) — MVP HOÀN THÀNH**: cache in-memory (src/server/cache.ts, dashboard 30s
  + settings/categories 5ph với invalidation chủ động), verify-mvp.mjs 9/9 (trọn luồng nghiệp vụ + smoke
  16 trang × 4 vai trò + restart container), scripts/demo-ngrok.ps1 (public demo tạm), HUONG-DAN-CAI-DAT.md
  hoàn chỉnh. Tổng verify: 31/31 PASS trên prod Docker.
- **Backlog sau MVP**: user tự đổi mật khẩu, khóa tài khoản (isActive), chuyển uploads sang dịch vụ ngoài
  khi lên VPS, tích hợp hóa đơn điện tử (MISA/Viettel) khi khách yêu cầu.
- Vai trò hệ thống hiện dùng: ADMIN, MANAGER, ACCOUNTANT, STAFF (đã xác nhận đúng nhu cầu người dùng).
- Git: repo https://github.com/Trungnc273/Xuat_hoa_don (private), quy ước mỗi task một commit.
