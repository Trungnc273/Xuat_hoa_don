import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleError, fail } from '@/server/http';
import { updateInvoiceSchema } from '@/server/validators/sales';
import { computeTotals, type StockWarning } from '@/server/services/invoice.service';
import { BusinessError } from '@/server/services/quotation.service';

// 1. GET: Chi tiết hóa đơn và lịch sử phiếu thu
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { include: { priceTier: true } },
        items: true,
        receipts: {
          orderBy: { date: 'desc' },
        },
        creator: {
          select: { username: true, email: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    }

    if (session.role === 'STAFF' && invoice.creatorId !== session.userId) {
      return NextResponse.json({ error: 'Bạn không có quyền xem hóa đơn này' }, { status: 403 });
    }

    // Lấy tất cả productId trong items để lấy ảnh sản phẩm tương ứng
    const productIds = invoice.items
      .map(item => item.productId)
      .filter((pid): pid is string => !!pid);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, images: true },
    });

    const imageMap = new Map(products.map(p => [p.id, p.images]));

    const itemsWithImages = invoice.items.map(item => ({
      ...item,
      productImages: item.productId ? (imageMap.get(item.productId) || []) : [],
    }));

    const invoiceWithImages = {
      ...invoice,
      items: itemsWithImages,
    };

    return NextResponse.json({ invoice: invoiceWithImages });
  } catch (error) {
    console.error('Lỗi GET Invoice detail:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// Tìm hoặc tạo kho mặc định trong transaction (giữ nguyên atomic với các thay đổi kho khác)
async function getOrCreateDefaultWarehouseTx(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const existing = await tx.warehouse.findFirst();
  if (existing) return existing;
  return tx.warehouse.create({ data: { code: 'KHO000001', name: 'Kho trung tâm' } });
}

// 2. PUT: Sửa hóa đơn — hủy (hoàn kho), sửa mặt hàng (hoàn kho cũ + trừ kho mới),
// sửa ghi chú/thông tin bổ sung/mẫu in, hoặc sửa trực tiếp số tiền đã thu (theo yêu cầu chủ dự án 15/07/2026).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Chỉ Admin, Manager hoặc Accountant được sửa hóa đơn
    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;
    const input = updateInvoiceSchema.parse(await req.json());

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, _count: { select: { receipts: true } } },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    }

    // Nếu hóa đơn đã hủy từ trước, không cho sửa tiếp
    if (existingInvoice.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Hóa đơn đã bị hủy từ trước, không thể sửa đổi' }, { status: 400 });
    }

    // Sửa mặt hàng chỉ an toàn khi CHƯA phát sinh thanh toán — tránh lệch giữa tổng tiền mới
    // và các phiếu thu/paidAmount đã ghi trước đó
    if (input.items && (existingInvoice.paidAmount > 0 || existingInvoice._count.receipts > 0)) {
      return fail('Không thể sửa mặt hàng vì hóa đơn đã có phát sinh thanh toán. Có thể sửa trực tiếp số tiền đã thu nếu cần điều chỉnh.', 400);
    }

    // Sửa trực tiếp số tiền đã thu (không qua Phiếu thu) — kiểm tra sớm khi biết chắc tổng tiền
    // (trường hợp không đồng thời sửa items); nếu sửa cùng items, kiểm tra lại trong transaction.
    if (input.paidAmount !== undefined && !input.items && input.paidAmount > existingInvoice.total) {
      return fail('Số tiền đã thu không được vượt quá tổng tiền hóa đơn', 400);
    }

    const stockWarnings: StockWarning[] = [];

    // Thực hiện cập nhật trong transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Nếu trạng thái đổi thành CANCELLED, thực hiện HOÀN KHO sản phẩm (giữ nguyên hành vi cũ)
      if (input.status === 'CANCELLED' && existingInvoice.status !== 'CANCELLED') {
        const defaultWh = await getOrCreateDefaultWarehouseTx(tx);

        for (const item of existingInvoice.items) {
          if (item.productId) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (product) {
              const prevStock = product.stock;
              const newStock = prevStock + item.quantity; // Hoàn trả kho
              await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } });
              await tx.stockMovement.create({
                data: {
                  type: 'IN',
                  productId: item.productId,
                  quantity: item.quantity,
                  prevStock,
                  newStock,
                  warehouseId: defaultWh.id,
                  reason: `Hoàn kho do hủy hóa đơn ${existingInvoice.code}`,
                  createdBy: session.username,
                },
              });
            }
          }
        }
      }

      // Nếu đổi danh sách mặt hàng: hoàn kho theo hàng CŨ, tính lại tổng tiền, trừ kho theo hàng MỚI
      let newTotals: ReturnType<typeof computeTotals> | null = null;
      if (input.items) {
        const defaultWh = await getOrCreateDefaultWarehouseTx(tx);

        for (const item of existingInvoice.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          const prevStock = product.stock;
          const newStock = prevStock + item.quantity;
          await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } });
          await tx.stockMovement.create({
            data: {
              type: 'IN', productId: item.productId, quantity: item.quantity, prevStock, newStock,
              warehouseId: defaultWh.id,
              reason: `Hoàn kho do sửa hóa đơn ${existingInvoice.code} (cập nhật mặt hàng)`,
              createdBy: session.username,
            },
          });
        }

        newTotals = computeTotals(input.items);

        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: newTotals.items.map((item) => ({ ...item, invoiceId: id })),
        });

        for (const item of newTotals.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          const prevStock = product.stock;
          const newStock = prevStock - item.quantity; // Tồn kho trung thực: cho phép âm
          await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } });
          await tx.stockMovement.create({
            data: {
              type: 'OUT', productId: item.productId, quantity: item.quantity, prevStock, newStock,
              warehouseId: defaultWh.id,
              reason: `Xuất kho theo sửa hóa đơn ${existingInvoice.code}`,
              createdBy: session.username,
            },
          });
          if (newStock < 0) {
            stockWarnings.push({ productId: product.id, productName: product.name, newStock });
          }
        }
      }

      // Tính lại số tiền đã thu / còn nợ / trạng thái
      const finalTotal = newTotals ? newTotals.total : existingInvoice.total;
      let finalPaidAmount = existingInvoice.paidAmount;
      if (input.paidAmount !== undefined) {
        if (input.paidAmount > finalTotal) {
          throw new BusinessError('Số tiền đã thu không được vượt quá tổng tiền hóa đơn', 400);
        }
        finalPaidAmount = input.paidAmount;
      }
      const finalRemaining = Math.max(0, finalTotal - finalPaidAmount);
      const finalStatus = input.status === 'CANCELLED'
        ? 'CANCELLED'
        : finalPaidAmount <= 0 ? 'UNPAID' : finalRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      return tx.invoice.update({
        where: { id },
        data: {
          status: finalStatus,
          notes: input.notes !== undefined ? input.notes : existingInvoice.notes,
          templateName: input.templateName || existingInvoice.templateName,
          ...(input.customFields !== undefined ? { customFields: input.customFields } : {}),
          paidAmount: finalPaidAmount,
          remainingAmount: finalRemaining,
          ...(newTotals ? {
            subtotal: newTotals.subtotal,
            vatAmount: newTotals.vatAmount,
            discountAmount: newTotals.discountAmount,
            total: newTotals.total,
          } : {}),
        },
        include: { customer: { include: { priceTier: true } }, items: true },
      });
    }, { maxWait: 10000, timeout: 20000 });

    // Ghi nhật ký
    const changeNotes = [
      input.status && `trạng thái ${existingInvoice.status} → ${updated.status}`,
      input.items && 'cập nhật danh sách mặt hàng',
      input.paidAmount !== undefined && `sửa trực tiếp số tiền đã thu → ${updated.paidAmount} VND`,
    ].filter(Boolean).join('; ');
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_INVOICE',
        details: `Cập nhật hóa đơn ${updated.code}${changeNotes ? `: ${changeNotes}` : ''}.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật hóa đơn thành công', invoice: updated, stockWarnings });
  } catch (error) {
    if (error instanceof BusinessError) return fail(error.message, error.status);
    return handleError('PUT Invoice', error);
  }
}

// 3. DELETE: HỦY hóa đơn (soft cancel — CONSTITUTION Layer 1.2 cấm xóa cứng chứng từ tài chính).
// Trước 11/07/2026 endpoint này xóa cứng bản ghi và KHÔNG hoàn kho → mất chứng từ + lệch tồn vĩnh viễn.
// Giữ nguyên endpoint DELETE để giao diện cũ không vỡ, nhưng hành vi là hủy + hoàn kho.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        _count: { select: { receipts: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    }

    if (invoice.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Hóa đơn này đã được hủy từ trước' }, { status: 400 });
    }

    // Nếu đã có phát sinh thanh toán, phải xử lý phiếu thu trước khi hủy
    if (invoice._count.receipts > 0 || invoice.paidAmount > 0) {
      return NextResponse.json({
        error: 'Không thể hủy hóa đơn đã có phát sinh thanh toán (Phiếu thu). Vui lòng xử lý phiếu thu trước.',
      }, { status: 400 });
    }

    // Hủy mềm + hoàn kho trong cùng transaction
    await prisma.$transaction(async (tx) => {
      let defaultWh = await tx.warehouse.findFirst();
      if (!defaultWh) {
        defaultWh = await tx.warehouse.create({
          data: { code: 'KHO000001', name: 'Kho trung tâm' },
        });
      }

      for (const item of invoice.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const prevStock = product.stock;
        const newStock = prevStock + item.quantity; // Hoàn trả kho

        await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } });
        await tx.stockMovement.create({
          data: {
            type: 'IN',
            productId: item.productId,
            quantity: item.quantity,
            prevStock,
            newStock,
            warehouseId: defaultWh.id,
            reason: `Hoàn kho do hủy hóa đơn ${invoice.code}`,
            createdBy: session.username,
          },
        });
      }

      await tx.invoice.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    }, { maxWait: 10000, timeout: 20000 });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CANCEL_INVOICE',
        details: `Đã hủy hóa đơn: ${invoice.code} (Tổng tiền: ${invoice.total} VND). Đã hoàn kho các sản phẩm liên quan. Chứng từ được giữ lại ở trạng thái CANCELLED.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Đã hủy hóa đơn và hoàn kho (chứng từ được giữ lại, không xóa vĩnh viễn)' });
  } catch (error) {
    console.error('Lỗi DELETE Invoice:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
