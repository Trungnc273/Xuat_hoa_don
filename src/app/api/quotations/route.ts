import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { createQuotationSchema } from '@/server/validators/sales';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/codegen';
import type { Prisma } from '@prisma/client';

// 1. GET: Danh sách báo giá
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED
    const customerId = searchParams.get('customerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: Prisma.QuotationWhereInput = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } },
        { creator: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    // Nếu là nhân viên thường, chỉ cho phép xem báo giá do chính mình tạo
    if (session.role === 'STAFF') {
      where.creatorId = session.userId;
    }

    const total = await prisma.quotation.count({ where });

    const quotations = await prisma.quotation.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: { code: true, name: true, company: true, phone: true },
        },
        creator: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      quotations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Quotations:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Lập báo giá mới (Sử dụng Prisma Transaction)
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = createQuotationSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)
    const { customerId, dueDate, notes, items } = body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Vui lòng cung cấp khách hàng và danh sách sản phẩm báo giá' }, { status: 400 });
    }

    // Tính toán số tiền tự động
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

    // Chạy trong transaction
    const quotation = await prisma.$transaction(async (tx) => {
      const code = await generateDocumentCode(tx, 'BG');

      return tx.quotation.create({
        data: {
          code,
          customerId,
          dueDate: dueDate ? new Date(dueDate) : null,
          creatorId: session.userId,
          status: 'DRAFT',
          notes,
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
    });

    // Ghi nhật ký hệ thống
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_QUOTATION',
        details: `Đã lập báo giá mới: ${quotation.code} cho khách hàng ${quotation.customer.name} (Tổng cộng: ${quotation.total} VND)`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo báo giá thành công', quotation });
  } catch (error) {
    return handleError('POST Quotation', error);
  }
}
