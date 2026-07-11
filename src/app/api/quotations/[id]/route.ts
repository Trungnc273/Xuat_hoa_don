import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import type { LineItemInput } from '@/server/validators/common';
import type { Prisma } from '@prisma/client';

type UpdateQuotationPayload = {
  customerId?: string;
  dueDate?: string | Date | null;
  status?: string;
  notes?: string | null;
  customFields?: Record<string, string> | null;
  items?: LineItemInput[];
};

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
    const body = (await req.json()) as UpdateQuotationPayload;
    const { customerId, dueDate, status, notes, customFields, items } = body;

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!existingQuotation) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    if (session.role === 'STAFF' && existingQuotation.creatorId !== session.userId) {
      return NextResponse.json({ error: 'Bạn không có quyền sửa báo giá này' }, { status: 403 });
    }

    // Báo giá đã chuyển thành hóa đơn thì số liệu đã chốt — sửa tiếp sẽ lệch với hóa đơn đã sinh
    if (existingQuotation.status === 'CONVERTED') {
      return NextResponse.json(
        { error: 'Báo giá đã được chuyển thành hóa đơn, không thể sửa. Hãy hủy hóa đơn liên quan trước nếu cần điều chỉnh.' },
        { status: 400 }
      );
    }

    // Whitelist trạng thái — CONVERTED chỉ được đặt bởi luồng chuyển đổi, không đặt tay qua PUT
    const VALID_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
    if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Trạng thái báo giá không hợp lệ' }, { status: 400 });
    }

    // Nếu danh sách sản phẩm thay đổi, chúng ta cần tính lại toàn bộ
    const updateData: Prisma.QuotationUncheckedUpdateInput = {};
    if (customerId) updateData.customerId = customerId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (customFields !== undefined) updateData.customFields = customFields || {};

    const updated = await prisma.$transaction(async (tx) => {
      if (items && Array.isArray(items) && items.length > 0) {
        let subtotal = 0;
        let discountAmount = 0;
        let vatAmount = 0;
        let total = 0;

        const itemsData = items.map((item) => {
          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 1);
          const vatRate = Number(item.vatRate || 10);
          const discountRate = Number(item.discountRate || 0);

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
            description: item.description || null,
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
            creator: {
              select: { username: true, email: true },
            },
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
            creator: {
              select: { username: true, email: true },
            },
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
