import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// 1. GET: Chi tiết báo giá kèm danh sách mặt hàng
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        creator: {
          select: { username: true, email: true },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    // Nếu là nhân viên, chỉ cho xem báo giá tự mình lập
    if (session.role === 'STAFF' && quotation.creatorId !== session.userId) {
      return NextResponse.json({ error: 'Bạn không có quyền xem báo giá này' }, { status: 403 });
    }

    return NextResponse.json({ quotation });
  } catch (error) {
    console.error('Lỗi GET Quotation detail:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. PUT: Cập nhật thông tin báo giá (Xóa items cũ, thêm mới, tính lại tiền)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { customerId, dueDate, status, notes, items } = body;

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    if (session.role === 'STAFF' && existingQuotation.creatorId !== session.userId) {
      return NextResponse.json({ error: 'Bạn không có quyền sửa báo giá này' }, { status: 403 });
    }

    // Nếu danh sách sản phẩm thay đổi, chúng ta cần tính lại toàn bộ
    let updateData: any = {};
    if (customerId) updateData.customerId = customerId;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.$transaction(async (tx) => {
      if (items && Array.isArray(items) && items.length > 0) {
        let subtotal = 0;
        let discountAmount = 0;
        let vatAmount = 0;
        let total = 0;

        const itemsData = items.map((item: any) => {
          const unitPrice = parseFloat(item.unitPrice || 0);
          const quantity = parseInt(item.quantity || 1);
          const vatRate = parseFloat(item.vatRate || 10);
          const discountRate = parseFloat(item.discountRate || 0);

          const itemSubtotal = unitPrice * quantity;
          const itemDiscount = itemSubtotal * (discountRate / 100);
          const itemAfterDiscount = itemSubtotal - itemDiscount;
          const itemVat = itemAfterDiscount * (vatRate / 100);
          const itemAmount = itemAfterDiscount + itemVat;

          subtotal += itemSubtotal;
          discountAmount += itemDiscount;
          vatAmount += itemVat;
          total += itemAmount;

          return {
            productId: item.productId || null,
            productName: item.productName,
            productSku: item.productSku || null,
            unitPrice,
            vatRate,
            discountRate,
            quantity,
            amount: itemAmount,
          };
        });

        // Xóa sạch các items cũ
        await tx.quotationItem.deleteMany({
          where: { quotationId: id },
        });

        // Cập nhật thông tin báo giá kèm items mới
        return tx.quotation.update({
          where: { id },
          data: {
            ...updateData,
            subtotal,
            vatAmount,
            discountAmount,
            total,
            items: {
              create: itemsData,
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });
      } else {
        // Chỉ cập nhật các thông tin cơ bản, giữ nguyên items
        return tx.quotation.update({
          where: { id },
          data: updateData,
          include: {
            items: true,
            customer: true,
          },
        });
      }
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_QUOTATION',
        details: `Đã cập nhật báo giá: ${updated.code} (Trạng thái: ${updated.status}, Tổng tiền: ${updated.total} VND)`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật báo giá thành công', quotation: updated });
  } catch (error) {
    console.error('Lỗi PUT Quotation:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 3. DELETE: Xóa báo giá
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    if (session.role === 'STAFF' && quotation.creatorId !== session.userId) {
      return NextResponse.json({ error: 'Bạn không có quyền xóa báo giá này' }, { status: 403 });
    }

    // Không được xóa báo giá đã chuyển đổi thành hóa đơn
    if (quotation.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Không thể xóa báo giá đã chuyển đổi thành hóa đơn' }, { status: 400 });
    }

    await prisma.quotation.delete({
      where: { id },
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'DELETE_QUOTATION',
        details: `Đã xóa báo giá: ${quotation.code} (Tổng tiền: ${quotation.total} VND)`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Xóa báo giá thành công' });
  } catch (error) {
    console.error('Lỗi DELETE Quotation:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
