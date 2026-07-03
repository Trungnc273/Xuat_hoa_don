import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
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
    console.error('Lỗi GET Products:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Thêm mới sản phẩm (Sử dụng Prisma Transaction)
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
          importPrice: parseFloat(importPrice),
          salePrice: parseFloat(salePrice),
          vatRate: parseFloat(vatRate || 10),
          unit: unit || 'Cái',
          images: images || [],
          description,
          stock: stock ? parseInt(stock) : 0,
        },
      });

      // 2. Nếu tồn kho khởi tạo > 0, tạo StockMovement và ghi vào kho chính mặc định
      const initialStock = stock ? parseInt(stock) : 0;
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
    // Xử lý lỗi trùng lặp SKU hoặc Barcode
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Mã SKU hoặc Barcode đã tồn tại trong hệ thống' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
