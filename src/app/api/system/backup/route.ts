import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

const createBackupFileName = () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `hoadon-data-${stamp}.json`;
};

export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bạn không có quyền sao lưu dữ liệu hệ thống' }, { status: 403 });
    }

    const [
      users,
      roles,
      permissions,
      rolePermissions,
      customers,
      customerPriceTiers,
      suppliers,
      categories,
      products,
      productTierPrices,
      warehouses,
      stockMovements,
      quotations,
      quotationItems,
      invoices,
      invoiceItems,
      receipts,
      payments,
      expenses,
      settings,
      notifications,
      activityLogs,
      documentCounters,
      organizations,
    ] = await prisma.$transaction([
      prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.role.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.permission.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.rolePermission.findMany({ orderBy: [{ roleId: 'asc' }, { permissionId: 'asc' }] }),
      prisma.customer.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.customerPriceTier.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.supplier.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.product.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.productTierPrice.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.warehouse.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.stockMovement.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.quotation.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.quotationItem.findMany({ orderBy: { id: 'asc' } }),
      prisma.invoice.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.invoiceItem.findMany({ orderBy: { id: 'asc' } }),
      prisma.receipt.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.payment.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.expense.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.setting.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.notification.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.activityLog.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.documentCounter.findMany({ orderBy: { prefix: 'asc' } }),
      prisma.organization.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

    const tables = {
      users,
      roles,
      permissions,
      rolePermissions,
      customers,
      customerPriceTiers,
      suppliers,
      categories,
      products,
      productTierPrices,
      warehouses,
      stockMovements,
      quotations,
      quotationItems,
      invoices,
      invoiceItems,
      receipts,
      payments,
      expenses,
      settings,
      notifications,
      activityLogs,
      documentCounters,
      organizations,
    };

    const backup = {
      metadata: {
        app: 'web-xuat-hoa-don',
        format: 'json-prisma-export-v1',
        createdAt: new Date().toISOString(),
        createdBy: session.username,
        note: 'File này chứa dữ liệu hệ thống, gồm cả hash mật khẩu người dùng. Chỉ lưu ở nơi an toàn.',
      },
      counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
      tables,
    };

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'BACKUP_DATA',
        details: 'Tải bản sao lưu dữ liệu hệ thống.',
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${createBackupFileName()}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Lỗi backup dữ liệu:', error);
    return NextResponse.json({ error: 'Không thể tạo bản sao lưu dữ liệu' }, { status: 500 });
  }
}
