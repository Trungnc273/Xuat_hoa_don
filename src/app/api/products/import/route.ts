import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

// POST: Nhập khẩu sản phẩm hàng loạt từ Excel
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { products } = await req.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Dữ liệu sản phẩm không hợp lệ hoặc trống' }, { status: 400 });
    }

    // Lấy kho chính mặc định phục vụ nhập tồn kho
    let defaultWh = await prisma.warehouse.findFirst();
    if (!defaultWh) {
      defaultWh = await prisma.warehouse.create({
        data: {
          code: 'KHO000001',
          name: 'Kho trung tâm',
          description: 'Kho mặc định của hệ thống',
        },
      });
    }

    let successCount = 0;
    let skipCount = 0;

    // Chạy từng sản phẩm trong transaction
    await prisma.$transaction(async (tx) => {
      for (const row of products) {
        const { sku, barcode, name, categoryName, importPrice, salePrice, vatRate, unit, description, stock } = row;

        if (!name || !categoryName || importPrice === undefined || salePrice === undefined) {
          skipCount++;
          continue;
        }

        // 1. Tìm hoặc tạo danh mục sản phẩm
        let category = await tx.category.findUnique({
          where: { name: categoryName.trim() },
        });

        if (!category) {
          category = await tx.category.create({
            data: {
              name: categoryName.trim(),
              description: `Danh mục được tạo tự động khi import sản phẩm.`,
            },
          });
        }

        // 2. Kiểm tra SKU xem sản phẩm đã tồn tại chưa
        if (sku) {
          const existingProduct = await tx.product.findUnique({
            where: { sku: String(sku).trim() },
          });
          if (existingProduct) {
            // Đã tồn tại SKU, bỏ qua hoặc cập nhật (ở đây ta chọn bỏ qua để tránh ghi đè sai)
            skipCount++;
            continue;
          }
        }

        // 3. Tự sinh mã SP
        const code = await generateDocumentCode('SP', 'product');

        // 4. Lưu sản phẩm
        const qty = stock ? parseInt(stock) : 0;
        const product = await tx.product.create({
          data: {
            code,
            sku: sku ? String(sku).trim() : null,
            barcode: barcode ? String(barcode).trim() : null,
            name: String(name).trim(),
            categoryId: category.id,
            importPrice: parseFloat(importPrice),
            salePrice: parseFloat(salePrice),
            vatRate: parseFloat(vatRate || 10),
            unit: unit || 'Cái',
            description: description || null,
            stock: qty,
          },
        });

        // 5. Tạo stock movement nếu có tồn ban đầu
        if (qty > 0) {
          await tx.stockMovement.create({
            data: {
              type: 'IN',
              productId: product.id,
              quantity: qty,
              prevStock: 0,
              newStock: qty,
              warehouseId: defaultWh.id,
              reason: 'Nhập tồn đầu kỳ bằng Excel',
              createdBy: session.username,
            },
          });
        }

        successCount++;
      }
    });

    // Ghi nhật ký hoạt động
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'IMPORT_PRODUCTS',
        details: `Nhập khẩu sản phẩm bằng Excel: Thành công ${successCount} dòng, Bỏ qua ${skipCount} dòng.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({
      message: `Nhập sản phẩm thành công: đã thêm ${successCount} sản phẩm, bỏ qua ${skipCount} dòng.`,
      successCount,
      skipCount,
    });
  } catch (error) {
    console.error('Lỗi API Import Products:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống khi nhập khẩu Excel' }, { status: 500 });
  }
}
