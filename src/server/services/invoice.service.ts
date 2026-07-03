import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateDocumentCode } from '@/lib/codegen';
import type { Session } from '@/server/auth';
import type { LineItemInput } from '@/server/validators/common';

export type StockWarning = { productId: string; productName: string; newStock: number };

export type InvoiceItemData = {
  productId: string | null;
  productName: string;
  productSku: string | null;
  unitPrice: number;
  vatRate: number;
  discountRate: number;
  quantity: number;
  amount: number;
};

export type InvoiceTotals = {
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  items: InvoiceItemData[];
};

/** Tính toán giá trị hóa đơn/báo giá từ dòng hàng — server tự tính, không tin số client gửi. */
export function computeTotals(items: LineItemInput[]): InvoiceTotals {
  let subtotal = 0;
  let discountAmount = 0;
  let vatAmount = 0;
  let total = 0;

  const itemsData = items.map((item) => {
    const itemSubtotal = item.unitPrice * item.quantity;
    const itemDiscount = itemSubtotal * (item.discountRate / 100);
    const itemAfterDiscount = itemSubtotal - itemDiscount;
    const itemVat = itemAfterDiscount * (item.vatRate / 100);
    const itemAmount = itemAfterDiscount + itemVat;

    subtotal += itemSubtotal;
    discountAmount += itemDiscount;
    vatAmount += itemVat;
    total += itemAmount;

    return {
      productId: item.productId ?? null,
      productName: item.productName,
      productSku: item.productSku ?? null,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      discountRate: item.discountRate,
      quantity: item.quantity,
      amount: itemAmount,
    };
  });

  return { subtotal, vatAmount, discountAmount, total, items: itemsData };
}

/** Sinh link VietQR động từ cài đặt ngân hàng ("BIN - SỐ TK - TÊN TK"). */
function buildVietQrUrl(bankAccount: string | null | undefined, invoiceCode: string, total: number): string | null {
  if (!bankAccount) return null;
  const parts = bankAccount.split('-');
  if (parts.length < 3) return null;
  const bankBin = parts[0].trim();
  const accountNo = parts[1].trim();
  const accountName = encodeURIComponent(parts[2].trim());
  const addInfo = encodeURIComponent(`Thanh toan hoa don ${invoiceCode}`);
  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${total}&addInfo=${addInfo}&accountName=${accountName}`;
}

/** Lấy (hoặc tạo) kho mặc định phục vụ xuất kho. */
export async function getDefaultWarehouse() {
  const existing = await prisma.warehouse.findFirst();
  if (existing) return existing;
  return prisma.warehouse.create({
    data: { code: 'KHO000001', name: 'Kho trung tâm', description: 'Kho mặc định của hệ thống' },
  });
}

type CreateInvoiceCoreParams = {
  session: Session;
  customerId: string;
  totals: InvoiceTotals;
  notes?: string | null;
  templateName?: string;
  quotationId?: string;
  stockReasonSuffix?: string; // ví dụ: " (chuyển từ báo giá BG000001)"
};

/**
 * LÕI tạo hóa đơn — dùng chung cho cả tạo trực tiếp và convert từ báo giá (SPEC GĐ2, FR-3),
 * để hai luồng không bao giờ lệch hành vi: sinh mã atomic, VietQR, trừ kho trung thực
 * (cho phép âm + cảnh báo — SPEC GĐ1, FR-3), ghi StockMovement.
 */
export async function createInvoiceCore(params: CreateInvoiceCoreParams) {
  const { session, customerId, totals, notes, templateName, quotationId, stockReasonSuffix } = params;

  const setting = await prisma.setting.findFirst();
  const defaultWh = await getDefaultWarehouse();
  const stockWarnings: StockWarning[] = [];

  const invoice = await prisma.$transaction(
    async (tx) => {
      const invoiceCode = await generateDocumentCode(tx, 'HD');
      const qrCodeUrl = buildVietQrUrl(setting?.bankAccount, invoiceCode, totals.total);

      const createdInvoice = await tx.invoice.create({
        data: {
          code: invoiceCode,
          quotationId: quotationId ?? null,
          customerId,
          creatorId: session.userId,
          status: 'UNPAID',
          notes: notes ?? null,
          subtotal: totals.subtotal,
          vatAmount: totals.vatAmount,
          discountAmount: totals.discountAmount,
          total: totals.total,
          paidAmount: 0,
          remainingAmount: totals.total,
          qrCode: qrCodeUrl,
          templateName: templateName || 'DEFAULT',
          items: { create: totals.items },
        },
        include: { items: true, customer: true },
      });

      for (const item of totals.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const prevStock = product.stock;
        // Tồn kho trung thực: cho phép âm (bán trước nhập sau), cấm cắt số liệu
        const newStock = prevStock - item.quantity;

        await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } });
        await tx.stockMovement.create({
          data: {
            type: 'OUT',
            productId: item.productId,
            quantity: item.quantity,
            prevStock,
            newStock,
            warehouseId: defaultWh.id,
            reason: `Xuất kho bán hàng theo hóa đơn ${invoiceCode}${stockReasonSuffix || ''}`,
            createdBy: session.username,
          },
        });

        if (newStock < 0) {
          stockWarnings.push({ productId: product.id, productName: product.name, newStock });
        }
      }

      return createdInvoice;
    },
    { maxWait: 10000, timeout: 20000 }
  );

  return { invoice, stockWarnings };
}

export type CreatedInvoice = Prisma.PromiseReturnType<typeof createInvoiceCore>;
