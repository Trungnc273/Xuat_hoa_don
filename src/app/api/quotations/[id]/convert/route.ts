import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

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
    let qrCodeUrl = '';

    if (setting && setting.bankAccount) {
      // bankAccount có định dạng: "VCB - 1012999999 - CONG TY..."
      const parts = setting.bankAccount.split('-');
      if (parts.length >= 3) {
        const bankBin = parts[0].trim();
        const accountNo = parts[1].trim();
        const accountName = encodeURIComponent(parts[2].trim());
        const amount = quotation.total;
        
        // Tạo mã hóa đơn tự động tiếp theo để gán vào nội dung chuyển khoản
        const nextInvoiceCode = await generateDocumentCode('HD', 'invoice');
        const addInfo = encodeURIComponent(`Thanh toan hoa don ${nextInvoiceCode}`);

        // Sinh link VietQR động
        qrCodeUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
      }
    }

    // Thực hiện transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceCode = await generateDocumentCode('HD', 'invoice');

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

      // 2. Cập nhật trạng thái báo giá thành CONVERTED
      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED' },
      });

      return newInvoice;
    });

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
    });
  } catch (error) {
    console.error('Lỗi chuyển đổi báo giá:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
