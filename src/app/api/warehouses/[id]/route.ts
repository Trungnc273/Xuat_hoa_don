import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/server/rbac';

// DELETE: Xóa kho hàng — chỉ cho phép khi kho chưa có lịch sử xuất/nhập/kiểm kê,
// để không phá vỡ nhật ký tồn kho (giữ tinh thần CONSTITUTION Layer 1.2: không xóa chứng từ).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, 'DELETE', 'Warehouse');
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await params;

    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      return NextResponse.json({ error: 'Không tìm thấy kho hàng' }, { status: 404 });
    }

    const movementCount = await prisma.stockMovement.count({ where: { warehouseId: id } });
    if (movementCount > 0) {
      return NextResponse.json(
        { error: `Không thể xóa "${warehouse.name}" vì đã có ${movementCount} lượt xuất/nhập/kiểm kê ghi nhận tại kho này — xóa sẽ làm mất nhật ký tồn kho.` },
        { status: 400 }
      );
    }

    await prisma.warehouse.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'DELETE_WAREHOUSE',
        details: `Đã xóa kho hàng: ${warehouse.name} (Mã: ${warehouse.code})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Xóa kho hàng thành công' });
  } catch (error) {
    console.error('Lỗi DELETE Warehouse:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
