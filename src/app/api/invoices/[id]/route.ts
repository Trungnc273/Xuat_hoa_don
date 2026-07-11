import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

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
        customer: true,
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

// 2. PUT: Sửa hóa đơn (Đặc biệt xử lý hoàn kho khi HỦY hóa đơn)
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
    const body = await req.json();
    const { status, notes, templateName } = body;

    // Whitelist trạng thái — không cho ghi chuỗi tùy ý vào chứng từ
    const VALID_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Trạng thái hóa đơn không hợp lệ' }, { status: 400 });
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    }

    // Nếu hóa đơn đã hủy từ trước, không cho sửa tiếp
    if (existingInvoice.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Hóa đơn đã bị hủy từ trước, không thể sửa đổi' }, { status: 400 });
    }

    // Thực hiện cập nhật trong transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Nếu trạng thái đổi thành CANCELLED, thực hiện HOÀN KHO sản phẩm
      if (status === 'CANCELLED' && existingInvoice.status !== 'CANCELLED') {
        let defaultWh = await tx.warehouse.findFirst();
        if (!defaultWh) {
          defaultWh = await tx.warehouse.create({
            data: {
              code: 'KHO000001',
              name: 'Kho trung tâm',
            },
          });
        }

        for (const item of existingInvoice.items) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });

            if (product) {
              const prevStock = product.stock;
              const newStock = prevStock + item.quantity; // Hoàn trả kho

              await tx.product.update({
                where: { id: item.productId },
                data: { stock: newStock },
              });

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

      // Cập nhật thông tin hóa đơn
      return tx.invoice.update({
        where: { id },
        data: {
          status: status || existingInvoice.status,
          notes: notes !== undefined ? notes : existingInvoice.notes,
          templateName: templateName || existingInvoice.templateName,
        },
        include: { customer: true },
      });
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_INVOICE',
        details: `Cập nhật hóa đơn ${updated.code}: Trạng thái đổi từ ${existingInvoice.status} sang ${updated.status}.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật hóa đơn thành công', invoice: updated });
  } catch (error) {
    console.error('Lỗi PUT Invoice:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
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
