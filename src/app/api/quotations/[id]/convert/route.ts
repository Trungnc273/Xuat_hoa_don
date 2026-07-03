import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/codegen';

// POST: Chuyển đổi báo giá thành hóa đơn
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const { id } = await params;

    // Lấy thông tin báo giá kèm các mặt hàng
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Không tìm thấy báo giá' }, { status: 404 });
    }

    if (quotation.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Báo giá này đã được chuyển thành hóa đơn trước đó' }, { status: 400 });
    }

    // Đọc cài đặt ngân hàng của doanh nghiệp để sinh VietQR
    const setting = await prisma.setting.findFirst();
    // Lấy kho chính phục vụ xuất kho (giống luồng tạo hóa đơn trực tiếp)
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

    // Thực hiện transaction
    const stockWarnings: { productId: string; productName: string; newStock: number }[] = [];
    const invoice = await prisma.$transaction(async (tx) => {
      // Sinh mã hóa đơn atomic — chỉ 1 lần, trong transaction (SPEC GĐ1, FR-2)
      const invoiceCode = await generateDocumentCode(tx, 'HD');

      // Sinh QR VietQR theo mã thật
      let qrCodeUrl = '';
      if (setting && setting.bankAccount) {
        // bankAccount có định dạng: "VCB - 1012999999 - CONG TY..."
        const parts = setting.bankAccount.split('-');
        if (parts.length >= 3) {
          const bankBin = parts[0].trim();
          const accountNo = parts[1].trim();
          const accountName = encodeURIComponent(parts[2].trim());
          const addInfo = encodeURIComponent(`Thanh toan hoa don ${invoiceCode}`);
          qrCodeUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${quotation.total}&addInfo=${addInfo}&accountName=${accountName}`;
        }
      }

      // 1. Tạo hóa đơn
      const newInvoice = await tx.invoice.create({
        data: {
          code: invoiceCode,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          creatorId: session.userId,
          status: 'UNPAID',
          notes: quotation.notes || `Chuyển đổi từ báo giá ${quotation.code}`,
          subtotal: quotation.subtotal,
          vatAmount: quotation.vatAmount,
          discountAmount: quotation.discountAmount,
          total: quotation.total,
          paidAmount: 0,
          remainingAmount: quotation.total, // Toàn bộ tiền hóa đơn chưa trả
          qrCode: qrCodeUrl || null,
          templateName: 'DEFAULT',
          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              discountRate: item.discountRate,
              quantity: item.quantity,
              amount: item.amount,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // 2. Trừ kho + ghi StockMovement giống hệt tạo hóa đơn trực tiếp (SPEC GĐ1, FR-3 —
      //    trước đây luồng convert không trừ kho, gây sai tồn)
      for (const item of quotation.items) {
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const prevStock = product.stock;
            // Tồn kho trung thực: cho phép âm, cấm cắt về 0
            const newStock = prevStock - item.quantity;

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: newStock },
            });

            await tx.stockMovement.create({
              data: {
                type: 'OUT',
                productId: item.productId,
                quantity: item.quantity,
                prevStock,
                newStock,
                warehouseId: defaultWh.id,
                reason: `Xuất kho bán hàng theo hóa đơn ${invoiceCode} (chuyển từ báo giá ${quotation.code})`,
                createdBy: session.username,
              },
            });

            if (newStock < 0) {
              stockWarnings.push({ productId: product.id, productName: product.name, newStock });
            }
          }
        }
      }

      // 3. Cập nhật trạng thái báo giá thành CONVERTED
      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED' },
      });

      return newInvoice;
    }, { maxWait: 10000, timeout: 20000 });

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CONVERT_QUOTATION_TO_INVOICE',
        details: `Đã chuyển đổi báo giá ${quotation.code} thành hóa đơn ${invoice.code} cho khách hàng ${quotation.customer.name} (Số tiền: ${invoice.total} VND)`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({
      message: 'Chuyển đổi báo giá thành hóa đơn thành công',
      invoice,
      // Danh sách sản phẩm bị âm kho sau giao dịch (nếu có) — FE nên hiển thị cảnh báo nhập bù
      stockWarnings,
    });
  } catch (error) {
    console.error('Lỗi chuyển đổi báo giá:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
