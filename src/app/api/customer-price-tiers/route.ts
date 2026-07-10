import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { customerPriceTierSchema } from '@/server/validators/catalog';
import { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const tiers = await prisma.customerPriceTier.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ tiers });
  } catch (error) {
    console.error('Lỗi GET CustomerPriceTiers:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = customerPriceTierSchema.parse(await req.json());
    const tier = await prisma.customerPriceTier.create({
      data: body,
    });

    return NextResponse.json({ message: 'Tạo phân loại khách hàng thành công', tier });
  } catch (error: unknown) {
    console.error('Lỗi POST CustomerPriceTier:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Tên phân loại này đã tồn tại' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
