import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { stockAdjustSchema } from '@/server/validators/catalog';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// POST: Thực hiện điều chỉnh hoặc nhập/xuất kho thủ công
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Chỉ Admin và Manager mới được điều chỉnh kho
    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = stockAdjustSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)
    const { productId, warehouseId, type, quantity, reason, note } = body;

    if (!productId || !warehouseId || !type || quantity === undefined) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc: productId, warehouseId, type, quantity' }, { status: 400 });
    }

    const qtyValue = quantity;
    if (isNaN(qtyValue)) {
      return NextResponse.json({ error: 'Số lượng phải là một số nguyên' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra sản phẩm và kho hàng tồn tại
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Không tìm thấy sản phẩm cần điều chỉnh');
      }

      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        throw new Error('Không tìm thấy kho hàng được chọn');
      }

      const prevStock = product.stock;
      let newStock = prevStock;

      // 2. Tính toán tồn kho mới
      if (type === 'IN') {
        newStock = prevStock + qtyValue;
      } else if (type === 'OUT') {
        newStock = prevStock - qtyValue;
        if (newStock < 0) {
          throw new Error('Số lượng tồn kho trong hệ thống không đủ để xuất');
        }
      } else if (type === 'ADJUST' || type === 'CHECK') {
        newStock = qtyValue; // Thay đổi trực tiếp sang số lượng kiểm kê
      } else {
        throw new Error('Kiểu luân chuyển kho không hợp lệ (IN, OUT, ADJUST, CHECK)');
      }

      // 3. Cập nhật tồn kho của sản phẩm
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      // 4. Tạo lịch sử luân chuyển kho StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          type,
          productId,
          warehouseId,
          quantity: qtyValue,
          prevStock,
          newStock,
          reason: reason || (type === 'IN' ? 'Nhập kho bổ sung' : type === 'OUT' ? 'Xuất kho' : 'Điều chỉnh kiểm kê'),
          note,
          createdBy: session.username,
        },
      });

      return { product: updatedProduct, movement };
    });

    // Ghi nhật ký hệ thống
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'STOCK_ADJUSTMENT',
        details: `Điều chỉnh kho sản phẩm ${result.product.name} (${result.product.code}): ${result.movement.prevStock} -> ${result.product.stock} (Lý do: ${result.movement.reason})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({
      message: 'Điều chỉnh tồn kho thành công',
      product: result.product,
      movement: result.movement,
    });
  } catch (error: any) {
    return handleError('POST Stock Adjust', error);
  }
}
