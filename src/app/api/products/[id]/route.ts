import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// 1. GET: Chi tiết sản phẩm và lịch sử luân chuyển kho
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            warehouse: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Lỗi GET Product detail:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. PUT: Sửa thông tin sản phẩm
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
    const { sku, barcode, name, categoryId, importPrice, salePrice, priceC1, priceC2, priceC3, vatRate, unit, images, description } = body;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        sku: sku !== undefined ? sku : existingProduct.sku,
        barcode: barcode !== undefined ? barcode : existingProduct.barcode,
        name: name !== undefined ? name : existingProduct.name,
        categoryId: categoryId !== undefined ? (categoryId || null) : existingProduct.categoryId,
        importPrice: importPrice !== undefined ? parseFloat(importPrice) : existingProduct.importPrice,
        salePrice: salePrice !== undefined ? parseFloat(salePrice) : existingProduct.salePrice,
        priceC1: priceC1 !== undefined ? (priceC1 === null || priceC1 === '' ? null : parseFloat(priceC1)) : existingProduct.priceC1,
        priceC2: priceC2 !== undefined ? (priceC2 === null || priceC2 === '' ? null : parseFloat(priceC2)) : existingProduct.priceC2,
        priceC3: priceC3 !== undefined ? (priceC3 === null || priceC3 === '' ? null : parseFloat(priceC3)) : existingProduct.priceC3,
        vatRate: vatRate !== undefined ? parseFloat(vatRate) : existingProduct.vatRate,
        unit: unit !== undefined ? unit : existingProduct.unit,
        images: images !== undefined ? images : existingProduct.images,
        description: description !== undefined ? description : existingProduct.description,
      },
    });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_PRODUCT',
        details: `Cập nhật thông tin sản phẩm: ${updatedProduct.name} (Mã: ${updatedProduct.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật sản phẩm thành công', product: updatedProduct });
  } catch (error: unknown) {
    console.error('Lỗi PUT Product:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Mã SKU hoặc Barcode đã tồn tại trong hệ thống' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 3. DELETE: Xóa sản phẩm
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

    // Kiểm tra xem sản phẩm có đang được sử dụng trong Báo giá hay Hóa đơn không
    const quotationCount = await prisma.quotationItem.count({ where: { productId: id } });
    const invoiceCount = await prisma.invoiceItem.count({ where: { productId: id } });

    if (quotationCount > 0 || invoiceCount > 0) {
      return NextResponse.json({
        error: 'Không thể xóa sản phẩm này vì đã phát sinh báo giá hoặc hóa đơn liên quan.',
      }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    await prisma.product.delete({ where: { id } });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'DELETE_PRODUCT',
        details: `Đã xóa sản phẩm: ${product.name} (Mã: ${product.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Xóa sản phẩm thành công' });
  } catch (error) {
    console.error('Lỗi DELETE Product:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
