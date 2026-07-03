import { Prisma } from '@prisma/client';

export type DocPrefix = 'HD' | 'BG' | 'PT' | 'PC' | 'SP' | 'KH' | 'NCC' | 'KHO' | 'CP';

/**
 * Sinh mã chứng từ tăng dần, an toàn dưới điều kiện đồng thời (HD000001, BG000001...).
 *
 * BẮT BUỘC gọi bên trong prisma.$transaction và truyền transaction client (tx) vào —
 * upsert + increment giữ row-lock trên bảng document_counters, hai request đồng thời
 * sẽ tuần tự hóa và không bao giờ nhận cùng một mã (SPEC GĐ1, FR-2).
 *
 * Cấm quay lại cách đếm bản ghi (count()+1) — xem CONSTITUTION.md Layer 2.4.
 */
export async function generateDocumentCode(
  tx: Prisma.TransactionClient,
  prefix: DocPrefix
): Promise<string> {
  const counter = await tx.documentCounter.upsert({
    where: { prefix },
    create: { prefix, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${prefix}${String(counter.lastNumber).padStart(6, '0')}`;
}
