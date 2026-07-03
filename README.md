# Web Xuất Hóa Đơn

Phần mềm quản lý bán hàng & chứng từ nội bộ cho cửa hàng nhỏ, xưởng, hộ kinh doanh:
khách hàng, sản phẩm, tồn kho, báo giá → hóa đơn, phiếu thu/chi, công nợ, VietQR.

**Stack:** Next.js 16 · TypeScript · Prisma 6 · PostgreSQL · Docker

## Bắt đầu

- **Cài đặt & vận hành** (dev lẫn máy cửa hàng): xem [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md)
- **Đánh giá hiện trạng & lộ trình MVP:** xem [DANH-GIA-VA-LO-TRINH.md](DANH-GIA-VA-LO-TRINH.md)

## Quy trình làm việc với AI (Spec as Code)

Tài liệu là nguồn sự thật; code là sản phẩm dẫn xuất. Sai ở đâu, sửa ở Spec đó.

| File | Vai trò |
|---|---|
| [CONSTITUTION.md](CONSTITUTION.md) | Luật bất biến của dự án (3 layer) |
| [AGENTS.md](AGENTS.md) | Persona & ranh giới hoạt động của AI |
| [CLAUDE.md](CLAUDE.md) | DNA dự án: kiến trúc, ADR, bài học |
| `docs/specs/<tính-năng>/` | CONTEXT → SPEC (EARS) → PLAN → TASKS cho mỗi tính năng |
| `.sdd/` | Ràng buộc nghiệp vụ sâu + skill đóng gói kinh nghiệm |

Tạo tính năng mới: sao chép `docs/specs/_TEMPLATE/`, điền SPEC, để AI sinh PLAN/TASKS rồi duyệt.
