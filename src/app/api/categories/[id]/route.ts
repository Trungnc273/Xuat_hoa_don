import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { invalidateCache } from '@/server/cache';

// PUT: Cập nhật thông tin danh mục
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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên danh mục là bắt buộc' }, { status: 400 });
    }

    // Kiểm tra trùng tên danh mục (trừ danh mục hiện tại)
    const existingCategory = await prisma.category.findFirst({
      where: {
        name,
        NOT: { id },
      },
    });

    if (existingCategory) {
      return NextResponse.json({ error: 'Tên danh mục này đã tồn tại' }, { status: 400 });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    invalidateCache('categories');
    return NextResponse.json({ message: 'Cập nhật danh mục thành công', category: updatedCategory });
  } catch (error) {
    console.error('Lỗi PUT Category:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// DELETE: Xóa danh mục
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

    // Chạy trong Prisma Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Chuyển categoryId của tất cả sản phẩm thuộc danh mục này về null
      await tx.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });

      // 2. Xóa danh mục
      await tx.category.delete({
        where: { id },
      });
    });

    invalidateCache('categories');
    return NextResponse.json({ message: 'Xóa danh mục thành công' });
  } catch (error) {
    console.error('Lỗi DELETE Category:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
