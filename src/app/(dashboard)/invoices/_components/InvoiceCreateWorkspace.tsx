'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import CustomerTagChip from '@/components/CustomerTagChip';
import MoneyInput from '@/components/MoneyInput';

interface Customer {
  id: string;
  code?: string;
  name: string;
  company: string | null;
  taxCode: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  tagName: string | null;
  tagColor: string | null;
  priceTierId: string | null;
  priceTier: { id: string; name: string; color: string } | null;
}

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

interface Product {
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

interface Setting {
  logo: string | null;
  companyName: string;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface InvoiceItemInput {
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

interface CustomFieldEntry {
  id: string;
  key: string;
  value: string;
}

const emptyItem = (): InvoiceItemInput => ({
  productId: '',
  productName: '',
  productSku: '',
  description: '',
  unitPrice: 0,
  quantity: 1,
  vatRate: 10,
  discountRate: 0,
  amount: 0,
});

const calculateItemAmount = (price: number, qty: number, vat: number, disc: number) => {
  const subtotal = price * qty;
  const discount = subtotal * (disc / 100);
  const afterDiscount = subtotal - discount;
  return afterDiscount + afterDiscount * (vat / 100);
};

const makeCustomFieldId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const entriesToCustomFields = (entries: CustomFieldEntry[]) =>
  entries.reduce<Record<string, string>>((acc, entry) => {
    const key = entry.key.trim();
    if (!key) return acc;
    acc[key] = entry.value.trim();
    return acc;
  }, {});

/**
 * Giao diện "Xuất hóa đơn trực tiếp" — cùng khuôn mẫu tờ giấy với báo giá
 * (chỉ khác nhãn Báo giá → Hóa đơn, bỏ hạn/trạng thái, thêm chọn mẫu in)
 * để dữ liệu và trải nghiệm nhập liệu nhất quán giữa hai loại chứng từ.
 */
export default function InvoiceCreateWorkspace() {
  const router = useRouter();
  const { user } = useApp();
  const [setting, setSetting] = useState<Setting | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [templateName, setTemplateName] = useState('DEFAULT');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<CustomFieldEntry[]>([]);
  const [items, setItems] = useState<InvoiceItemInput[]>([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const getCustomerTier = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return {
      id: customer?.priceTierId || null,
      name: customer?.tagName?.trim().toLowerCase() || null,
    };
  };

  const getProductPriceForTier = (product: Product, tier: { id: string | null; name: string | null }) => {
    const matchedById = tier.id ? product.tierPrices.find((tp) => tp.tierId === tier.id) : null;
    const matchedByName = tier.name
      ? product.tierPrices.find((tp) => tp.tier.name.trim().toLowerCase() === tier.name)
      : null;
    return matchedById?.price ?? matchedByName?.price ?? product.salePrice;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [resSettings, resCustomers, resProducts] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/customers?limit=999'),
          fetch('/api/products?limit=999'),
        ]);
        if (resSettings.ok) setSetting((await resSettings.json()).setting);
        if (resCustomers.ok) setCustomers((await resCustomers.json()).customers);
        if (resProducts.ok) setProducts((await resProducts.json()).products);
      } catch {
        setError('Đã xảy ra lỗi hệ thống');
      } finally {
        setLoading(false);
      }
    };
    queueMicrotask(() => void fetchData());
  }, []);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const tier = getCustomerTier(customerId);
    setItems((currentItems) => currentItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return item;
      const unitPrice = getProductPriceForTier(product, tier);
      return { ...item, unitPrice, amount: calculateItemAmount(unitPrice, item.quantity, item.vatRate, item.discountRate) };
    }));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const unitPrice = getProductPriceForTier(product, getCustomerTier(selectedCustomerId));
    setItems((currentItems) => currentItems.map((item, i) => {
      if (i !== index) return item;
      return {
        ...item,
        productId: product.id,
        productName: product.name,
        productSku: product.sku || '',
        description: product.description || item.description || '',
        unitPrice,
        vatRate: product.vatRate,
        amount: calculateItemAmount(unitPrice, item.quantity, product.vatRate, item.discountRate),
      };
    }));
  };

  const handleItemValueChange = (index: number, field: keyof InvoiceItemInput, value: string) => {
    setItems((currentItems) => currentItems.map((item, i) => {
      if (i !== index) return item;
      let numericValue = parseFloat(value) || 0;
      if (field === 'quantity') numericValue = parseInt(value, 10) || 1;
      const updated = { ...item, [field]: numericValue };
      updated.amount = calculateItemAmount(
        field === 'unitPrice' ? numericValue : item.unitPrice,
        field === 'quantity' ? numericValue : item.quantity,
        field === 'vatRate' ? numericValue : item.vatRate,
        field === 'discountRate' ? numericValue : item.discountRate
      );
      return updated;
    }));
  };

  const handleItemDescriptionChange = (index: number, value: string) => {
    setItems((currentItems) => currentItems.map((item, i) => (i === index ? { ...item, description: value } : item)));
  };

  const totals = useMemo(() => items.reduce(
    (acc, item) => {
      const itemSubtotal = item.unitPrice * item.quantity;
      const itemDiscount = itemSubtotal * (item.discountRate / 100);
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemVat = itemAfterDiscount * (item.vatRate / 100);
      acc.subtotal += itemSubtotal;
      acc.discountAmount += itemDiscount;
      acc.vatAmount += itemVat;
      acc.total += item.amount;
      return acc;
    },
    { subtotal: 0, discountAmount: 0, vatAmount: 0, total: 0 }
  ), [items]);

  const addRow = () => setItems((cur) => [...cur, emptyItem()]);
  const removeRow = (index: number) => setItems((cur) => cur.filter((_, i) => i !== index));

  const addCustomField = () => setCustomFields((cur) => [...cur, { id: makeCustomFieldId(), key: '', value: '' }]);
  const updateCustomField = (id: string, field: 'key' | 'value', value: string) =>
    setCustomFields((cur) => cur.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  const removeCustomField = (id: string) => setCustomFields((cur) => cur.filter((e) => e.id !== id));

  const validateForm = () => {
    if (!selectedCustomerId) return 'Vui lòng chọn khách hàng';
    if (items.length === 0) return 'Vui lòng chọn ít nhất 1 sản phẩm';
    if (items.some((item) => !item.productId)) return 'Có dòng sản phẩm chưa được chọn hàng hóa cụ thể';
    return '';
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          notes,
          templateName,
          customFields: entriesToCustomFields(customFields),
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details?.[0]?.message || data.error || 'Không lưu được hóa đơn');
        return;
      }
      router.push(`/invoices/${data.invoice.id}`);
    } catch {
      setError('Đã xảy ra lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang tải dữ liệu lập hóa đơn...</p>
        </div>
      </div>
    );
  }

  const documentDate = new Date().toISOString();
  const creatorName = user?.username || 'Admin';

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Xuất hóa đơn trực tiếp</h1>
            <p className="text-xs text-muted-foreground">Nhập trực tiếp trên mẫu hóa đơn — hệ thống tự trừ tồn kho tương ứng.</p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Đang lưu...' : 'Lưu hóa đơn'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs font-semibold text-destructive border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="bg-card border border-border p-8 md:p-12 rounded-2xl shadow-sm bg-white text-black transition-all">
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
          <div className="text-left sm:text-right space-y-1.5 min-w-[190px]">
            <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">HÓA ĐƠN</h1>
            <p className="text-xs font-bold text-gray-700">Số: Bản mới</p>
            <p className="text-xs text-gray-600">Ngày lập: {formatDate(documentDate)}</p>
            <label className="block text-xs text-gray-600">
              Mẫu in:
              <select value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-right">
                <option value="DEFAULT">Truyền thống</option>
                <option value="MODERN">Hiện đại</option>
                <option value="MINIMAL">Tối giản</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-8 space-y-1.5 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Khách hàng nhận hóa đơn:</h3>
          <select required value={selectedCustomerId} onChange={(e) => handleCustomerChange(e.target.value)} className="w-full rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold">
            <option value="">-- Chọn khách hàng --</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}{customer.company ? ` (${customer.company})` : ''}</option>
            ))}
          </select>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div>
              <p className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                {selectedCustomer?.name || 'Chưa chọn khách hàng'}
                {selectedCustomer && <CustomerTagChip customer={selectedCustomer} />}
              </p>
              {selectedCustomer?.company && <p className="font-semibold text-gray-700 mt-0.5">{selectedCustomer.company}</p>}
              {selectedCustomer?.address && <p className="text-gray-600 mt-0.5">Địa chỉ: {selectedCustomer.address}</p>}
            </div>
            <div className="space-y-0.5">
              {selectedCustomer?.taxCode && <p className="text-gray-600">Mã số thuế: {selectedCustomer.taxCode}</p>}
              {selectedCustomer?.phone && <p className="text-gray-600">Điện thoại: {selectedCustomer.phone}</p>}
              {selectedCustomer?.email && <p className="text-gray-600">Email: {selectedCustomer.email}</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold uppercase tracking-wider text-gray-500">Thông tin bổ sung</h3>
            <button type="button" onClick={addCustomField} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 font-bold text-gray-800 hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" />
              Thêm trường
            </button>
          </div>
          <div className="space-y-2">
            {customFields.length === 0 && <p className="text-gray-500">Chưa có trường bổ sung.</p>}
            {customFields.map((field) => (
              <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr_auto]">
                <input type="text" value={field.key} onChange={(e) => updateCustomField(field.id, 'key', e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1.5 font-semibold" placeholder="Tên trường, ví dụ: Người phụ trách" />
                <input type="text" value={field.value} onChange={(e) => updateCustomField(field.id, 'value', e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1.5" placeholder="Giá trị" />
                <button type="button" onClick={() => removeCustomField(field.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-gray-700 font-bold">
                  <th className="py-2.5 px-2 w-10 text-center">STT</th>
                  <th className="py-2.5 px-2">Tên hàng hóa, dịch vụ</th>
                  <th className="py-2.5 px-2">Mô tả / Thông số</th>
                  <th className="py-2.5 px-2 w-16 text-center">ĐVT</th>
                  <th className="py-2.5 px-2 w-16 text-center">SL</th>
                  <th className="py-2.5 px-2 w-28 text-right">Đơn giá</th>
                  <th className="py-2.5 px-2 w-28 text-right">Thành tiền</th>
                  <th className="py-2.5 px-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <tr key={index} className="hover:bg-gray-50/50 align-top">
                      <td className="py-2.5 px-2 text-center text-gray-500">{index + 1}</td>
                      <td className="py-2.5 px-2">
                        <select required value={item.productId} onChange={(e) => handleProductChange(index, e.target.value)} className="w-full min-w-40 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold">
                          <option value="">-- Chọn sản phẩm --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.code} - Kho: {p.stock})</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2 text-gray-600">
                        <textarea value={item.description} onChange={(e) => handleItemDescriptionChange(index, e.target.value)} rows={2} className="w-full min-w-44 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs" />
                      </td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{product?.unit || 'Cái'}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-gray-800">
                        <input type="number" min="1" required value={item.quantity} onChange={(e) => handleItemValueChange(index, 'quantity', e.target.value)} className="w-16 rounded border border-gray-300 px-1 py-1 text-center" />
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600">
                        <MoneyInput required value={item.unitPrice} onChange={(v) => handleItemValueChange(index, 'unitPrice', v.toString())} className="w-28 rounded border border-gray-300 px-1 py-1 text-right" />
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-gray-800">{formatCurrency(item.amount)}</td>
                      <td className="py-2.5 px-2">
                        <button type="button" onClick={() => removeRow(index)} className="rounded p-1 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-80 space-y-2 text-xs text-gray-700 font-semibold">
            <div className="flex justify-between items-center text-sm">
              <span className="font-black text-gray-800 uppercase">Tổng tiền thanh toán:</span>
              <span className="font-black text-gray-900 text-base">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-600 space-y-1">
          <p className="font-bold text-gray-700">Ghi chú:</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-xs italic" placeholder="Hình thức thanh toán, ghi chú giao hàng..." />
        </div>

        <div className="mt-12 grid grid-cols-2 text-center text-xs text-gray-700 pt-6 border-t border-gray-100">
          <div>
            <p className="font-bold uppercase">ĐẠI DIỆN KHÁCH HÀNG</p>
            <p className="text-[10px] text-gray-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20" />
          </div>
          <div>
            <p className="font-bold uppercase">NGƯỜI LẬP HÓA ĐƠN</p>
            <p className="text-[10px] text-gray-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20 flex items-end justify-center">
              <p className="font-bold uppercase text-gray-800">{creatorName}</p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
