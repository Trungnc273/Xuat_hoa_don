import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

// 1. GET: Danh sách hóa đơn (có phân trang, lọc trạng thái, tìm kiếm)
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // UNPAID, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
    const customerId = searchParams.get('customerId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    // Nếu là nhân viên, chỉ xem hóa đơn mình tạo
    if (session.role === 'STAFF') {
      where.creatorId = session.userId;
    }

    const total = await prisma.invoice.count({ where });

    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          select: { code: true, name: true, company: true },
        },
        creator: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Invoices:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Tạo mới hóa đơn trực tiếp (Giảm kho, tạo StockMovement xuất kho)
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { customerId, notes, items, templateName } = body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Vui lòng cung cấp khách hàng và danh sách sản phẩm' }, { status: 400 });
    }

    // 1. Tính toán giá trị hóa đơn
    let subtotal = 0;
    let discountAmount = 0;
    let vatAmount = 0;
    let total = 0;

    const itemsData = items.map((item: any) => {
      const unitPrice = parseFloat(item.unitPrice || 0);
      const quantity = parseInt(item.quantity || 1);
      const vatRate = parseFloat(item.vatRate || 10);
      const discountRate = parseFloat(item.discountRate || 0);

      const itemSubtotal = unitPrice * quantity;
      const itemDiscount = itemSubtotal * (discountRate / 100);
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemVat = itemAfterDiscount * (vatRate / 100);
      const itemAmount = itemAfterDiscount + itemVat;

      subtotal += itemSubtotal;
      discountAmount += itemDiscount;
      vatAmount += itemVat;
      total += itemAmount;

      return {
        productId: item.productId || null,
        productName: item.productName,
        productSku: item.productSku || null,
        unitPrice,
        vatRate,
        discountRate,
        quantity,
        amount: itemAmount,
      };
    });

    // 2. Sinh mã QR VietQR động
    const setting = await prisma.setting.findFirst();
    let qrCodeUrl = '';
    const invoiceCode = await generateDocumentCode('HD', 'invoice');

    if (setting && setting.bankAccount) {
      const parts = setting.bankAccount.split('-');
      if (parts.length >= 3) {
        const bankBin = parts[0].trim();
        const accountNo = parts[1].trim();
        const accountName = encodeURIComponent(parts[2].trim());
        const addInfo = encodeURIComponent(`Thanh toan hoa don ${invoiceCode}`);
        
        qrCodeUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${total}&addInfo=${addInfo}&accountName=${accountName}`;
      }
    }

    // Lấy kho chính phục vụ xuất kho
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

    // 3. Thực hiện trong transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // A. Tạo hóa đơn
      const createdInvoice = await tx.invoice.create({
        data: {
          code: invoiceCode,
          customerId,
          creatorId: session.userId,
          status: 'UNPAID',
          notes,
          subtotal,
          vatAmount,
          discountAmount,
          total,
          paidAmount: 0,
          remainingAmount: total,
          qrCode: qrCodeUrl || null,
          templateName: templateName || 'DEFAULT',
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // B. Trừ kho và tạo StockMovement cho từng sản phẩm
      for (const item of itemsData) {
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (product) {
            const prevStock = product.stock;
            // Chỉ trừ kho đối với hàng hóa thực tế (không trừ nợ âm nếu không cho phép, nhưng ở đây trừ kho bình thường)
            const newStock = Math.max(0, prevStock - item.quantity);

            // Cập nhật tồn kho sản phẩm
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: newStock },
            });

            // Ghi nhận xuất kho
            await tx.stockMovement.create({
              data: {
                type: 'OUT',
                productId: item.productId,
                quantity: item.quantity,
                prevStock,
                newStock,
                warehouseId: defaultWh.id,
                reason: `Xuất kho bán hàng theo hóa đơn ${invoiceCode}`,
                createdBy: session.username,
              },
            });
          }
        }
      }

      return createdInvoice;
    });

    // Ghi nhật ký hệ thống
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_INVOICE',
        details: `Đã tạo hóa đơn mới: ${invoice.code} cho khách hàng ${invoice.customer.name} (Số tiền: ${invoice.total} VND). Đã trừ kho tương ứng.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo hóa đơn thành công', invoice });
  } catch (error) {
    console.error('Lỗi POST Invoice:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
