import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// 1. GET: Lấy thông tin nhà cung cấp và lịch sử giao dịch (phiếu chi)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp' }, { status: 404 });
    }

    // Tính tổng số tiền đã chi trả cho nhà cung cấp này
    const totalPaid = supplier.payments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      supplier,
      summary: {
        totalPaid,
        totalPayments: supplier.payments.length,
      },
    });
  } catch (error) {
    console.error('Lỗi GET Supplier detail:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. PUT: Sửa thông tin nhà cung cấp
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, company, taxCode, address, email, phone, contactPerson, note } = body;

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp' }, { status: 404 });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingSupplier.name,
        company,
        taxCode,
        address,
        email,
        phone,
        contactPerson,
        note,
      },
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_SUPPLIER',
        details: `Cập nhật thông tin nhà cung cấp: ${updatedSupplier.name} (Mã: ${updatedSupplier.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật nhà cung cấp thành công', supplier: updatedSupplier });
  } catch (error) {
    console.error('Lỗi PUT Supplier:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 3. DELETE: Xóa nhà cung cấp
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

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Không tìm thấy nhà cung cấp' }, { status: 404 });
    }

    // Kiểm tra xem đã có chứng từ chi tiền cho NCC chưa
    if (supplier._count.payments > 0) {
      return NextResponse.json({
        error: 'Không thể xóa nhà cung cấp này vì đã có chứng từ chi tiền liên kết trong hệ thống.',
      }, { status: 400 });
    }

    await prisma.supplier.delete({
      where: { id },
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'DELETE_SUPPLIER',
        details: `Đã xóa nhà cung cấp: ${supplier.name} (Mã: ${supplier.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Xóa nhà cung cấp thành công' });
  } catch (error) {
    console.error('Lỗi DELETE Supplier:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
