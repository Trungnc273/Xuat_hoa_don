import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

// GET: Lấy toàn bộ nhật ký dịch chuyển kho (có phân trang, lọc theo kho, kiểu di chuyển)
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId') || '';
    const type = searchParams.get('type') || ''; // IN, OUT, ADJUST, CHECK
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    if (type) {
      where.type = type;
    }

    const total = await prisma.stockMovement.count({ where });

    const movements = await prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: {
          select: { code: true, name: true, sku: true, unit: true },
        },
        warehouse: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      movements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Stock Movements:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
