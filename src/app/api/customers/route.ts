import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

// 1. GET: Lấy danh sách khách hàng (có tìm kiếm, phân trang, sắp xếp)
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
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Bộ lọc tìm kiếm
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Đếm tổng số bản ghi phục vụ phân trang
    const total = await prisma.customer.count({ where });

    // Lấy dữ liệu
    const customers = await prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    return NextResponse.json({
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Customers:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Thêm mới khách hàng
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Kiểm tra quyền (Chỉ Admin, Manager, Staff mới được tạo khách hàng)
    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { name, company, taxCode, address, email, phone, contactPerson, note } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên khách hàng là bắt buộc' }, { status: 400 });
    }

    // Tự động sinh mã khách hàng (ví dụ KH000001)
    const code = await generateDocumentCode('KH', 'customer');

    // Lưu vào database
    const customer = await prisma.customer.create({
      data: {
        code,
        name,
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
        action: 'CREATE_CUSTOMER',
        details: `Đã tạo khách hàng mới: ${customer.name} (Mã: ${customer.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo khách hàng thành công', customer });
  } catch (error) {
    console.error('Lỗi POST Customer:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
