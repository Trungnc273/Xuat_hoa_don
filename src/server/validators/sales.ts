import { z } from 'zod';
import { lineItem, money, optionalDate, optionalStr } from './common';

/** POST /api/invoices */
export const createInvoiceSchema = z.object({
  customerId: z.string().uuid('customerId không hợp lệ'),
  notes: optionalStr,
  templateName: z.enum(['DEFAULT', 'MODERN', 'MINIMAL']).default('DEFAULT'),
  customFields: z.record(z.string(), z.string()).default({}),
  items: z.array(lineItem).min(1, 'Hóa đơn phải có ít nhất 1 sản phẩm'),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/** PUT /api/invoices/[id] — mọi trường đều optional (cập nhật từng phần) */
export const updateInvoiceSchema = z.object({
  status: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  // Không dùng optionalStr ở đây vì cần phân biệt "" (xóa ghi chú) với undefined (không đổi)
  notes: z.string().trim().max(2000, 'Quá dài').optional(),
  templateName: z.enum(['DEFAULT', 'MODERN', 'MINIMAL']).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  items: z.array(lineItem).min(1, 'Hóa đơn phải có ít nhất 1 sản phẩm').optional(),
  paidAmount: z.coerce.number().min(0, 'Số tiền không được âm').optional(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

/** POST /api/quotations */
export const createQuotationSchema = z.object({
  customerId: z.string().uuid('customerId không hợp lệ'),
  dueDate: optionalDate,
  notes: optionalStr,
  customFields: z.record(z.string(), z.string()).default({}),
  items: z.array(lineItem).min(1, 'Báo giá phải có ít nhất 1 sản phẩm'),
});
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

/** POST /api/receipts */
export const createReceiptSchema = z.object({
  invoiceId: z.string().uuid('invoiceId không hợp lệ').nullish(),
  customerId: z.string().uuid('customerId không hợp lệ').nullish(),
  amount: money,
  date: optionalDate,
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD']).default('BANK_TRANSFER'),
  note: optionalStr,
});
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

/** POST /api/payments */
export const createPaymentSchema = z.object({
  supplierId: z.string().uuid('supplierId không hợp lệ').nullish(),
  amount: money,
  date: optionalDate,
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD']).default('CASH'),
  note: optionalStr,
});

/** POST /api/expenses */
export const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề là bắt buộc'),
  category: z.enum(['OFFICE', 'MARKETING', 'SALARY', 'TRAVEL', 'UTILITIES', 'OTHER']),
  amount: money,
  date: optionalDate,
  note: optionalStr,
});
