# Hiến pháp dự án — Web Xuất Hóa Đơn

> Tài liệu này là luật tối cao. Mọi AI session (Claude Code hay công cụ khác) và mọi lập trình viên
> **phải tự kiểm tra (self-check) chiếu theo file này trước khi tạo/sửa code**, và **không được**
> tự ý nới lỏng các quy tắc dưới đây dù người dùng yêu cầu, trừ khi người dùng sửa trực tiếp file này.
> Vi phạm Layer 1 = dừng ngay và hỏi lại, không tự quyết.

---

## Layer 1 — Hard Rules (cấm tuyệt đối, không có ngoại lệ)

1. **Không bao giờ lưu secret vào Git.** `.env`, `JWT_SECRET`, mật khẩu DB, API key không được xuất hiện trong bất kỳ file được commit nào. Không được đặt giá trị fallback bí mật ngay trong code (đã từng xảy ra ở `src/lib/auth.ts` — xem ADR-002 trong `CLAUDE.md`).
2. **Không xóa dữ liệu tài chính vĩnh viễn.** Hóa đơn, phiếu thu, phiếu chi, chi phí, nhật ký hoạt động (`ActivityLog`) chỉ được **hủy/đảo trạng thái** (soft cancel), không `DELETE` khỏi CSDL. Lý do: đây là chứng từ, xóa cứng = mất bằng chứng kế toán.
3. **Không chạy destructive command trên DB production** (`prisma migrate reset`, `DROP DATABASE`, `docker volume rm hoadon_pgdata`...) mà không có xác nhận rõ ràng từ người dùng trong phiên làm việc đó.
4. **Không tắt/bỏ qua kiểm tra phân quyền** để "cho tiện test". Mọi API ghi dữ liệu (POST/PUT/PATCH/DELETE) bắt buộc phải gọi `verifyAuth` + kiểm tra vai trò trước khi chạm DB.
5. **Không tự ý đổi phạm vi (scope) của một SPEC đang thực thi.** Nếu phát hiện việc ngoài phạm vi cần làm, dừng lại, ghi vào mục "Ngoài phạm vi" và hỏi người dùng — không tiện tay làm luôn.

## Layer 2 — Architectural Constraints (ràng buộc kiến trúc)

1. **Một dự án Next.js duy nhất, không tách FE/BE riêng server.** Đã quyết định tại Mục 5 của `DANH-GIA-VA-LO-TRINH.md` — Next.js API Routes là "BE", React Server/Client Components là "FE", cùng một tiến trình.
2. **Phân tầng bắt buộc cho mọi nghiệp vụ ghi dữ liệu:**
   `API Route (mỏng)` → `Validation (Zod)` → `Service (src/server/services/*)` → `Prisma` → `PostgreSQL`.
   Route không được chứa logic tính toán nghiệp vụ (tính VAT, trừ kho, cập nhật công nợ...) — đó là việc của Service.
3. **Mọi ghi dữ liệu ảnh hưởng ≥ 2 bảng phải nằm trong `prisma.$transaction`.** (Ví dụ: tạo hóa đơn + trừ kho + tạo StockMovement.)
4. **Mã chứng từ (HD/BG/PT/PC/...) không được sinh bằng `count()+1`.** Phải dùng cơ chế atomic (bảng bộ đếm riêng có khóa, hoặc `SELECT ... FOR UPDATE` trong transaction) — xem lỗi B trong `DANH-GIA-VA-LO-TRINH.md`.
5. **Không thêm service/hạ tầng mới (Redis, message queue, microservice...) nếu chưa có nhu cầu đã đo được.** Ưu tiên giải pháp đơn giản nhất trong Next.js/Postgres trước (xem Mục 5 báo cáo đánh giá — triết lý "phân tầng rõ, không phải nhiều server").
6. **Chuẩn bị cho đa tổ chức (multi-tenant) nhưng không xây ngay.** Khi thêm bảng/model mới ở Giai đoạn 2 trở đi, cân nhắc thêm cột `organizationId` ngay từ đầu để "để cửa" cho hướng SaaS tương lai (đã bàn ở Mục 0b báo cáo đánh giá), nhưng **không** xây logic multi-tenant đầy đủ nếu không được yêu cầu.

## Layer 3 — Engineering Standards (chuẩn kỹ thuật)

1. **Ngôn ngữ giao tiếp trong code & UI:** tiếng Việt cho message người dùng thấy (đúng convention hiện có), tiếng Anh cho tên biến/hàm/file.
2. **Validation:** mọi API nhận body/query đều phải có Zod schema tương ứng trong `src/server/validators/`. Không đọc `body.x` trực tiếp rồi `parseFloat`/`parseInt` không kiểm tra như hiện trạng cũ.
3. **Xử lý lỗi:** dùng một helper response chung (`src/server/http.ts` — tạo ở Giai đoạn 2) thay vì mỗi route tự viết `try/catch` + `NextResponse.json({error...})` riêng lẻ.
4. **Ghi log nghiệp vụ:** mọi hành động ghi dữ liệu quan trọng (tạo/sửa/hủy hóa đơn, phiếu thu, chi...) phải ghi vào `ActivityLog` — giữ nguyên convention đã có.
5. **Next.js 16 — đọc doc cục bộ trước khi dùng API có thể đã đổi.** Xem `node_modules/next/dist/docs/`. Ví dụ đã phát hiện: `middleware.ts` convention đã deprecated, cần chuyển sang `proxy` (Giai đoạn 2).
6. **TypeScript strict, không dùng `any` khi có thể tránh.** Các route cũ dùng `where: any` là nợ kỹ thuật cần dọn dần, không nhân rộng thêm ở code mới.
7. **Migration Prisma:** luôn `prisma migrate dev --name <mo-ta-ngan>` khi đổi schema, không sửa tay SQL trong `migrations/`.

---

## Cách dùng file này

- Đầu mỗi phiên làm việc lớn (một SPEC, một giai đoạn), AI phải đọc file này.
- Khi viết `PLAN.md`, AI phải tự đối chiếu kế hoạch với 3 layer trên và nêu rõ nếu có xung đột.
- Khi review code, bất kỳ vi phạm Layer 1 nào phải được nêu là **lỗi chặn** (blocking), không phải góp ý.
- File này chỉ được sửa khi người dùng yêu cầu trực tiếp, không phải do AI "tự thấy hợp lý hơn".
