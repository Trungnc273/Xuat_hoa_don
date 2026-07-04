import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { createProductSchema } from '@/server/validators/catalog';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { requirePermission } from '@/server/rbac';
import { generateDocumentCode } from '@/lib/codegen';

// 1. GET: Lấy danh sách sản phẩm
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError('GET Products', error);
  }
}

// 2. POST: Thêm mới sản phẩm (Sử dụng Prisma Transaction)
export async function POST(req: Request) {
  try {
    const auth = await requirePermission(req, 'CREATE', 'Product'); // RBAC theo bảng Permission (SPEC GĐ3, FR-3)
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = createProductSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)
    const { sku, barcode, name, categoryId, importPrice, salePrice, vatRate, unit, images, description, stock } = body;

    if (!name || importPrice === undefined || salePrice === undefined) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin bắt buộc: tên, giá nhập, giá bán' }, { status: 400 });
    }

    // Chạy trong Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Tự sinh mã sản phẩm (atomic trong transaction)
      const code = await generateDocumentCode(tx, 'SP');
      // 1. Tạo sản phẩm
      const product = await tx.product.create({
        data: {
          code,
          sku: sku || null,
          barcode: barcode || null,
          name,
          categoryId: categoryId || null,
          importPrice: importPrice,
          salePrice: salePrice,
          vatRate: vatRate,
          unit: unit || 'Cái',
          images: images || [],
          description,
          stock: stock,
        },
      });

      // 2. Nếu tồn kho khởi tạo > 0, tạo StockMovement và ghi vào kho chính mặc định
      const initialStock = stock;
      if (initialStock > 0) {
        // Lấy kho chính mặc định, nếu chưa có thì tạo mới
        let defaultWh = await tx.warehouse.findFirst();
        if (!defaultWh) {
          defaultWh = await tx.warehouse.create({
            data: {
              code: 'KHO000001',
              name: 'Kho trung tâm',
              description: 'Kho mặc định của hệ thống',
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            type: 'IN',
            productId: product.id,
            quantity: initialStock,
            prevStock: 0,
            newStock: initialStock,
            warehouseId: defaultWh.id,
            reason: 'Khởi tạo tồn kho ban đầu',
            createdBy: session.username,
          },
        });
      }

      return product;
    });

    // Ghi nhật ký hoạt động
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_PRODUCT',
        details: `Đã tạo sản phẩm mới: ${result.name} (Mã: ${result.code}, Tồn kho: ${result.stock})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo sản phẩm thành công', product: result });
  } catch (error: any) {
    console.error('Lỗi POST Product:', error);
    // Phân biệt đúng trường bị trùng theo error.meta.target — không gộp chung "SKU hoặc Barcode"
    // cho cả trường hợp trùng mã `code` tự sinh (04/07/2026 — xem CLAUDE.md bài học)
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) || [];
      if (target.includes('code')) {
        return NextResponse.json(
          { error: 'Mã sản phẩm tự sinh bị trùng — thử lại lần nữa (bộ đếm mã đang được đồng bộ)' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Mã SKU hoặc Barcode đã tồn tại trong hệ thống' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
