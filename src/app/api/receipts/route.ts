import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { requirePermission } from '@/server/rbac';
import { handleError, fail } from '@/server/http';
import { logActivity } from '@/server/activity-log';
import { createReceiptSchema } from '@/server/validators/sales';
import { createReceipt } from '@/server/services/receipt.service';
import { BusinessError } from '@/server/services/quotation.service';
import type { Prisma } from '@prisma/client';

// 1. GET: Danh sách phiếu thu
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

    const where: Prisma.ReceiptWhereInput = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { invoice: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const total = await prisma.receipt.count({ where });

    const receipts = await prisma.receipt.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: { name: true, company: true },
        },
        invoice: {
          select: { code: true, total: true },
        },
        receiver: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      receipts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Receipts:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Tạo phiếu thu (Route mỏng: auth → validate → service → response)
export async function POST(req: Request) {
  try {
    // Chỉ Admin, Manager hoặc Kế toán được lập phiếu thu
    const auth = await requirePermission(req, 'CREATE', 'Receipt');
    if (!auth.ok) return auth.response;

    const input = createReceiptSchema.parse(await req.json());
    const receipt = await createReceipt(auth.session, input);

    await logActivity(
      auth.session,
      'CREATE_RECEIPT',
      `Lập phiếu thu tiền: ${receipt.code} (Số tiền: ${receipt.amount} VND, Khách hàng: ${receipt.customer?.name || 'Vãng lai'}, Hình thức: ${receipt.paymentMethod})`,
      req
    );

    return NextResponse.json({ message: 'Tạo phiếu thu thành công', receipt });
  } catch (error) {
    if (error instanceof BusinessError) return fail(error.message, error.status);
    return handleError('POST Receipt', error);
  }
}
