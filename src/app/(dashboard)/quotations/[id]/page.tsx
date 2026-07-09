'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Printer,
  CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface QuotationItem {
  id: string;
  productName: string;
  productSku: string | null;
  description: string | null;
  unitPrice: number;
  vatRate: number;
  discountRate: number;
  quantity: number;
  amount: number;
}

interface QuotationDetail {
  id: string;
  code: string;
  customerId: string;
  customer: {
    code: string;
    name: string;
    company: string | null;
    taxCode: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    contactPerson: string | null;
  };
  date: string;
  dueDate: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  items: QuotationItem[];
  creator: { username: string; email: string };
  createdAt: string;
}

interface Setting {
  logo: string | null;
  companyName: string;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankAccount: string | null;
  representative: string | null;
}

export default function QuotationDetailPage() {
  const { id } = useParams() as { id: string };
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { user } = useApp();

  const fetchData = useCallback(async () => {
    try {
      const [resQ, resS] = await Promise.all([
        fetch(`/api/quotations/${id}`),
        fetch('/api/settings'),
      ]);

      if (resQ.ok) {
        const data = await resQ.json();
        setQuotation(data.quotation);
      } else {
        setError('Không tìm thấy báo giá yêu cầu');
      }

      if (resS.ok) {
        const data = await resS.json();
        setSetting(data.setting);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const handleConvertToInvoice = async () => {
    if (!quotation) return;
    if (!confirm('Bạn có đồng ý chuyển báo giá này thành Hóa đơn bán hàng thực tế? Tồn kho sản phẩm tương ứng sẽ bị giảm.')) return;

    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        alert('Chuyển đổi thành công! Chuyển hướng sang hóa đơn...');
        router.push(`/invoices/${data.invoice.id}`);
      } else {
        alert(data.error || 'Có lỗi xảy ra khi chuyển đổi');
      }
    } catch {
      alert('Không thể thực hiện chuyển đổi');
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Đang tải chứng từ...</p>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive max-w-md mx-auto">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm font-bold">{error || 'Không tải được báo giá'}</p>
        <Link href="/quotations" className="text-xs font-semibold text-foreground underline mt-4 block">Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* THANH ĐIỀU HƯỚNG VÀ PHÍM TÁC VỤ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/quotations" className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Chi tiết Báo giá {quotation.code}</h1>
            <p className="text-xs text-muted-foreground">Trạng thái: <span className="font-bold uppercase text-primary">{quotation.status}</span></p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            In báo giá
          </button>
          
          {quotation.status !== 'CONVERTED' && ['ADMIN', 'MANAGER', 'STAFF'].includes(user?.role || '') && (
            <button
              onClick={handleConvertToInvoice}
              disabled={converting}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {converting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Chuyển thành Hóa đơn
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* TẤM IN BÁO GIÁ CHUẨN KHỔ GIẤY A4 */}
      <div className="bg-card border border-border p-8 md:p-12 rounded-2xl shadow-sm bg-white text-black transition-all print:border-none print:shadow-none print:p-0 print:m-0">
        
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
            }
            header, aside {
              display: none !important;
            }
            .bg-card {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
        `}} />

        {/* TIÊU ĐỀ DOANH NGHIỆP */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-gray-200 pb-6">
          <div className="space-y-1">
            {setting?.logo && (
              <Image src={setting.logo} alt="Company Logo" width={180} height={48} unoptimized className="h-12 w-auto mb-2 object-contain" />
            )}
            <h2 className="text-base font-extrabold tracking-tight uppercase">{setting?.companyName || 'Công ty Cổ phần Giải pháp Công nghệ SolTech'}</h2>
            <p className="text-xs text-gray-600 font-semibold">Mã số thuế: {setting?.taxCode || '0101234567'}</p>
            <p className="text-xs text-gray-600">Địa chỉ: {setting?.address || 'Số 123 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội'}</p>
            <p className="text-xs text-gray-600">Điện thoại: {setting?.phone || '024 3999 8888'} | Email: {setting?.email || 'info@soltech.com'}</p>
          </div>
          <div className="text-left sm:text-right space-y-1.5 min-w-[150px]">
            <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">BÁO GIÁ</h1>
            <p className="text-xs font-bold text-gray-700">Số: {quotation.code}</p>
            <p className="text-xs text-gray-600">Ngày lập: {formatDate(quotation.date)}</p>
            {quotation.dueDate && (
              <p className="text-xs text-gray-600">Hạn báo giá: {formatDate(quotation.dueDate)}</p>
            )}
          </div>
        </div>

        {/* THÔNG TIN KHÁCH HÀNG */}
        <div className="mt-8 space-y-1.5 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Khách hàng nhận báo giá:</h3>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div>
              <p className="font-bold text-gray-800">{quotation.customer.name}</p>
              {quotation.customer.company && <p className="font-semibold text-gray-700 mt-0.5">{quotation.customer.company}</p>}
              {quotation.customer.address && <p className="text-gray-600 mt-0.5">Địa chỉ: {quotation.customer.address}</p>}
            </div>
            <div className="space-y-0.5">
              {quotation.customer.taxCode && <p className="text-gray-600">Mã số thuế: {quotation.customer.taxCode}</p>}
              {quotation.customer.phone && <p className="text-gray-600">Điện thoại: {quotation.customer.phone}</p>}
              {quotation.customer.email && <p className="text-gray-600">Email: {quotation.customer.email}</p>}
            </div>
          </div>
        </div>

        {/* BẢNG SẢN PHẨM */}
        <div className="mt-8">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-100 text-gray-700 font-bold">
                <th className="py-2.5 px-2 w-10 text-center">STT</th>
                <th className="py-2.5 px-2">Tên hàng hóa, dịch vụ</th>
                <th className="py-2.5 px-2">Mô tả / Thông số</th>
                <th className="py-2.5 px-2 w-16 text-center">ĐVT</th>
                <th className="py-2.5 px-2 w-16 text-center">SL</th>
                <th className="py-2.5 px-2 w-28 text-right">Đơn giá</th>
                <th className="py-2.5 px-2 w-16 text-center">VAT</th>
                <th className="py-2.5 px-2 w-16 text-center">C.Khấu</th>
                <th className="py-2.5 px-2 w-28 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quotation.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="py-2.5 px-2 text-center text-gray-500">{idx + 1}</td>
                  <td className="py-2.5 px-2">
                    <p className="font-bold text-gray-800">{item.productName}</p>
                    {item.productSku && <p className="text-[10px] text-gray-500 font-mono mt-0.5">SKU: {item.productSku}</p>}
                  </td>
                  <td className="py-2.5 px-2 text-gray-600 whitespace-pre-line">
                    {item.description || '—'}
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-600">Cái</td>
                  <td className="py-2.5 px-2 text-center font-semibold text-gray-800">{item.quantity}</td>
                  <td className="py-2.5 px-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2.5 px-2 text-center text-gray-500">{item.vatRate}%</td>
                  <td className="py-2.5 px-2 text-center text-gray-500">{item.discountRate}%</td>
                  <td className="py-2.5 px-2 text-right font-bold text-gray-800">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TỔNG TIỀN THANH TOÁN */}
        <div className="mt-8 flex justify-end">
          <div className="w-80 space-y-2 text-xs text-gray-700 font-semibold">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Tổng tiền hàng trước thuế:</span>
              <span>{formatCurrency(quotation.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-red-500">
              <span>Chiết khấu thương mại:</span>
              <span>-{formatCurrency(quotation.discountAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Thuế giá trị gia tăng (VAT):</span>
              <span>{formatCurrency(quotation.vatAmount)}</span>
            </div>
            <div className="border-t border-gray-300 pt-3 flex justify-between items-center text-sm">
              <span className="font-black text-gray-800 uppercase">Tổng tiền thanh toán:</span>
              <span className="font-black text-gray-900 text-base">{formatCurrency(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* GHI CHÚ */}
        {quotation.notes && (
          <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-600 space-y-1">
            <p className="font-bold text-gray-700">Ghi chú điều khoản:</p>
            <p className="italic">{quotation.notes}</p>
          </div>
        )}

        {/* CHỮ KÝ */}
        <div className="mt-12 grid grid-cols-2 text-center text-xs text-gray-700 pt-6 border-t border-gray-100">
          <div>
            <p className="font-bold uppercase">ĐẠI DIỆN KHÁCH HÀNG</p>
            <p className="text-[10px] text-gray-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20"></div>
          </div>
          <div>
            <p className="font-bold uppercase">NGƯỜI LẬP BÁO GIÁ</p>
            <p className="text-[10px] text-gray-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20 flex items-end justify-center">
              <p className="font-bold uppercase text-gray-800">{quotation.creator.username}</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
