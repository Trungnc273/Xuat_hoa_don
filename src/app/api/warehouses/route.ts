import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/codegen';

// GET: Lấy danh sách kho hàng
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const warehouses = await prisma.warehouse.findMany({
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ warehouses });
  } catch (error) {
    console.error('Lỗi GET Warehouses:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// POST: Tạo kho hàng mới
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { name, address, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên kho hàng là bắt buộc' }, { status: 400 });
    }

    const warehouse = await prisma.$transaction(async (tx) => {
      const code = await generateDocumentCode(tx, 'KHO');
      return tx.warehouse.create({
      data: {
        code,
        name,
        address,
        description,
      },
      });
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_WAREHOUSE',
        details: `Đã tạo kho hàng mới: ${warehouse.name} (Mã: ${warehouse.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo kho hàng thành công', warehouse });
  } catch (error) {
    console.error('Lỗi POST Warehouse:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
