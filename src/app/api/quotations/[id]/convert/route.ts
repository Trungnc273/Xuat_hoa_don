import { NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth';
import { handleError, fail } from '@/server/http';
import { logActivity } from '@/server/activity-log';
import { BusinessError, convertQuotationToInvoice } from '@/server/services/quotation.service';

// POST: Chuyển đổi báo giá thành hóa đơn (Route mỏng: auth → service → response)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['ADMIN', 'MANAGER', 'STAFF']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { invoice, stockWarnings, quotation } = await convertQuotationToInvoice(auth.session, id);

    await logActivity(
      auth.session,
      'CONVERT_QUOTATION_TO_INVOICE',
      `Đã chuyển đổi báo giá ${quotation.code} thành hóa đơn ${invoice.code} cho khách hàng ${quotation.customer.name} (Số tiền: ${invoice.total} VND)`,
      req
    );

    return NextResponse.json({
      message: 'Chuyển đổi báo giá thành hóa đơn thành công',
      invoice,
      // Danh sách sản phẩm bị âm kho sau giao dịch (nếu có) — FE nên hiển thị cảnh báo nhập bù
      stockWarnings,
    });
  } catch (error) {
    if (error instanceof BusinessError) return fail(error.message, error.status);
    return handleError('chuyển đổi báo giá', error);
  }
}
