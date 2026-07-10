import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// 1. GET: Lấy thông tin chi tiết khách hàng và Lịch sử mua hàng, công nợ
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        quotations: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        invoices: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        receipts: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        priceTier: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Không tìm thấy khách hàng' }, { status: 404 });
    }

    // Tính toán công nợ của khách hàng này
    // Công nợ = Tổng tiền các hóa đơn - Tổng tiền các phiếu thu đã nhận
    const totalInvoiced = customer.invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = customer.invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const outstandingDebt = totalInvoiced - totalPaid;

    return NextResponse.json({
      customer,
      summary: {
        totalInvoiced,
        totalPaid,
        outstandingDebt,
        totalQuotations: customer.quotations.length,
        totalInvoices: customer.invoices.length,
      },
    });
  } catch (error) {
    console.error('Lỗi GET Customer detail:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. PUT: Sửa thông tin khách hàng
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
    const { name, company, taxCode, address, email, phone, contactPerson, tagName, tagColor, priceTierId, note } = body;

    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Không tìm thấy khách hàng' }, { status: 404 });
    }

    const requestedPriceTierId = priceTierId !== undefined ? priceTierId : existingCustomer.priceTierId;
    const priceTier = requestedPriceTierId
      ? await prisma.customerPriceTier.findUnique({ where: { id: requestedPriceTierId } })
      : null;

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingCustomer.name,
        company,
        taxCode,
        address,
        email,
        phone,
        contactPerson,
        tagName: priceTier?.name ?? (tagName !== undefined ? tagName : existingCustomer.tagName),
        tagColor: priceTier?.color ?? (tagColor !== undefined ? tagColor : existingCustomer.tagColor),
        priceTierId: requestedPriceTierId ? (priceTier?.id ?? existingCustomer.priceTierId) : null,
        note,
      },
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_CUSTOMER',
        details: `Cập nhật thông tin khách hàng: ${updatedCustomer.name} (Mã: ${updatedCustomer.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật khách hàng thành công', customer: updatedCustomer });
  } catch (error) {
    console.error('Lỗi PUT Customer:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 3. DELETE: Xóa khách hàng
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { quotations: true, invoices: true },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Không tìm thấy khách hàng' }, { status: 404 });
    }

    // Kiểm tra xem khách hàng đã phát sinh báo giá hay hóa đơn nào chưa
    if (customer._count.quotations > 0 || customer._count.invoices > 0) {
      return NextResponse.json({
        error: 'Không thể xóa khách hàng này vì đã có dữ liệu giao dịch (báo giá/hóa đơn) trong hệ thống.',
      }, { status: 400 });
    }

    await prisma.customer.delete({
      where: { id },
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'DELETE_CUSTOMER',
        details: `Đã xóa khách hàng: ${customer.name} (Mã: ${customer.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Xóa khách hàng thành công' });
  } catch (error) {
    console.error('Lỗi DELETE Customer:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
