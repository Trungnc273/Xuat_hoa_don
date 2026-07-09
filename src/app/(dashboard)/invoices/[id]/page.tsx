'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Printer, XCircle, AlertCircle,
  DollarSign, Layers
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface InvoiceItem {
  id: string;
  productName: string;
  productSku: string | null;
  unitPrice: number;
  vatRate: number;
  discountRate: number;
  quantity: number;
  amount: number;
  productImages?: string[];
}

interface Receipt {
  id: string;
  code: string;
  amount: number;
  date: string;
  paymentMethod: string;
  note: string | null;
}

interface InvoiceDetail {
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
  };
  date: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  qrCode: string | null;
  templateName: string;
  items: InvoiceItem[];
  receipts: Receipt[];
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

export default function InvoiceDetailPage() {
  const { id } = useParams() as { id: string };
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Trạng thái modal thu tiền (lập phiếu thu)
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);

  const { user } = useApp();
  const fetchData = useCallback(async () => {
    try {
      const [resI, resS] = await Promise.all([
        fetch(`/api/invoices/${id}`),
        fetch('/api/settings'),
      ]);

      if (resI.ok) {
        const data = await resI.json();
        setInvoice(data.invoice);
        setPayAmount(data.invoice.remainingAmount.toString()); // Điền sẵn nợ còn lại
      } else {
        setError('Không tìm thấy hóa đơn yêu cầu');
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

  // Thay đổi mẫu in (Save mẫu vào DB)
  const handleTemplateChange = async (tpl: string) => {
    if (!invoice) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: tpl }),
      });
      if (res.ok) {
        setInvoice({
          ...invoice,
          templateName: tpl,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Submit Lập Phiếu Thu
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError('');

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setPayError('Số tiền thu phải lớn hơn 0');
      return;
    }

    if (invoice && amt > invoice.remainingAmount) {
      setPayError('Số tiền thu vượt quá số dư nợ của hóa đơn');
      return;
    }

    setPaying(true);
    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: id,
          amount: amt,
          paymentMethod,
          note: payNote || `Thu tiền hóa đơn ${invoice?.code}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsPayOpen(false);
        setPayNote('');
        void fetchData(); // Tải lại chi tiết hóa đơn mới
      } else {
        setPayError(data.error);
      }
    } catch {
      setPayError('Lỗi kết nối máy chủ');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Đang tải hóa đơn...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive max-w-md mx-auto">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm font-bold">{error || 'Không tải được hóa đơn'}</p>
        <Link href="/invoices" className="text-xs font-semibold text-foreground underline mt-4 block">Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* THANH ĐIỀU HƯỚNG VÀ PHÍM TÁC VỤ (HẨN KHI IN) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Chi tiết Hóa đơn {invoice.code}</h1>
            <p className="text-xs text-muted-foreground">Tình trạng nợ: <span className={`font-bold ${invoice.status === 'PAID' ? 'text-emerald-500' : 'text-destructive'}`}>{invoice.status}</span></p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Lọc thay đổi mẫu in nhanh */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2 text-xs font-semibold">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span>Mẫu in:</span>
            <select
              value={invoice.templateName}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="bg-transparent py-2 focus:outline-none cursor-pointer font-bold"
            >
              <option value="DEFAULT">Truyền thống</option>
              <option value="MODERN">Hiện đại</option>
              <option value="MINIMAL">Tối giản</option>
            </select>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            In hóa đơn
          </button>
          
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && ['ADMIN', 'ACCOUNTANT'].includes(user?.role || '') && (
            <button
              onClick={() => { setPayError(''); setIsPayOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <DollarSign className="h-4 w-4" />
              Thu tiền hóa đơn
            </button>
          )}
        </div>
      </div>

      {/* TẤM IN HÓA ĐƠN A4 DỰA TRÊN CẤU HÌNH TEMPLATE */}
      <div className="bg-card border border-border rounded-2xl shadow-sm bg-white text-black transition-all print:border-none print:shadow-none print:p-0 print:m-0">
        
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

        {/* ----------------- MẪU TRUYỀN THỐNG (DEFAULT) ----------------- */}
        {invoice.templateName === 'DEFAULT' && (
          <div className="p-8 md:p-12">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-gray-200 pb-6">
              <div className="space-y-1">
                {setting?.logo && (
                  <Image src={setting.logo} alt="Company Logo" width={180} height={48} unoptimized className="h-12 w-auto mb-2 object-contain" />
                )}
                <h2 className="text-base font-extrabold tracking-tight uppercase">{setting?.companyName || 'Công ty Cổ phần Giải pháp Công nghệ SolTech'}</h2>
                <p className="text-xs text-gray-600 font-semibold">Mã số thuế: {setting?.taxCode || '0101234567'}</p>
                <p className="text-xs text-gray-600">Địa chỉ: {setting?.address || 'Số 123 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội'}</p>
                <p className="text-xs text-gray-600">Điện thoại: {setting?.phone || '024 3999 8888'} | Website: {setting?.website || ''}</p>
              </div>
              <div className="text-left sm:text-right space-y-1.5 min-w-[150px]">
                <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">HÓA ĐƠN BÁN HÀNG</h1>
                <p className="text-xs font-bold text-gray-700">Số HĐ: {invoice.code}</p>
                <p className="text-xs text-gray-600">Ngày lập: {formatDate(invoice.date)}</p>
              </div>
            </div>

            <div className="mt-8 space-y-1.5 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Thông tin người mua hàng:</h3>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div>
                  <p className="font-bold text-gray-800">{invoice.customer.name}</p>
                  {invoice.customer.company && <p className="font-semibold text-gray-700 mt-0.5">{invoice.customer.company}</p>}
                  {invoice.customer.address && <p className="text-gray-600 mt-0.5">Địa chỉ: {invoice.customer.address}</p>}
                </div>
                <div className="space-y-0.5">
                  {invoice.customer.taxCode && <p className="text-gray-600">Mã số thuế: {invoice.customer.taxCode}</p>}
                  {invoice.customer.phone && <p className="text-gray-600">Điện thoại: {invoice.customer.phone}</p>}
                </div>
              </div>
            </div>

            {/* BẢNG MẶT HÀNG */}
            <div className="mt-8">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100 text-gray-700 font-bold">
                    <th className="py-2.5 px-2 w-10 text-center">STT</th>
                    <th className="py-2.5 px-2">Tên hàng hóa, dịch vụ</th>
                    <th className="py-2.5 px-2 w-16 text-center">SL</th>
                    <th className="py-2.5 px-2 w-28 text-right">Đơn giá</th>
                    <th className="py-2.5 px-2 w-16 text-center">VAT</th>
                    <th className="py-2.5 px-2 w-16 text-center">C.Khấu</th>
                    <th className="py-2.5 px-2 w-28 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-2 text-center text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          {item.productImages && item.productImages.length > 0 ? (
                            <Image src={item.productImages[0]} alt={item.productName} width={36} height={36} unoptimized className="h-9 w-9 rounded object-cover border border-gray-200 bg-gray-50 flex-shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400 bg-gray-50 flex-shrink-0">Ảnh</div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800">{item.productName}</p>
                          </div>
                        </div>
                      </td>
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

            {/* DƯ NỢ / THANH TOÁN VÀ QR */}
            <div className="mt-8 grid gap-6 md:grid-cols-2 items-end">
              <div>
                {invoice.qrCode && (
                  <div className="border border-gray-200 p-3.5 rounded-xl bg-gray-50 text-center w-fit space-y-2">
                    <Image src={invoice.qrCode} alt="VietQR Payment Link" width={128} height={128} unoptimized className="h-32 w-32 mx-auto object-contain border border-white bg-white" />
                    <p className="text-[9px] font-bold text-gray-700 uppercase tracking-wider leading-none">Quét mã chuyển khoản nhanh</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 text-xs text-gray-700 font-semibold ml-auto w-full max-w-[280px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Cộng tiền hàng trước thuế:</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-red-500">
                  <span>Chiết khấu:</span>
                  <span>-{formatCurrency(invoice.discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Thuế giá trị gia tăng (VAT):</span>
                  <span>{formatCurrency(invoice.vatAmount)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between items-center text-sm">
                  <span className="font-black text-gray-800">TỔNG CỘNG:</span>
                  <span className="font-black text-gray-900 text-base">{formatCurrency(invoice.total)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600">
                  <span>Đã thanh toán:</span>
                  <span>{formatCurrency(invoice.paidAmount)}</span>
                </div>
                <div className="border-t border-gray-100 pt-1.5 flex justify-between items-center text-xs text-red-500 font-bold">
                  <span>Dư nợ còn lại:</span>
                  <span>{formatCurrency(invoice.remainingAmount)}</span>
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 text-center text-xs text-gray-700 pt-6 border-t border-gray-100">
              <div>
                <p className="font-bold uppercase">ĐẠI DIỆN KHÁCH HÀNG</p>
                <div className="h-20"></div>
              </div>
              <div>
                <p className="font-bold uppercase">NGƯỜI LẬP HÓA ĐƠN</p>
                <div className="h-20 flex items-end justify-center">
                  <p className="font-bold uppercase text-gray-800">{invoice.creator.username}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- MẪU HIỆN ĐẠI (MODERN) ----------------- */}
        {invoice.templateName === 'MODERN' && (
          <div className="p-8 md:p-12 font-sans">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-4 border-indigo-600">
              <div>
                <span className="text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded uppercase tracking-wider">Hóa đơn điện tử</span>
                <h1 className="text-3xl font-black text-indigo-950 mt-1 tracking-tight">{invoice.code}</h1>
                <p className="text-xs text-gray-500 mt-1">Xuất bán ngày: {formatDate(invoice.date)}</p>
              </div>
              <div className="text-left sm:text-right space-y-1">
                <h2 className="text-sm font-black text-indigo-900">{setting?.companyName}</h2>
                <p className="text-xs text-gray-500">{setting?.address}</p>
                <p className="text-xs text-gray-600">Representative: {setting?.representative}</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 mt-8 text-xs">
              <div className="border border-indigo-100 p-4 rounded-xl bg-indigo-50/20">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-2">Thông tin bên mua</span>
                <p className="font-bold text-sm text-indigo-950">{invoice.customer.name}</p>
                <p className="text-gray-600 mt-1">{invoice.customer.company || 'Cá nhân mua hàng'}</p>
                {invoice.customer.address && <p className="text-gray-500 mt-0.5">{invoice.customer.address}</p>}
                {invoice.customer.phone && <p className="text-gray-500 mt-0.5">SĐT: {invoice.customer.phone}</p>}
              </div>
              
              <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Thông tin tài chính</span>
                  <p className="text-gray-600">Hệ thống thanh toán tự động chuyển khoản nhanh.</p>
                </div>
                {setting?.bankAccount && (
                  <p className="font-bold text-indigo-950 mt-4">STK: {setting.bankAccount}</p>
                )}
              </div>
            </div>

            {/* BẢNG MẶT HÀNG */}
            <div className="mt-8 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-900 text-white font-bold">
                    <th className="p-3 w-10 text-center">STT</th>
                    <th className="p-3">Hàng hóa & SKU</th>
                    <th className="p-3 w-16 text-center">SL</th>
                    <th className="p-3 w-28 text-right">Đơn giá</th>
                    <th className="p-3 w-16 text-center">VAT</th>
                    <th className="p-3 w-28 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-indigo-50/10">
                      <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {item.productImages && item.productImages.length > 0 ? (
                            <Image src={item.productImages[0]} alt={item.productName} width={36} height={36} unoptimized className="h-9 w-9 rounded object-cover border border-gray-200 bg-gray-50 flex-shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400 bg-gray-50 flex-shrink-0">Ảnh</div>
                          )}
                          <div>
                            <p className="font-bold text-gray-800">{item.productName}</p>
                            {item.productSku && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.productSku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-gray-800">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-center text-gray-500">{item.vatRate}%</td>
                      <td className="p-3 text-right font-bold text-gray-800">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PHẦN DƯỚI */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6">
              <div>
                {invoice.qrCode && (
                  <div className="border border-indigo-100 p-3 rounded-2xl bg-indigo-50/30 flex items-center gap-4">
                    <Image src={invoice.qrCode} alt="VietQR" width={112} height={112} unoptimized className="h-28 w-28 object-contain bg-white rounded-lg border border-white" />
                    <div>
                      <p className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">Thanh toán tự động</p>
                      <p className="text-[9px] text-gray-500 max-w-[120px] mt-1">Quét mã bằng bất kỳ ví hoặc app ngân hàng của bạn để thanh toán nợ.</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="w-full sm:w-72 space-y-2 text-xs font-semibold text-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Giá trị trước thuế:</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-red-500">
                  <span>Chiết khấu hàng bán:</span>
                  <span>-{formatCurrency(invoice.discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Thuế GTGT (VAT):</span>
                  <span>{formatCurrency(invoice.vatAmount)}</span>
                </div>
                <div className="border-t-2 border-indigo-600 pt-2 flex justify-between items-center text-sm font-extrabold text-indigo-950">
                  <span>TỔNG CỘNG:</span>
                  <span className="text-base">{formatCurrency(invoice.total)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600">
                  <span>Đã thu tiền:</span>
                  <span>{formatCurrency(invoice.paidAmount)}</span>
                </div>
                <div className="border-t border-gray-100 pt-1 flex justify-between items-center text-xs text-red-500 font-bold">
                  <span>Dư nợ còn lại:</span>
                  <span>{formatCurrency(invoice.remainingAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- MẪU TỐI GIẢN (MINIMAL) ----------------- */}
        {invoice.templateName === 'MINIMAL' && (
          <div className="p-8 md:p-12 font-serif text-sm">
            <div className="border-b border-gray-900 pb-8 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-light tracking-tight text-gray-900">Invoice</h1>
                <p className="text-xs font-mono text-gray-500 mt-1">NO. {invoice.code} / DATE: {formatDate(invoice.date)}</p>
              </div>
              <div className="text-right text-xs space-y-0.5 text-gray-600">
                <p className="font-bold text-gray-900">{setting?.companyName}</p>
                <p>{setting?.address}</p>
                <p>{setting?.email}</p>
              </div>
            </div>

            <div className="mt-8 text-xs grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Bill To:</p>
                <p className="font-bold text-gray-900 mt-1">{invoice.customer.name}</p>
                <p className="text-gray-600">{invoice.customer.company || 'Individual Client'}</p>
                <p className="text-gray-500">{invoice.customer.address || ''}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Payment details:</p>
                <p className="text-gray-600 mt-1">{setting?.bankAccount || 'Bank transfer'}</p>
              </div>
            </div>

            {/* BẢNG SẢN PHẨM */}
            <div className="mt-8">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-900 text-gray-900 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2">Item description</th>
                    <th className="py-2 w-16 text-center">Qty</th>
                    <th className="py-2 w-28 text-right">Unit price</th>
                    <th className="py-2 w-28 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {item.productImages && item.productImages.length > 0 ? (
                            <Image src={item.productImages[0]} alt={item.productName} width={36} height={36} unoptimized className="h-9 w-9 rounded object-cover border border-gray-200 bg-gray-50 flex-shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400 bg-gray-50 flex-shrink-0">Ảnh</div>
                          )}
                          <div>
                            <p className="font-bold text-gray-900">{item.productName}</p>
                            {item.productSku && <p className="text-[9px] font-mono text-gray-400 mt-0.5">{item.productSku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center text-gray-800">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-end">
              <div className="w-64 space-y-2 text-xs font-semibold text-gray-800">
                <div className="flex justify-between items-center text-gray-500">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-red-500">
                  <span>Discount:</span>
                  <span>-{formatCurrency(invoice.discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span>VAT:</span>
                  <span>{formatCurrency(invoice.vatAmount)}</span>
                </div>
                <div className="border-t border-gray-900 pt-2 flex justify-between items-center text-sm font-bold text-gray-900">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL LẬP PHIẾU THU TIỀN */}
      {isPayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsPayOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Ghi nhận phiếu thu hóa đơn</h3>
            {payError && <div className="mb-3 text-xs font-semibold text-destructive">{payError}</div>}
            
            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Số tiền thu nợ *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground font-extrabold text-sm"
                  placeholder="e.g. 5000000"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">Dư nợ còn lại tối đa: {formatCurrency(invoice.remainingAmount)}</span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Hình thức thanh toán *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer"
                >
                  <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="CARD">Quẹt thẻ ngân hàng</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nội dung phiếu thu</label>
                <textarea
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-border p-2 bg-transparent focus:outline-none focus:border-foreground resize-none"
                  placeholder={`Thu tiền nợ hóa đơn ${invoice.code}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsPayOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" disabled={paying} className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
                  {paying ? 'Đang lập phiếu thu...' : 'Ghi nhận phiếu thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
