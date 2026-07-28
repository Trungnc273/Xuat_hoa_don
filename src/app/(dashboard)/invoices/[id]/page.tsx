'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Printer, XCircle, AlertCircle,
  DollarSign, Layers, Edit, Save, X, Plus, Trash2, RefreshCw, PenLine
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import CustomerTagChip from '@/components/CustomerTagChip';
import MoneyInput from '@/components/MoneyInput';

interface CustomerPriceTier {
  id: string;
  name: string;
  color: string;
}

interface ProductTierPrice {
  id: string;
  tierId: string;
  price: number;
  tier: CustomerPriceTier;
}

interface EditableProduct {
  id: string;
  code: string;
  sku: string | null;
  name: string;
  description: string | null;
  salePrice: number;
  tierPrices: ProductTierPrice[];
  vatRate: number;
  unit: string;
  stock: number;
}

interface EditItemInput {
  productId: string;
  productName: string;
  productSku: string;
  description: string;
  unitPrice: number;
  quantity: number;
  vatRate: number;
  discountRate: number;
  amount: number;
}

interface EditCustomFieldEntry {
  id: string;
  key: string;
  value: string;
}

const calcItemAmount = (price: number, qty: number, vat: number, disc: number) => {
  const subtotal = price * qty;
  const discount = subtotal * (disc / 100);
  const afterDiscount = subtotal - discount;
  return afterDiscount + afterDiscount * (vat / 100);
};

const makeEntryId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface InvoiceItem {
  id: string;
  productId: string | null;
  productName: string;
  productSku: string | null;
  unitPrice: number;
  vatRate: number;
  discountRate: number;
  quantity: number;
  amount: number;
  description?: string | null;
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
    id: string;
    code: string;
    name: string;
    company: string | null;
    taxCode: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    tagName: string | null;
    tagColor: string | null;
    priceTier: { id: string; name: string; color: string } | null;
  };
  date: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  notes: string | null;
  customFields?: Record<string, string> | null;
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

  // Chế độ sửa hóa đơn (mặt hàng, ghi chú, thông tin bổ sung) — như báo giá
  const [isEditing, setIsEditing] = useState(false);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [editItems, setEditItems] = useState<EditItemInput[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editCustomFields, setEditCustomFields] = useState<EditCustomFieldEntry[]>([]);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [stockWarnings, setStockWarnings] = useState<{ productId: string; productName: string; newStock: number }[]>([]);

  // Sửa trực tiếp số tiền đã thu (độc lập với chế độ sửa mặt hàng — theo yêu cầu chủ dự án 15/07/2026)
  const [isEditingPaid, setIsEditingPaid] = useState(false);
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [savingPaid, setSavingPaid] = useState(false);
  const [paidError, setPaidError] = useState('');

  const { user } = useApp();
  const canEditInvoice = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user?.role || '');
  // Chỉ chặn sửa MẶT HÀNG khi đã có thanh toán — vẫn sửa được ghi chú/thông tin bổ sung
  const hasPayment = (invoice?.paidAmount ?? 0) > 0 || (invoice?.receipts.length ?? 0) > 0;

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

  // Bấm "Sửa hóa đơn": nạp danh sách sản phẩm (nếu chưa có) + điền sẵn dữ liệu hiện tại vào form sửa
  const handleStartEdit = async () => {
    if (!invoice) return;
    setEditError('');
    setEditItems(invoice.items.map((item) => ({
      productId: item.productId || '',
      productName: item.productName,
      productSku: item.productSku || '',
      description: item.description || '',
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      vatRate: item.vatRate,
      discountRate: item.discountRate,
      amount: item.amount,
    })));
    setEditNotes(invoice.notes || '');
    setEditCustomFields(Object.entries(invoice.customFields || {}).map(([key, value]) => ({ id: makeEntryId(), key, value })));
    setIsEditing(true);

    if (products.length === 0) {
      try {
        const res = await fetch('/api/products?limit=999');
        if (res.ok) setProducts((await res.json()).products);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCancelEditItems = () => {
    setIsEditing(false);
    setEditError('');
  };

  const getPriceForCustomerTier = (product: EditableProduct) => {
    const tierId = invoice?.customer.priceTier?.id || null;
    const matched = tierId ? product.tierPrices.find((tp) => tp.tierId === tierId) : null;
    return matched?.price ?? product.salePrice;
  };

  const handleEditProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const unitPrice = getPriceForCustomerTier(product);
    setEditItems((cur) => cur.map((item, i) => {
      if (i !== index) return item;
      return {
        ...item,
        productId: product.id,
        productName: product.name,
        productSku: product.sku || '',
        description: product.description || item.description || '',
        unitPrice,
        vatRate: product.vatRate,
        amount: calcItemAmount(unitPrice, item.quantity, product.vatRate, item.discountRate),
      };
    }));
  };

  const handleEditItemValueChange = (index: number, field: keyof EditItemInput, value: string) => {
    setEditItems((cur) => cur.map((item, i) => {
      if (i !== index) return item;
      let numericValue = parseFloat(value) || 0;
      if (field === 'quantity') numericValue = parseInt(value, 10) || 1;
      const updated = { ...item, [field]: numericValue };
      updated.amount = calcItemAmount(
        field === 'unitPrice' ? numericValue : item.unitPrice,
        field === 'quantity' ? numericValue : item.quantity,
        field === 'vatRate' ? numericValue : item.vatRate,
        field === 'discountRate' ? numericValue : item.discountRate
      );
      return updated;
    }));
  };

  const handleEditItemDescriptionChange = (index: number, value: string) => {
    setEditItems((cur) => cur.map((item, i) => (i === index ? { ...item, description: value } : item)));
  };

  const addEditRow = () => setEditItems((cur) => [...cur, {
    productId: '', productName: '', productSku: '', description: '',
    unitPrice: 0, quantity: 1, vatRate: 10, discountRate: 0, amount: 0,
  }]);
  const removeEditRow = (index: number) => setEditItems((cur) => cur.filter((_, i) => i !== index));

  const addEditCustomField = () => setEditCustomFields((cur) => [...cur, { id: makeEntryId(), key: '', value: '' }]);
  const updateEditCustomField = (fid: string, field: 'key' | 'value', value: string) =>
    setEditCustomFields((cur) => cur.map((e) => (e.id === fid ? { ...e, [field]: value } : e)));
  const removeEditCustomField = (fid: string) => setEditCustomFields((cur) => cur.filter((e) => e.id !== fid));

  const editTotal = editItems.reduce((sum, item) => sum + item.amount, 0);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!hasPayment) {
      if (editItems.length === 0) {
        setEditError('Vui lòng chọn ít nhất 1 sản phẩm');
        return;
      }
      if (editItems.some((item) => !item.productId)) {
        setEditError('Có dòng sản phẩm chưa được chọn hàng hóa cụ thể');
        return;
      }
    }

    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        notes: editNotes,
        customFields: editCustomFields.reduce<Record<string, string>>((acc, f) => {
          const key = f.key.trim();
          if (key) acc[key] = f.value.trim();
          return acc;
        }, {}),
      };
      // Chỉ gửi items khi được phép sửa (chưa phát sinh thanh toán) — tránh 400 từ server
      if (!hasPayment) body.items = editItems;

      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.details?.[0]?.message || data.error || 'Không lưu được thay đổi');
        return;
      }
      setStockWarnings(data.stockWarnings || []);
      setIsEditing(false);
      void fetchData();
    } catch {
      setEditError('Đã xảy ra lỗi kết nối');
    } finally {
      setSavingEdit(false);
    }
  };

  // Sửa trực tiếp số tiền đã thu (không qua Phiếu thu) — độc lập với chế độ sửa mặt hàng
  const handleStartEditPaid = () => {
    if (!invoice) return;
    setPaidError('');
    setEditPaidAmount(invoice.paidAmount.toString());
    setIsEditingPaid(true);
  };

  const handleSavePaidAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaidError('');
    const amt = Number(editPaidAmount);
    if (Number.isNaN(amt) || amt < 0) {
      setPaidError('Số tiền không hợp lệ');
      return;
    }
    if (invoice && amt > invoice.total) {
      setPaidError('Số tiền đã thu không được vượt quá tổng tiền hóa đơn');
      return;
    }

    setSavingPaid(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaidError(data.error || 'Không lưu được thay đổi');
        return;
      }
      setIsEditingPaid(false);
      void fetchData();
    } catch {
      setPaidError('Lỗi kết nối máy chủ');
    } finally {
      setSavingPaid(false);
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

  // Dòng "Đã thanh toán" dùng chung cho cả 3 mẫu — có thể sửa trực tiếp tại chỗ
  const paidAmountBlock = isEditingPaid ? (
    <form onSubmit={handleSavePaidAmount} className="rounded-lg border border-dashed border-emerald-400 p-2 space-y-1.5 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500">Đã thanh toán:</span>
        <MoneyInput
          autoFocus
          value={editPaidAmount ? Number(editPaidAmount) : 0}
          onChange={(v) => setEditPaidAmount(v ? v.toString() : '')}
          className="w-32 rounded border border-gray-300 px-2 py-1 text-right font-bold"
        />
      </div>
      {paidError && <p className="text-[10px] text-red-500">{paidError}</p>}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => setIsEditingPaid(false)} className="rounded px-2 py-1 text-[10px] font-bold border border-gray-300 hover:bg-gray-50">Hủy</button>
        <button type="submit" disabled={savingPaid} className="rounded px-2 py-1 text-[10px] font-bold bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50">
          {savingPaid ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </form>
  ) : (
    <div className="flex justify-between items-center text-emerald-600">
      <span>Đã thanh toán:</span>
      <span className="inline-flex items-center gap-1.5">
        {formatCurrency(invoice.paidAmount)}
        {canEditInvoice && invoice.status !== 'CANCELLED' && (
          <button type="button" onClick={handleStartEditPaid} title="Sửa số tiền đã thu" className="print:hidden text-gray-400 hover:text-emerald-600 cursor-pointer">
            <PenLine className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );

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

          {!isEditing && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              In hóa đơn
            </button>
          )}

          {!isEditing && canEditInvoice && invoice.status !== 'CANCELLED' && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
            >
              <Edit className="h-4 w-4" />
              Sửa hóa đơn
            </button>
          )}

          {!isEditing && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && ['ADMIN', 'ACCOUNTANT'].includes(user?.role || '') && (
            <button
              onClick={() => { setPayError(''); setIsPayOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <DollarSign className="h-4 w-4" />
              Thu tiền hóa đơn
            </button>
          )}

          {isEditing && (
            <>
              <button type="button" onClick={handleCancelEditItems} className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer">
                <X className="h-4 w-4" />
                Hủy sửa
              </button>
              <button type="button" onClick={handleSaveEdit} disabled={savingEdit} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {savingEdit ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          )}
        </div>
      </div>

      {stockWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-400 print:hidden">
          ⚠ Một số sản phẩm đã âm tồn kho sau khi lưu, cần nhập bù: {stockWarnings.map((w) => `${w.productName} (${w.newStock})`).join(', ')}
        </div>
      )}

      {/* CHẾ ĐỘ SỬA HÓA ĐƠN — mặt hàng, ghi chú, thông tin bổ sung (giống báo giá) */}
      {isEditing && (
        <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm bg-white text-black space-y-6">
          {editError && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {editError}
            </div>
          )}

          {hasPayment && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-700 border border-amber-200">
              Hóa đơn đã có phát sinh thanh toán nên không thể sửa mặt hàng — chỉ sửa được ghi chú và thông tin bổ sung.
              Muốn điều chỉnh số tiền đã thu, dùng nút bút chì cạnh dòng &quot;Đã thanh toán&quot;.
            </div>
          )}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Khách hàng</h3>
            <p className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
              {invoice.customer.name}
              <CustomerTagChip customer={invoice.customer} />
            </p>
            <p className="text-gray-500 mt-1">Không thể đổi khách hàng khi sửa hóa đơn.</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold uppercase tracking-wider text-gray-500">Thông tin bổ sung</h3>
              <button type="button" onClick={addEditCustomField} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 font-bold text-gray-800 hover:bg-gray-50">
                <Plus className="h-3.5 w-3.5" />
                Thêm trường
              </button>
            </div>
            <div className="space-y-2">
              {editCustomFields.length === 0 && <p className="text-gray-500">Chưa có trường bổ sung.</p>}
              {editCustomFields.map((field) => (
                <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr_auto]">
                  <input type="text" value={field.key} onChange={(e) => updateEditCustomField(field.id, 'key', e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1.5 font-semibold" placeholder="Tên trường" />
                  <input type="text" value={field.value} onChange={(e) => updateEditCustomField(field.id, 'value', e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1.5" placeholder="Giá trị" />
                  <button type="button" onClick={() => removeEditCustomField(field.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mặt hàng</h3>
              {!hasPayment && (
                <button type="button" onClick={addEditRow} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-50">
                  <Plus className="h-3.5 w-3.5" />
                  Thêm dòng
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100 text-gray-700 font-bold">
                    <th className="py-2.5 px-2 w-10 text-center">STT</th>
                    <th className="py-2.5 px-2">Tên hàng hóa, dịch vụ</th>
                    <th className="py-2.5 px-2">Mô tả</th>
                    <th className="py-2.5 px-2 w-16 text-center">SL</th>
                    <th className="py-2.5 px-2 w-28 text-right">Đơn giá</th>
                    <th className="py-2.5 px-2 w-28 text-right">Thành tiền</th>
                    {!hasPayment && <th className="py-2.5 px-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {editItems.map((item, index) => (
                    <tr key={index} className="align-top">
                      <td className="py-2.5 px-2 text-center text-gray-500">{index + 1}</td>
                      <td className="py-2.5 px-2">
                        {hasPayment ? (
                          <>
                            <p className="font-bold text-gray-800">{item.productName}</p>
                            {item.productSku && <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.productSku}</p>}
                          </>
                        ) : (
                          <select required value={item.productId} onChange={(e) => handleEditProductChange(index, e.target.value)} className="w-full min-w-40 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold">
                            <option value="">-- Chọn sản phẩm --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.code} - Kho: {p.stock})</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600">
                        <textarea value={item.description} onChange={(e) => handleEditItemDescriptionChange(index, e.target.value)} rows={2} className="w-full min-w-36 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs" />
                      </td>
                      <td className="py-2.5 px-2 text-center font-semibold text-gray-800">
                        {hasPayment ? item.quantity : (
                          <input type="number" min="1" required value={item.quantity} onChange={(e) => handleEditItemValueChange(index, 'quantity', e.target.value)} className="w-16 rounded border border-gray-300 px-1 py-1 text-center" />
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600">
                        {hasPayment ? formatCurrency(item.unitPrice) : (
                          <MoneyInput required value={item.unitPrice} onChange={(v) => handleEditItemValueChange(index, 'unitPrice', v.toString())} className="w-28 rounded border border-gray-300 px-1 py-1 text-right" />
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-gray-800">{formatCurrency(item.amount)}</td>
                      {!hasPayment && (
                        <td className="py-2.5 px-2">
                          <button type="button" onClick={() => removeEditRow(index)} className="rounded p-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="text-sm font-black text-gray-800">
                Tổng tiền: <span className="text-base">{formatCurrency(editTotal)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="font-bold text-gray-700 text-xs mb-1.5">Ghi chú:</p>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-xs italic" placeholder="Ghi chú, hình thức thanh toán, giao hàng..." />
          </div>
        </div>
      )}

      {/* TẤM IN HÓA ĐƠN A4 DỰA TRÊN CẤU HÌNH TEMPLATE */}
      {!isEditing && (
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
                  <p className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                    {invoice.customer.name}
                    <CustomerTagChip customer={invoice.customer} />
                  </p>
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
                            {item.description && <p className="text-[10px] text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-semibold text-gray-800">{item.quantity}</td>
                      <td className="py-2.5 px-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
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
                <div className="flex justify-between items-center text-sm">
                  <span className="font-black text-gray-800">TỔNG CỘNG:</span>
                  <span className="font-black text-gray-900 text-base">{formatCurrency(invoice.total)}</span>
                </div>
                {paidAmountBlock}
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
                <p className="font-bold text-sm text-indigo-950 flex items-center gap-2 flex-wrap">
                  {invoice.customer.name}
                  <CustomerTagChip customer={invoice.customer} />
                </p>
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
                            {item.description && <p className="text-[10px] text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-gray-800">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
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
                <div className="border-t-2 border-indigo-600 pt-2 flex justify-between items-center text-sm font-extrabold text-indigo-950">
                  <span>TỔNG CỘNG:</span>
                  <span className="text-base">{formatCurrency(invoice.total)}</span>
                </div>
                {paidAmountBlock}
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
                <p className="font-bold text-gray-900 mt-1 flex items-center gap-2 flex-wrap">
                  {invoice.customer.name}
                  <CustomerTagChip customer={invoice.customer} />
                </p>
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
                            {item.description && <p className="text-[9px] text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>}
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
                <div className="border-t border-gray-900 pt-2 flex justify-between items-center text-sm font-bold text-gray-900">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
                {paidAmountBlock}
                <div className="border-t border-gray-100 pt-1.5 flex justify-between items-center text-red-500 font-bold">
                  <span>Dư nợ còn lại:</span>
                  <span>{formatCurrency(invoice.remainingAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THÔNG TIN BỔ SUNG (bê nguyên từ báo giá khi convert) + GHI CHÚ — dùng chung cho cả 3 mẫu */}
        {((invoice.customFields && Object.keys(invoice.customFields).length > 0) || invoice.notes) && (
          <div className="px-8 md:px-12 pb-8 space-y-3">
            {invoice.customFields && Object.keys(invoice.customFields).length > 0 && (
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Thông tin bổ sung</p>
                <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 text-xs text-gray-700">
                  {Object.entries(invoice.customFields).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-semibold text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {invoice.notes && (
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Ghi chú</p>
                <p className="text-xs text-gray-700 whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
          </div>
        )}

      </div>
      )}

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
                <MoneyInput
                  required
                  value={payAmount ? Number(payAmount) : 0}
                  onChange={(v) => setPayAmount(v ? v.toString() : '')}
                  className="w-full rounded border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground font-extrabold text-sm"
                  placeholder="Ví dụ: 5.000.000"
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
