import prisma from '@/lib/prisma';
import { generateDocumentCode } from '@/lib/codegen';
import type { Session } from '@/server/auth';
import type { CreateReceiptInput } from '@/server/validators/sales';
import { BusinessError } from './quotation.service';

/**
 * Lập phiếu thu + cập nhật công nợ hóa đơn trong cùng transaction
 * (.sdd/constraints/bao-mat-tai-chinh.md điều 3).
 */
export async function createReceipt(session: Session, input: CreateReceiptInput) {
  return prisma.$transaction(
    async (tx) => {
      let finalCustomerId = input.customerId ?? null;

      if (input.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
        if (!invoice) throw new BusinessError('Không tìm thấy hóa đơn liên kết', 404);
        if (invoice.status === 'CANCELLED') {
          throw new BusinessError('Không thể thu tiền cho hóa đơn đã hủy', 400);
        }

        finalCustomerId = invoice.customerId;

        const newPaidAmount = invoice.paidAmount + input.amount;
        const newRemainingAmount = Math.max(0, invoice.total - newPaidAmount);
        const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
          },
        });
      }

      const receiptCode = await generateDocumentCode(tx, 'PT');

      return tx.receipt.create({
        data: {
          code: receiptCode,
          invoiceId: input.invoiceId ?? null,
          customerId: finalCustomerId,
          amount: input.amount,
          date: input.date ?? new Date(),
          paymentMethod: input.paymentMethod,
          receiverId: session.userId,
          note: input.note ?? null,
        },
        include: { customer: true, invoice: true },
      });
    },
    { maxWait: 10000, timeout: 20000 }
  );
}
