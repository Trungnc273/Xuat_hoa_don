import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { partnerSchema } from '@/server/validators/catalog';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { requirePermission } from '@/server/rbac';
import { generateDocumentCode } from '@/lib/codegen';
import type { Prisma } from '@prisma/client';

// 1. GET: Lấy danh sách nhà cung cấp
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

    const where: Prisma.SupplierWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.supplier.count({ where });

    const suppliers = await prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    return NextResponse.json({
      suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Suppliers:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Thêm mới nhà cung cấp
export async function POST(req: Request) {
  try {
    const auth = await requirePermission(req, 'CREATE', 'Supplier'); // RBAC theo bảng Permission (SPEC GĐ3, FR-3)
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = partnerSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)
    const { name, company, taxCode, address, email, phone, contactPerson, note } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên nhà cung cấp là bắt buộc' }, { status: 400 });
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const code = await generateDocumentCode(tx, 'NCC');
      return tx.supplier.create({
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
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_SUPPLIER',
        details: `Đã tạo nhà cung cấp mới: ${supplier.name} (Mã: ${supplier.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo nhà cung cấp thành công', supplier });
  } catch (error) {
    return handleError('POST Supplier', error);
  }
}
