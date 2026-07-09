import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET: Lấy danh sách công nợ khách hàng (Phải thu) và nhà cung cấp (Phải trả)
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const now = new Date();

    // 1. Phải thu từ khách hàng (Các hóa đơn chưa thanh toán hoặc thanh toán một phần)
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      include: {
        customer: {
          select: { code: true, name: true, phone: true, company: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const receivables = unpaidInvoices.map((inv) => {
      // Tính ngày đến hạn (mặc định 30 ngày kể từ ngày xuất nếu không có)
      const dueDate = inv.date ? new Date(inv.date.getTime() + 30 * 24 * 60 * 60 * 1000) : new Date();
      const overdueDays = now.getTime() > dueDate.getTime() 
        ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: inv.id,
        invoiceCode: inv.code,
        customerId: inv.customerId,
        customerName: inv.customer.name,
        customerPhone: inv.customer.phone || '',
        company: inv.customer.company || '',
        amount: inv.total,
        paidAmount: inv.paidAmount,
        remainingAmount: inv.remainingAmount,
        dueDate,
        isOverdue: overdueDays > 0,
        overdueDays,
      };
    });

    // 2. Phải trả cho nhà cung cấp (Phiếu chi đã lập)
    const payablesSummary = await prisma.supplier.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        company: true,
        payments: {
          select: { amount: true },
        },
      },
    });

    const payables = payablesSummary.map((s) => {
      const totalPaid = s.payments.reduce((sum, p) => sum + p.amount, 0);
      return {
        supplierId: s.id,
        supplierCode: s.code,
        supplierName: s.name,
        company: s.company || '',
        totalPaid,
      };
    });

    // 3. Tổng hợp số liệu dashboard công nợ
    const totalReceivables = receivables.reduce((sum, r) => sum + r.remainingAmount, 0);
    const totalOverdue = receivables
      .filter((r) => r.isOverdue)
      .reduce((sum, r) => sum + r.remainingAmount, 0);
    const totalPaidSuppliers = payables.reduce((sum, p) => sum + p.totalPaid, 0);

    return NextResponse.json({
      receivables,
      payables,
      summary: {
        totalReceivables,
        totalOverdue,
        totalPaidSuppliers,
        overdueAlertCount: receivables.filter((r) => r.isOverdue).length,
      },
    });
  } catch (error) {
    console.error('Lỗi GET Debts:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
