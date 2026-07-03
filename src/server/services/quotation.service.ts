import prisma from '@/lib/prisma';
import type { Session } from '@/server/auth';
import { createInvoiceCore, type InvoiceTotals } from './invoice.service';

/** Lỗi nghiệp vụ có mã HTTP — route chuyển thẳng thành response. */
export class BusinessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Chuyển báo giá thành hóa đơn — tái dùng LÕI tạo hóa đơn (SPEC GĐ2, FR-3)
 * nên trừ kho/QR/sinh mã giống hệt luồng tạo trực tiếp.
 */
export async function convertQuotationToInvoice(session: Session, quotationId: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { items: true, customer: true },
  });
  if (!quotation) throw new BusinessError('Không tìm thấy báo giá', 404);
  if (quotation.status === 'CONVERTED') {
    throw new BusinessError('Báo giá này đã được chuyển thành hóa đơn trước đó', 400);
  }

  // Báo giá đã chốt số liệu — giữ nguyên, không tính lại
  const totals: InvoiceTotals = {
    subtotal: quotation.subtotal,
    vatAmount: quotation.vatAmount,
    discountAmount: quotation.discountAmount,
    total: quotation.total,
    items: quotation.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      discountRate: item.discountRate,
      quantity: item.quantity,
      amount: item.amount,
    })),
  };

  // "Giành quyền" chuyển đổi atomic — hai request đồng thời thì chỉ một bên thắng,
  // tránh tạo 2 hóa đơn + trừ kho 2 lần cho cùng một báo giá.
  const claimed = await prisma.quotation.updateMany({
    where: { id: quotation.id, status: { not: 'CONVERTED' } },
    data: { status: 'CONVERTED' },
  });
  if (claimed.count === 0) {
    throw new BusinessError('Báo giá này đã được chuyển thành hóa đơn trước đó', 400);
  }

  try {
    const result = await createInvoiceCore({
      session,
      customerId: quotation.customerId,
      totals,
      notes: quotation.notes || `Chuyển đổi từ báo giá ${quotation.code}`,
      quotationId: quotation.id,
      stockReasonSuffix: ` (chuyển từ báo giá ${quotation.code})`,
    });
    return { ...result, quotation };
  } catch (error) {
    // Tạo hóa đơn thất bại → trả trạng thái báo giá về như cũ để có thể thử lại
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { status: quotation.status },
    });
    throw error;
  }
}
