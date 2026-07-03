# Báo cáo đánh giá dự án & Lộ trình đưa lên MVP

> Dự án: **Web Quản lý & Xuất hóa đơn** (Next.js 16 + Prisma + PostgreSQL)
> Ngày đánh giá: 02/07/2026
> Phạm vi: Đọc toàn bộ kiến trúc, schema CSDL, tầng xác thực và các API nghiệp vụ chính.
> Nguyên tắc: Mọi kết luận đều kèm **bằng chứng cụ thể trong mã nguồn** (ghi rõ file).

---

## 0. Tóm tắt cho người quản lý (đọc phần này là đủ nắm)

- Đây là app quản lý bán hàng + xuất hóa đơn **đã gần đủ tính năng của một MVP**. Không cần làm lại từ đầu.
- Nhưng **base code chưa an toàn để dùng thật**, vì có 3 lỗi nghiêm trọng: (1) phân quyền bị vô hiệu hóa — ai đăng nhập cũng thành ADMIN, (2) mã hóa đơn/chứng từ dễ bị trùng, (3) bán vượt tồn kho mà không cảnh báo.
- Kiến trúc thư mục ổn, nhưng **logic nghiệp vụ nằm rải rác trong từng API**, thiếu tầng kiểm tra dữ liệu (validation) và tầng dịch vụ (service). Đây là thứ cần chuẩn hóa để "base code ổn".
- **Kết luận:** Không đập đi xây lại. Củng cố kiến trúc theo hướng phân tầng rõ ràng + vá 3 lỗi nặng + thêm validation. Ước lượng đưa lên MVP ổn định: **theo 4 giai đoạn** ở Mục 6.

---

## 0b. Định vị sản phẩm & bối cảnh triển khai (đã chốt với chủ dự án 02/07/2026)

**Sản phẩm là gì:** Phần mềm quản lý bán hàng + chứng từ **nội bộ** cho cửa hàng nhỏ, xưởng, hộ kinh doanh. Một người có thể kiêm nhiều vai trò.

**Lưu ý pháp lý (quan trọng khi chào khách):** "Hóa đơn" trong app là **chứng từ quản lý nội bộ**, KHÔNG phải hóa đơn điện tử hợp pháp theo Nghị định 123/Thông tư 78 (loại phải phát hành qua nhà cung cấp được Tổng cục Thuế chấp thuận). Nếu khách cần xuất hóa đơn thuế, hướng đi là **tích hợp API của MISA/Viettel/VNPT**, không tự xây. Việc này chỉ làm khi có khách thật yêu cầu.

**Mô hình triển khai:**
- Giai đoạn đầu: chạy trên **máy cá nhân của chủ cửa hàng, làm server trong mạng LAN** (Wi-Fi cửa hàng). Không thuê VPS.
- Đóng gói bằng **Docker** (app + PostgreSQL) → sau này chuyển lên VPS cho khách lớn chỉ là đổi máy, không đổi cách cài.
- Docker giúp máy cá nhân ≈ VPS về mặt cài đặt, nhưng **khác về vận hành**: máy cá nhân phải tắt chế độ sleep, đặt Docker tự khởi động cùng máy, và **bắt buộc backup tự động ra nơi thứ hai** (USB/Google Drive) — ổ cứng hỏng là mất toàn bộ dữ liệu hóa đơn. Khi lên VPS (lộ Internet) mới cần thêm HTTPS + tường lửa + secret mạnh.
- Vì dùng nội bộ: **đóng trang đăng ký công khai `/register`** — chỉ Admin được tạo tài khoản nhân viên.

**Định hướng kinh doanh (đã phân tích, kết luận):**
- ❌ **KHÔNG làm SaaS bán gói theo tháng** ở giai đoạn này. Lý do: chi phí kỹ thuật rất nặng (multi-tenant, thanh toán định kỳ, hỗ trợ 24/7, bảo mật Internet) vượt sức đội 1 người; phân khúc xưởng/hộ kinh doanh thích trả 1 lần + dữ liệu trên máy của họ; thị trường SaaS đã có KiotViet/Sapo/MISA cạnh tranh trực diện là bất lợi.
- ✅ **Mô hình chọn: cài riêng từng doanh nghiệp** (bán bộ cài + phí tùy chỉnh/bảo trì theo từng xưởng). Đây là lợi thế mà SaaS lớn không làm được; Docker khiến chi phí nhân bản mỗi khách rất thấp.
- 🚪 **"Để cửa" cho tương lai:** thêm cột `organizationId` vào schema ngay từ Giai đoạn 2 (chi phí vài giờ). Nếu sau này đông khách và muốn thử bản cloud thì không phải đập lại CSDL.

---

## 1. Dự án hiện có gì (khảo sát thực tế)

Thống kê từ mã nguồn: **30 API route**, **18 trang giao diện**, ~**8.000 dòng** ở phần trang.

Các nghiệp vụ đã tồn tại (theo `prisma/schema.prisma` và thư mục `src/app/api`):

| Nhóm | Có sẵn |
|---|---|
| Đối tác | Khách hàng, Nhà cung cấp |
| Hàng hóa | Sản phẩm, Danh mục, Kho, Nhập/Xuất/Kiểm kho (StockMovement) |
| Bán hàng | Báo giá → chuyển đổi thành Hóa đơn, Phiếu thu |
| Chi tiêu | Phiếu chi (Payment), Chi phí (Expense), Công nợ (Debts) |
| Hệ thống | Đăng nhập/đăng ký (JWT), Vai trò & Quyền, Nhật ký hoạt động, Cài đặt công ty, Thông báo |
| Tiện ích | VietQR động, Import/Export sản phẩm bằng Excel, Upload file |

**Nhận định:** Bề rộng tính năng tốt. Vấn đề là **chiều sâu chất lượng**.

---

## 2. Lỗi NGHIÊM TRỌNG (phải sửa trước khi dùng thật)

### 🔴 A. Toàn bộ phân quyền bị vô hiệu hóa — mọi người dùng đều là ADMIN
**Bằng chứng:** `src/lib/auth.ts`, hàm `verifyJWT` ghi đè cứng vai trò:
```ts
if (decoded) {
  return { ...decoded, role: 'ADMIN' };   // luôn trả ADMIN, bất kể vai trò thật
}
```
Lỗi lặp lại ở `src/app/api/auth/login/route.ts` và `src/app/api/auth/me/route.ts` (đều trả `role: 'ADMIN'`).

**Hậu quả:** Mọi kiểm tra quyền trong các API — ví dụ `['ADMIN','MANAGER','ACCOUNTANT'].includes(session.role)` trong `receipts/route.ts`, hay `if (session.role === 'STAFF')` trong `invoices/route.ts` — **luôn chạy như ADMIN**. Một nhân viên vẫn thu tiền, xóa dữ liệu, xem toàn bộ hóa đơn. Cả module Role/Permission trong seed trở nên vô nghĩa.

**Vì sao quan trọng với bạn:** Bạn nói cần nhiều vai trò khác nhau — hiện tại tính năng đó **hoàn toàn không hoạt động**, chỉ có trên giấy.

### 🔴 B. Sinh mã chứng từ bằng cách đếm số bản ghi → dễ trùng mã
**Bằng chứng:** `src/lib/utils.ts`, hàm `generateDocumentCode` dùng `count() + 1`:
```ts
count = await prisma.invoice.count();
const nextNumber = count + 1;   // HD000001, HD000002...
```
**Hậu quả:**
- Hai người tạo hóa đơn cùng lúc → cùng nhận `HD000005` → lỗi trùng khóa `unique`, một giao dịch thất bại.
- Xóa 1 hóa đơn rồi tạo mới → mã trùng với mã đã từng tồn tại.
- Trong `quotations/[id]/convert/route.ts` còn gọi sinh mã **2 lần** (một lần cho QR ngoài transaction, một lần trong transaction) → lãng phí và dễ lệch.

**Đây là lỗi tài chính thực sự**, không phải giả định.

### 🔴 C. Bán vượt tồn kho trong im lặng
**Bằng chứng:** `src/app/api/invoices/route.ts`:
```ts
const newStock = Math.max(0, prevStock - item.quantity);   // kho về 0 nhưng vẫn cho xuất
```
**Hậu quả:** Bán 100 cái khi kho chỉ còn 10 → hóa đơn vẫn tạo, kho về 0, không cảnh báo. Với app quản lý kho, đây là sai logic nghiệp vụ.

---

## 3. Lỗi TRUNG BÌNH (cần xử lý trước khi phát hành)

| # | Vấn đề | Bằng chứng | Rủi ro |
|---|---|---|---|
| D | **Không kiểm tra dữ liệu đầu vào (validation).** `zod` đã cài nhưng **không route nào dùng**. Body đọc thô bằng `parseFloat/parseInt`. | Toàn bộ `src/app/api/**`, `package.json` có `zod` | Tạo hóa đơn số tiền âm/rác, dữ liệu bẩn |
| E | **Middleware chỉ kiểm tra "có cookie", không xác minh chữ ký JWT.** | `src/middleware.ts` chỉ đọc `cookies.get('token')` | Token hết hạn/giả vẫn vào được giao diện |
| F | **Upload không giới hạn loại & dung lượng file**, lưu thẳng vào `public/`. | `src/app/api/upload/route.ts` | Upload file độc hại, đầy ổ đĩa |
| G | **JWT_SECRET có giá trị fallback mặc định trong code.** | `src/lib/auth.ts` dòng đầu | Nếu quên set biến môi trường trên production = lỗ hổng bảo mật lớn |
| H | **Nuốt lỗi thầm lặng khi sinh mã.** Bắt lỗi rồi vẫn trả `count = 0`. | `generateDocumentCode` trong `utils.ts` | Sinh mã sai khi CSDL trục trặc |
| I | **Lặp code nghiêm trọng.** Mỗi route tự viết lại: kiểm tra auth, ghi log, phân trang, xử lý lỗi. | 30 route đều lặp cùng một khuôn | Khó bảo trì, sửa 1 chỗ phải sửa 30 chỗ |

---

## 4. Đánh giá kiến trúc hiện tại

**Điểm tốt (giữ lại):**
- Cấu trúc thư mục Next.js chuẩn, tách nhóm `(auth)` và `(dashboard)`.
- Prisma singleton đúng chuẩn (`src/lib/prisma.ts`), tránh rò kết nối.
- Có dùng `$transaction` ở những chỗ quan trọng (hóa đơn, phiếu thu, chuyển đổi báo giá).

**Điểm yếu (cần chuẩn hóa):**
- **Không có tầng phân lớp rõ ràng.** Mọi thứ dồn vào file route: đọc request → validate → logic nghiệp vụ → truy vấn DB → ghi log → trả response. Route lẽ ra chỉ nên là "cửa vào", còn nghiệp vụ nên nằm ở tầng service.
- **Không có tầng validation** thống nhất.
- **Không có caching** cho dữ liệu đọc nhiều (dashboard, danh mục, cài đặt).
- **Không có xử lý lỗi tập trung** — mỗi route tự `try/catch` và trả message khác nhau.

---

## 5. Kiến trúc mục tiêu (đề xuất cho MVP ổn định)

Bạn yêu cầu tách rõ FE / BE / DB / lưu trữ / cache. Xin nói thẳng để tránh phí công:

> **Không nên tách thành 2 server FE và BE riêng biệt** ở quy mô này. Next.js vốn đã gộp FE + BE trong một dự án; tách ra sẽ tăng độ phức tạp vận hành mà không có lợi ích tương xứng cho một MVP. Điều bạn thực sự cần là **phân tầng rõ ràng bên trong một dự án** — đó mới là "kiến trúc ổn định".

Đề xuất kiến trúc phân tầng (vẫn trong Next.js, thêm các tầng logic):

```
Trình duyệt (React – giao diện, trong src/app/(dashboard))
        │  gọi qua fetch
        ▼
Tầng API Route (src/app/api)        ← chỉ nhận request, gọi service, trả kết quả
        ▼
Tầng Validation (Zod)               ← MỚI: kiểm tra dữ liệu đầu vào từng nghiệp vụ
        ▼
Tầng Service (src/server/services)  ← MỚI: toàn bộ logic nghiệp vụ gom về đây
        ▼
Tầng Truy cập dữ liệu (Prisma)      ← đã có, giữ nguyên
        ▼
PostgreSQL (DB)  +  Cache (đọc nhiều)  +  Lưu trữ file (uploads)
```

**Các thành phần cần bổ sung để "base code ổn":**

1. **Tầng Service** (`src/server/services/*.ts`): gom logic hóa đơn, kho, phiếu thu... ra khỏi route. Route chỉ còn ~10 dòng.
2. **Tầng Validation bằng Zod** (`src/server/validators/*.ts`): mỗi nghiệp vụ một schema, chặn dữ liệu bẩn ngay cửa vào.
3. **Middleware xác thực dùng chung** (`withAuth`): 1 nơi kiểm tra JWT + vai trò, thay vì lặp ở 30 route.
4. **Bộ sinh mã chứng từ an toàn**: dùng bảng bộ đếm riêng (sequence) hoặc khóa hàng trong transaction — không dùng `count()`.
5. **Lưu trữ file**: trước mắt giữ thư mục `public/uploads` nhưng **thêm giới hạn loại + dung lượng**; khi lên production nên chuyển sang dịch vụ lưu trữ đối tượng (S3/Cloudinary) vì `public/` không bền khi triển khai.
6. **Cache**: bắt đầu đơn giản bằng cache trong bộ nhớ hoặc `revalidate` của Next.js cho dữ liệu ít đổi (cài đặt công ty, danh mục, dashboard). Chỉ thêm Redis khi thật sự cần — **không nên thêm sớm** để tránh phức tạp.

> Triết lý: **kiến trúc ổn định = phân tầng rõ + validation + phân quyền thật**, không phải là chia nhỏ nhiều server.

---

## 6. Lộ trình đưa lên MVP (5 giai đoạn)

### Giai đoạn 0 — Dựng lại nền tảng vận hành (làm TRƯỚC khi sửa bất kỳ dòng code nào)
- [ ] Chạy thử app hiện tại từ đầu (cài DB, migrate, seed, đăng nhập) → xác nhận build/chạy được, chụp lại hiện trạng làm mốc so sánh.
- [ ] Viết `HUONG-DAN-CAI-DAT.md`: dựng môi trường từ số 0 (dành cho người mới nhận dự án).
- [ ] Đóng gói Docker: `Dockerfile` + `docker-compose.yml` (app + PostgreSQL) — nền cho mọi lần cài về sau.
- [ ] **Backup tự động**: script sao lưu PostgreSQL hằng ngày ra thư mục thứ hai (USB/Google Drive). *Điều kiện sống còn khi chạy trên máy cá nhân.*
- [ ] Checklist máy-làm-server: tắt sleep, Docker tự khởi động cùng máy.
> Kết thúc GĐ0: dự án **dựng lại được ở bất kỳ máy nào trong 15 phút, dữ liệu không thể mất trắng**.

### Giai đoạn 1 — Vá lỗi nghiêm trọng (ưu tiên tuyệt đối)
- [ ] Sửa `verifyJWT` để trả **đúng vai trò thật** từ token (bỏ `role: 'ADMIN'` cứng) — mục A.
- [ ] Bỏ hardcode `role: 'ADMIN'` ở login & me.
- [ ] Thay bộ sinh mã chứng từ bằng cơ chế an toàn (sequence/transaction) — mục B.
- [ ] Chặn bán vượt tồn kho (báo lỗi rõ ràng khi không đủ hàng) — mục C.
- [ ] Bắt buộc `JWT_SECRET` từ env, bỏ fallback — mục G.
> Kết thúc GĐ1: app **an toàn để dùng thật với dữ liệu thật**.

### Giai đoạn 2 — Chuẩn hóa kiến trúc nền
- [ ] Tạo tầng `withAuth` (xác thực + phân quyền dùng chung).
- [ ] Tạo tầng Validation Zod cho các nghiệp vụ ghi (hóa đơn, phiếu thu, khách hàng, sản phẩm...).
- [ ] Rút logic nghiệp vụ ra tầng Service, để route mỏng lại.
- [ ] Chuẩn hóa xử lý lỗi & định dạng response.
- [ ] Thêm cột `organizationId` vào schema ("để cửa" cho tương lai — xem Mục 0b).
> Kết thúc GĐ2: **base code ổn, dễ bảo trì và mở rộng**.

### Giai đoạn 3 — Hoàn thiện phân quyền & bảo mật
- [ ] Kích hoạt RBAC thật theo bảng Permission đã có sẵn trong seed.
- [ ] Middleware xác minh chữ ký JWT (mục E), giới hạn upload (mục F).
- [ ] Rà soát từng route để gắn đúng quyền theo vai trò.
- [ ] Đóng trang đăng ký công khai `/register` — chỉ Admin tạo tài khoản (xem Mục 0b).
> Kết thúc GĐ3: **nhiều vai trò hoạt động đúng như bạn cần**.

### Giai đoạn 4 — Tối ưu & sẵn sàng phát hành
- [ ] Thêm cache cho dashboard/danh mục/cài đặt.
- [ ] Bổ sung phân trang/tìm kiếm còn thiếu, kiểm thử các luồng chính.
- [ ] (Tùy chọn) Chuyển lưu trữ file sang dịch vụ ngoài khi triển khai.
> Kết thúc GĐ4: **MVP hoàn thiện, mượt và sẵn sàng dùng.**

---

## 7. Tiêu chí nghiệm thu MVP ("xong là xong cái gì")

MVP được coi là hoàn thành khi luồng nghiệp vụ trọn vẹn sau chạy trơn tru trên bản cài Docker tại một máy cửa hàng, không lỗi, đúng phân quyền:

1. Admin tạo tài khoản nhân viên (không còn đăng ký công khai).
2. Nhập sản phẩm + tồn kho ban đầu → tạo khách hàng.
3. Tạo báo giá → chuyển thành hóa đơn (mã không trùng, không bán vượt kho).
4. In/xuất hóa đơn có VietQR → lập phiếu thu → công nợ cập nhật đúng.
5. Xem dashboard và nhật ký hoạt động phản ánh đúng các thao tác trên.
6. Tắt máy, bật lại → hệ thống tự chạy lại, dữ liệu nguyên vẹn; file backup hằng ngày tồn tại thật.

## 8. Việc cần bạn quyết định tiếp

1. **Bắt đầu từ Giai đoạn 0 ngay** (chạy thử + Docker + backup) hay bạn muốn tôi làm chi tiết kỹ thuật từng bước trước khi động vào code?
2. Bạn có **dữ liệu thật đang chạy** trên hệ thống này chưa? (Ảnh hưởng cách sửa bộ sinh mã và di trú dữ liệu.)
3. Các vai trò cụ thể bạn cần là gì? Hiện seed định nghĩa: **ADMIN, MANAGER, ACCOUNTANT, STAFF** — có đúng nhu cầu của bạn không, hay cần thêm/bớt? (Lưu ý: 1 người kiêm nhiều vai vẫn ổn — chỉ cần gán vai trò cao nhất.)

*Báo cáo này dựa trên khảo sát mã nguồn ngày 02/07/2026. Mọi lỗi nêu trên đều có thể tái hiện và kiểm chứng trong các file đã trích dẫn.*
