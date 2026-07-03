import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

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

    const where: any = {};
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

// 2. POST: Tạo phiếu thu (Cập nhật công nợ hóa đơn tương ứng)
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Chỉ Admin, Manager hoặc Kế toán được lập phiếu thu
    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { invoiceId, customerId, amount, date, paymentMethod, note } = body;

    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      return NextResponse.json({ error: 'Số tiền thu phải lớn hơn 0' }, { status: 400 });
    }

    // Thực hiện tạo phiếu thu và cập nhật hóa đơn trong transaction
    const result = await prisma.$transaction(async (tx) => {
      let finalCustomerId = customerId;

      // A. Nếu có hóa đơn, lấy customerId từ hóa đơn và cập nhật trạng thái hóa đơn
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });

        if (!invoice) {
          throw new Error('Không tìm thấy hóa đơn liên kết');
        }

        if (invoice.status === 'CANCELLED') {
          throw new Error('Không thể thu tiền cho hóa đơn đã hủy');
        }

        finalCustomerId = invoice.customerId;

        // Tính số tiền đã thanh toán mới
        const newPaidAmount = invoice.paidAmount + payAmount;
        const newRemainingAmount = Math.max(0, invoice.total - newPaidAmount);
        
        let newStatus = 'PARTIALLY_PAID';
        if (newRemainingAmount <= 0) {
          newStatus = 'PAID';
        }

        // Cập nhật lại số tiền trên hóa đơn
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
          },
        });
      }

      // B. Sinh mã phiếu thu
      const receiptCode = await generateDocumentCode('PT', 'receipt');

      // C. Tạo phiếu thu
      const receipt = await tx.receipt.create({
        data: {
          code: receiptCode,
          invoiceId: invoiceId || null,
          customerId: finalCustomerId || null,
          amount: payAmount,
          date: date ? new Date(date) : new Date(),
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          receiverId: session.userId,
          note,
        },
        include: {
          customer: true,
          invoice: true,
        },
      });

      return receipt;
    });

    // Ghi nhật ký hệ thống
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_RECEIPT',
        details: `Lập phiếu thu tiền: ${result.code} (Số tiền: ${result.amount} VND, Khách hàng: ${result.customer?.name || 'Vãng lai'}, Hình thức: ${result.paymentMethod})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo phiếu thu thành công', receipt: result });
  } catch (error: any) {
    console.error('Lỗi POST Receipt:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
