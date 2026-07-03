import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { requireAuth } from '@/server/auth';
import { handleError } from '@/server/http';
import { logActivity } from '@/server/activity-log';
import { createInvoiceSchema } from '@/server/validators/sales';
import { computeTotals, createInvoiceCore } from '@/server/services/invoice.service';

// 1. GET: Danh sách hóa đơn (có phân trang, lọc trạng thái, tìm kiếm)
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // UNPAID, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
    const customerId = searchParams.get('customerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    // Nếu là nhân viên, chỉ xem hóa đơn mình tạo
    if (session.role === 'STAFF') {
      where.creatorId = session.userId;
    }

    const total = await prisma.invoice.count({ where });

    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: { code: true, name: true, company: true },
        },
        creator: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Invoices:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Tạo mới hóa đơn trực tiếp (Route mỏng: auth → validate → service → response)
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, ['ADMIN', 'MANAGER', 'STAFF']);
    if (!auth.ok) return auth.response;

    const input = createInvoiceSchema.parse(await req.json());
    const totals = computeTotals(input.items);

    const { invoice, stockWarnings } = await createInvoiceCore({
      session: auth.session,
      customerId: input.customerId,
      totals,
      notes: input.notes,
      templateName: input.templateName,
    });

    await logActivity(
      auth.session,
      'CREATE_INVOICE',
      `Đã tạo hóa đơn mới: ${invoice.code} cho khách hàng ${invoice.customer.name} (Số tiền: ${invoice.total} VND). Đã trừ kho tương ứng.`,
      req
    );

    return NextResponse.json({
      message: 'Tạo hóa đơn thành công',
      invoice,
      // Danh sách sản phẩm bị âm kho sau giao dịch (nếu có) — FE nên hiển thị cảnh báo nhập bù
      stockWarnings,
    });
  } catch (error) {
    return handleError('POST Invoice', error);
  }
}
