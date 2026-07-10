import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { customerPriceTierSchema } from '@/server/validators/catalog';
import { Prisma } from '@prisma/client';

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
    const body = customerPriceTierSchema.parse(await req.json());
    const tier = await prisma.customerPriceTier.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ message: 'Cập nhật phân loại khách hàng thành công', tier });
  } catch (error: unknown) {
    console.error('Lỗi PUT CustomerPriceTier:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Tên phân loại này đã tồn tại' }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Không tìm thấy phân loại khách hàng' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

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
    const tier = await prisma.customerPriceTier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customers: true, productPrices: true },
        },
      },
    });

    if (!tier) {
      return NextResponse.json({ error: 'Không tìm thấy phân loại khách hàng' }, { status: 404 });
    }

    if (tier._count.customers > 0 || tier._count.productPrices > 0) {
      return NextResponse.json({
        error: 'Không thể xóa phân loại này vì đang được gán cho khách hàng hoặc bảng giá sản phẩm.',
      }, { status: 400 });
    }

    await prisma.customerPriceTier.delete({ where: { id } });

    return NextResponse.json({ message: 'Xóa phân loại khách hàng thành công' });
  } catch (error) {
    console.error('Lỗi DELETE CustomerPriceTier:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
