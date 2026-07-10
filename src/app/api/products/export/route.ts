import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET: Lấy toàn bộ danh sách sản phẩm phẳng phục vụ xuất file Excel/CSV
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const [products, tiers] = await Promise.all([
      prisma.product.findMany({
      include: {
        category: {
          select: { name: true },
        },
        tierPrices: {
          include: {
            tier: true,
          },
        },
      },
      orderBy: { code: 'asc' },
      }),
      prisma.customerPriceTier.findMany({ orderBy: { name: 'asc' } }),
    ]);

    // Định dạng dữ liệu phẳng để hiển thị trên file Excel dễ dàng
    const exportData = products.map((p) => {
      const row: Record<string, string | number> = {
        'Mã Sản Phẩm': p.code,
        'Mã SKU': p.sku || '',
        'Tên Sản Phẩm': p.name,
        'Danh Mục': p.category?.name || 'Không phân mục',
        'Giá Nhập': p.importPrice,
        'Giá Khách Lẻ': p.salePrice,
        'Thuế VAT (%)': p.vatRate,
        'Đơn Vị Tính': p.unit,
        'Tồn Kho': p.stock,
        'Mô Tả': p.description || '',
      };

      tiers.forEach((tier) => {
        row[`Giá ${tier.name}`] = '';
      });

      p.tierPrices.forEach((tierPrice) => {
        row[`Giá ${tierPrice.tier.name}`] = tierPrice.price;
      });

      return row;
    });

    return NextResponse.json({ products: exportData });
  } catch (error) {
    console.error('Lỗi API Export Products:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống khi xuất dữ liệu' }, { status: 500 });
  }
}
