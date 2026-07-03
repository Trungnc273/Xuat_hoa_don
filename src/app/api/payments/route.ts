import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { createPaymentSchema } from '@/server/validators/sales';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { requirePermission } from '@/server/rbac';
import { generateDocumentCode } from '@/lib/codegen';

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
    const auth = await requirePermission(req, 'CREATE', 'Payment'); // RBAC theo bảng Permission (SPEC GĐ3, FR-3)
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = createPaymentSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)
    const { supplierId, amount, date, paymentMethod, note } = body;

    const payAmount = amount;
    if (!payAmount || payAmount <= 0) {
      return NextResponse.json({ error: 'Số tiền chi phải lớn hơn 0' }, { status: 400 });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const paymentCode = await generateDocumentCode(tx, 'PC');
      return tx.payment.create({
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
    return handleError('POST Payment', error);
  }
}
