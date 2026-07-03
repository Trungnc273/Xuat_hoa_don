import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

// 1. GET: Lấy danh sách phiếu chi
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.payment.count({ where });

    const payments = await prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        supplier: {
          select: { name: true, company: true },
        },
        payor: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Payments:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Lập phiếu chi mới
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { supplierId, amount, date, paymentMethod, note } = body;

    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      return NextResponse.json({ error: 'Số tiền chi phải lớn hơn 0' }, { status: 400 });
    }

    const paymentCode = await generateDocumentCode('PC', 'payment');

    const payment = await prisma.payment.create({
      data: {
        code: paymentCode,
        supplierId: supplierId || null,
        amount: payAmount,
        date: date ? new Date(date) : new Date(),
        paymentMethod: paymentMethod || 'CASH',
        payorId: session.userId,
        note,
      },
      include: {
        supplier: true,
      },
    });

    // Ghi nhật ký hệ thống
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_PAYMENT',
        details: `Lập phiếu chi tiền: ${payment.code} (Số tiền: ${payment.amount} VND, Nhà cung cấp: ${payment.supplier?.name || 'Vãng lai'}, Hình thức: ${payment.paymentMethod})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo phiếu chi thành công', payment });
  } catch (error) {
    console.error('Lỗi POST Payment:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
