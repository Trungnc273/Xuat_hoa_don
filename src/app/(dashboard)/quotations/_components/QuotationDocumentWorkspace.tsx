'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Edit,
  Image as ImageIcon,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import CustomerTagChip from '@/components/CustomerTagChip';

type WorkspaceMode = 'create' | 'view';

interface Customer {
  id: string;
  code?: string;
  name: string;
  company: string | null;
  taxCode: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
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
  categoryId: string | null;
  images: string[];
  salePrice: number;
  tierPrices: ProductTierPrice[];
  vatRate: number;
  unit: string;
}

interface Category {
  id: string;
  name: string;
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

interface QuotationItemInput {
  id?: string;
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

interface QuotationDetail {
  id: string;
  code: string;
  customerId: string;
  customer: Customer;
  date: string;
  dueDate: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  notes: string | null;
  customFields: Record<string, string> | null;
  subtotal: number;
  vatAmount: number;
  discountAmount: number;
  total: number;
  items: Array<QuotationItemInput & { productId: string | null }>;
  creator: { username: string; email: string };
  createdAt: string;
}

interface Props {
  mode: WorkspaceMode;
  quotationId?: string;
  startEditing?: boolean;
  initialCustomerId?: string;
}

const emptyItem = (): QuotationItemInput => ({
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

const toDateInputValue = (value: string | null) => {
  if (!value) return '';
  return new Date(value).toISOString().split('T')[0];
};

const calculateItemAmount = (price: number, qty: number, vat: number, disc: number) => {
  const subtotal = price * qty;
  const discount = subtotal * (disc / 100);
  const afterDiscount = subtotal - discount;
  return afterDiscount + afterDiscount * (vat / 100);
};

const makeCustomFieldId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const customFieldsToEntries = (fields: Record<string, string> | null | undefined): CustomFieldEntry[] => {
  return Object.entries(fields || {}).map(([key, value]) => ({
    id: makeCustomFieldId(),
    key,
    value,
  }));
};

const entriesToCustomFields = (entries: CustomFieldEntry[]) => {
  return entries.reduce<Record<string, string>>((acc, entry) => {
    const key = entry.key.trim();
    if (!key) return acc;
    acc[key] = entry.value.trim();
    return acc;
  }, {});
};

export default function QuotationDocumentWorkspace({ mode, quotationId, startEditing = false, initialCustomerId }: Props) {
  const router = useRouter();
  const { user } = useApp();
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceTiers, setPriceTiers] = useState<CustomerPriceTier[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [previewTierId, setPreviewTierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<CustomFieldEntry[]>([]);
  const [items, setItems] = useState<QuotationItemInput[]>(mode === 'create' ? [emptyItem()] : []);
  const [isEditing, setIsEditing] = useState(mode === 'create' || startEditing);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || quotation?.customer || null,
    [customers, quotation?.customer, selectedCustomerId]
  );

  const getCustomerTier = useCallback((customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    return {
      id: customer?.priceTierId || null,
      name: customer?.tagName?.trim().toLowerCase() || null,
    };
  }, [customers]);

  const getProductPriceForTier = (product: Product, tier: { id: string | null; name: string | null }) => {
    const matchedById = tier.id ? product.tierPrices.find((tierPrice) => tierPrice.tierId === tier.id) : null;
    const matchedByName = tier.name
      ? product.tierPrices.find((tierPrice) => tierPrice.tier.name.trim().toLowerCase() === tier.name)
      : null;
    return matchedById?.price ?? matchedByName?.price ?? product.salePrice;
  };

  const hydrateQuotation = useCallback((q: QuotationDetail) => {
    setQuotation(q);
    setSelectedCustomerId(q.customerId);
    setDueDate(toDateInputValue(q.dueDate));
    setStatus(q.status);
    setNotes(q.notes || '');
    setCustomFields(customFieldsToEntries(q.customFields));
    setItems(q.items.map((item) => ({
      id: item.id,
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
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requests: Promise<Response>[] = [
        fetch('/api/settings'),
        fetch('/api/customers?limit=999'),
        fetch('/api/products?limit=999'),
        fetch('/api/categories'),
        fetch('/api/customer-price-tiers'),
      ];

      if (quotationId) {
        requests.push(fetch(`/api/quotations/${quotationId}`));
      }

      const [resSettings, resCustomers, resProducts, resCategories, resTiers, resQuotation] = await Promise.all(requests);

      if (resSettings.ok) {
        const data = await resSettings.json();
        setSetting(data.setting);
      }

      if (resCustomers.ok) {
        const data = await resCustomers.json();
        setCustomers(data.customers);
      }

      if (resProducts.ok) {
        const data = await resProducts.json();
        setProducts(data.products);
      }

      if (resCategories.ok) {
        const data = await resCategories.json();
        setCategories(data.categories);
      }

      if (resTiers.ok) {
        const data = await resTiers.json();
        setPriceTiers(data.tiers);
      }

      if (quotationId && resQuotation) {
        if (!resQuotation.ok) {
          setError('Không tìm thấy báo giá yêu cầu');
        } else {
          const data = await resQuotation.json();
          hydrateQuotation(data.quotation);
        }
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  }, [hydrateQuotation, quotationId]);

  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, [fetchData]);

  useEffect(() => {
    if (mode !== 'view') return;
    if (typeof window !== 'undefined' && window.location.hash === '#edit') {
      queueMicrotask(() => setIsEditing(true));
    }
  }, [mode]);

  // Đến từ trang khách hàng với ?customerId=... → tự chọn sẵn khách hàng đó khi lập báo giá mới
  useEffect(() => {
    if (mode !== 'create' || !initialCustomerId || selectedCustomerId) return;
    if (customers.some((customer) => customer.id === initialCustomerId)) {
      handleCustomerChange(initialCustomerId);
    }
  }, [mode, initialCustomerId, customers, selectedCustomerId]);

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const tier = getCustomerTier(customerId);
    // Tự đặt bảng giá xem trước ở panel sản phẩm theo đúng phân loại của khách hàng vừa chọn
    setPreviewTierId(tier.id || '');

    setItems((currentItems) => currentItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return item;

      const unitPrice = getProductPriceForTier(product, tier);
      return {
        ...item,
        unitPrice,
        amount: calculateItemAmount(unitPrice, item.quantity, item.vatRate, item.discountRate),
      };
    }));
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const unitPrice = getProductPriceForTier(product, getCustomerTier(selectedCustomerId));
    setItems((currentItems) => currentItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
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

  // Danh sách sản phẩm hiện ở panel bên trái, sau khi lọc theo danh mục + từ khóa tìm kiếm
  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter && product.categoryId !== categoryFilter) return false;
      if (!keyword) return true;
      return (
        product.name.toLowerCase().includes(keyword) ||
        product.code.toLowerCase().includes(keyword) ||
        (product.sku || '').toLowerCase().includes(keyword)
      );
    });
  }, [products, categoryFilter, productSearch]);

  const previewTierLabel = useMemo(
    () => priceTiers.find((t) => t.id === previewTierId) || null,
    [priceTiers, previewTierId]
  );

  const getPreviewPrice = useCallback(
    (product: Product) => getProductPriceForTier(product, { id: previewTierId || null, name: null }),
    [previewTierId]
  );

  // Bấm 1 sản phẩm ở panel trái: nếu đã có dòng cùng sản phẩm thì tăng số lượng, chưa có thì thêm dòng mới
  const handleQuickAddProduct = (product: Product) => {
    const unitPrice = getPreviewPrice(product);
    setItems((currentItems) => {
      const existingIndex = currentItems.findIndex((item) => item.productId === product.id);
      if (existingIndex !== -1) {
        return currentItems.map((item, i) => {
          if (i !== existingIndex) return item;
          const quantity = item.quantity + 1;
          return { ...item, quantity, amount: calculateItemAmount(item.unitPrice, quantity, item.vatRate, item.discountRate) };
        });
      }

      const newRow: QuotationItemInput = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || '',
        description: product.description || '',
        unitPrice,
        quantity: 1,
        vatRate: product.vatRate,
        discountRate: 0,
        amount: calculateItemAmount(unitPrice, 1, product.vatRate, 0),
      };

      // Nếu dòng cuối đang trống (chưa chọn sản phẩm), điền luôn vào đó thay vì tạo dòng thừa
      const lastItem = currentItems[currentItems.length - 1];
      if (lastItem && !lastItem.productId) {
        return [...currentItems.slice(0, -1), newRow];
      }
      return [...currentItems, newRow];
    });
  };

  const handleItemValueChange = (index: number, field: keyof QuotationItemInput, value: string) => {
    setItems((currentItems) => currentItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      let numericValue = parseFloat(value) || 0;
      if (field === 'quantity') numericValue = parseInt(value, 10) || 1;

      const updatedItem = {
        ...item,
        [field]: numericValue,
      };

      updatedItem.amount = calculateItemAmount(
        field === 'unitPrice' ? numericValue : item.unitPrice,
        field === 'quantity' ? numericValue : item.quantity,
        field === 'vatRate' ? numericValue : item.vatRate,
        field === 'discountRate' ? numericValue : item.discountRate
      );

      return updatedItem;
    }));
  };

  const handleItemDescriptionChange = (index: number, value: string) => {
    setItems((currentItems) => currentItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, description: value } : item
    )));
  };

  const totals = useMemo(() => {
    return items.reduce(
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
    );
  }, [items]);

  const addRow = () => setItems((currentItems) => [...currentItems, emptyItem()]);

  const removeRow = (index: number) => {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const addCustomField = () => {
    setCustomFields((currentFields) => [...currentFields, { id: makeCustomFieldId(), key: '', value: '' }]);
  };

  const updateCustomField = (id: string, field: 'key' | 'value', value: string) => {
    setCustomFields((currentFields) => currentFields.map((entry) => (
      entry.id === id ? { ...entry, [field]: value } : entry
    )));
  };

  const removeCustomField = (id: string) => {
    setCustomFields((currentFields) => currentFields.filter((entry) => entry.id !== id));
  };

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
      const endpoint = quotationId ? `/api/quotations/${quotationId}` : '/api/quotations';
      const res = await fetch(endpoint, {
        method: quotationId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          dueDate: dueDate || null,
          status: quotationId ? status : undefined,
          notes,
          customFields: entriesToCustomFields(customFields),
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Không lưu được báo giá');
        return;
      }

      if (quotationId) {
        hydrateQuotation(data.quotation);
        setIsEditing(false);
        router.replace(`/quotations/${quotationId}`);
      } else {
        router.push(`/quotations/${data.quotation.id}`);
      }
    } catch {
      setError('Đã xảy ra lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (quotation) hydrateQuotation(quotation);
    setIsEditing(false);
    if (quotationId) router.replace(`/quotations/${quotationId}`);
  };

  const handlePrint = () => window.print();

  const handleConvertToInvoice = async () => {
    if (!quotation) return;
    if (!confirm('Bạn có đồng ý chuyển báo giá này thành Hóa đơn bán hàng thực tế? Tồn kho sản phẩm tương ứng sẽ bị giảm.')) return;

    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/convert`, { method: 'POST' });
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang tải báo giá...</p>
        </div>
      </div>
    );
  }

  if (mode === 'view' && (error || !quotation)) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive max-w-md mx-auto">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm font-bold">{error || 'Không tải được báo giá'}</p>
        <Link href="/quotations" className="text-xs font-semibold text-foreground underline mt-4 block">Quay lại danh sách</Link>
      </div>
    );
  }

  const documentCode = quotation?.code || 'Bản mới';
  const documentDate = quotation?.date || new Date().toISOString();
  const creatorName = quotation?.creator?.username || user?.username || 'Admin';

  return (
    <form onSubmit={handleSave} className={`space-y-6 mx-auto transition-all ${isEditing ? 'max-w-[1400px]' : 'max-w-5xl'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/quotations" className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {mode === 'create' ? 'Lập Báo giá mới' : `Chi tiết Báo giá ${documentCode}`}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === 'create' ? 'Nhập trực tiếp trên mẫu báo giá.' : (
                <>Trạng thái: <span className="font-bold uppercase text-primary">{status}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {mode === 'view' && !isEditing && (
            <>
              <button type="button" onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer">
                <Printer className="h-4 w-4" />
                In báo giá
              </button>
              {quotation && quotation.status !== 'CONVERTED' && ['ADMIN', 'MANAGER', 'STAFF'].includes(user?.role || '') && (
                <>
                  <button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer">
                    <Edit className="h-4 w-4" />
                    Sửa báo giá
                  </button>
                  <button type="button" onClick={handleConvertToInvoice} disabled={converting} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
                    {converting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {converting ? 'Đang xử lý...' : 'Chuyển thành Hóa đơn'}
                  </button>
                </>
              )}
            </>
          )}

          {isEditing && (
            <>
              {mode === 'view' && (
                <button type="button" onClick={handleCancelEdit} className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer">
                  <X className="h-4 w-4" />
                  Hủy sửa
                </button>
              )}
              <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Đang lưu...' : mode === 'create' ? 'Lưu báo giá' : 'Lưu thay đổi'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs font-semibold text-destructive border border-destructive/20 flex items-center gap-2 print:hidden">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className={isEditing ? 'grid gap-6 lg:grid-cols-[300px_1fr] items-start' : ''}>
        {/* PANEL SẢN PHẨM BÊN TRÁI — chỉ hiện khi đang tạo/sửa. Bấm 1 sản phẩm để thêm nhanh vào bảng bên phải. */}
        {isEditing && (
          <div className="print:hidden lg:sticky lg:top-4 space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none cursor-pointer"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={previewTierId}
                onChange={(e) => setPreviewTierId(e.target.value)}
                title="Bảng giá dùng để xem trước & thêm dòng — tự đặt theo khách hàng đã chọn"
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none cursor-pointer"
              >
                <option value="">Giá bán lẻ</option>
                {priceTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>{tier.name}</option>
                ))}
              </select>
            </div>
            {previewTierLabel && (
              <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold" style={{ color: previewTierLabel.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: previewTierLabel.color }} />
                Đang xem giá theo: {previewTierLabel.name}
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Tìm theo tên, SKU..."
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:border-foreground"
              />
            </div>
            <div className="max-h-[520px] space-y-1 overflow-y-auto pr-0.5">
              {filteredProducts.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Không tìm thấy sản phẩm.</p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => handleQuickAddProduct(product)}
                    title={`Thêm ${product.name} vào báo giá`}
                    className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-secondary transition-colors cursor-pointer"
                  >
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.name} width={36} height={36} unoptimized className="h-9 w-9 flex-shrink-0 rounded-md border border-border object-cover bg-muted" />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">{product.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground font-mono">{product.code}{product.sku ? ` · ${product.sku}` : ''}</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-bold text-primary whitespace-nowrap">{formatCurrency(getPreviewPrice(product))}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

      <div className="bg-card border border-border p-8 md:p-12 rounded-2xl shadow-sm bg-white text-black transition-all print:border-none print:shadow-none print:p-0 print:m-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background-color: white !important; color: black !important; }
            .print\\:hidden { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; }
            header, aside { display: none !important; }
            .bg-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          }
        ` }} />

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
            <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">BÁO GIÁ</h1>
            <p className="text-xs font-bold text-gray-700">Số: {documentCode}</p>
            <p className="text-xs text-gray-600">Ngày lập: {formatDate(documentDate)}</p>
            {isEditing ? (
              <label className="block text-xs text-gray-600">
                Hạn báo giá:
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-right" />
              </label>
            ) : dueDate ? (
              <p className="text-xs text-gray-600">Hạn báo giá: {formatDate(dueDate)}</p>
            ) : null}
            {isEditing && mode === 'view' && (
              <label className="block text-xs text-gray-600">
                Trạng thái:
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs">
                  <option value="DRAFT">Nháp (DRAFT)</option>
                  <option value="SENT">Đã gửi khách (SENT)</option>
                  <option value="ACCEPTED">Khách đồng ý (ACCEPTED)</option>
                  <option value="REJECTED">Khách từ chối (REJECTED)</option>
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-1.5 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Khách hàng nhận báo giá:</h3>
          {isEditing ? (
            <select required value={selectedCustomerId} onChange={(e) => handleCustomerChange(e.target.value)} className="w-full rounded border border-gray-300 bg-white px-2 py-2 text-xs font-semibold">
              <option value="">-- Chọn khách hàng --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}{customer.company ? ` (${customer.company})` : ''}</option>
              ))}
            </select>
          ) : null}
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

        {(isEditing || customFields.length > 0) && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold uppercase tracking-wider text-gray-500">Thông tin bổ sung</h3>
              {isEditing && (
                <button type="button" onClick={addCustomField} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 font-bold text-gray-800 hover:bg-gray-50 print:hidden">
                  <Plus className="h-3.5 w-3.5" />
                  Thêm trường
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                {customFields.length === 0 && (
                  <p className="text-gray-500">Chưa có trường bổ sung.</p>
                )}
                {customFields.map((field) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr_auto]">
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) => updateCustomField(field.id, 'key', e.target.value)}
                      className="rounded border border-gray-300 bg-white px-2 py-1.5 font-semibold"
                      placeholder="Tên trường, ví dụ: Mục tiêu"
                    />
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateCustomField(field.id, 'value', e.target.value)}
                      className="rounded border border-gray-300 bg-white px-2 py-1.5"
                      placeholder="Giá trị"
                    />
                    <button type="button" onClick={() => removeCustomField(field.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {customFields.map((field) => (
                  <div key={field.id}>
                    <span className="font-bold text-gray-700">{field.key}: </span>
                    <span className="text-gray-600">{field.value || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          {isEditing && (
            <div className="mb-3 flex justify-end print:hidden">
              <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-50">
                <Plus className="h-3.5 w-3.5" />
                Thêm dòng
              </button>
            </div>
          )}
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
                  {isEditing && <th className="py-2.5 px-2 w-10 print:hidden" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <tr key={item.id || index} className="hover:bg-gray-50/50 align-top">
                      <td className="py-2.5 px-2 text-center text-gray-500">{index + 1}</td>
                      <td className="py-2.5 px-2">
                        {isEditing ? (
                          <select required value={item.productId} onChange={(e) => handleProductChange(index, e.target.value)} className="w-full min-w-40 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold">
                            <option value="">-- Chọn sản phẩm --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <p className="font-bold text-gray-800">{item.productName}</p>
                            {item.productSku && <p className="text-[10px] text-gray-500 font-mono mt-0.5">SKU: {item.productSku}</p>}
                          </>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 whitespace-pre-line">
                        {isEditing ? (
                          <textarea value={item.description} onChange={(e) => handleItemDescriptionChange(index, e.target.value)} rows={2} className="w-full min-w-44 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs" />
                        ) : item.description || '—'}
                      </td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{product?.unit || 'Cái'}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-gray-800">
                        {isEditing ? <input type="number" min="1" required value={item.quantity} onChange={(e) => handleItemValueChange(index, 'quantity', e.target.value)} className="w-16 rounded border border-gray-300 px-1 py-1 text-center" /> : item.quantity}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600">
                        {isEditing ? <input type="number" min="0" required value={item.unitPrice} onChange={(e) => handleItemValueChange(index, 'unitPrice', e.target.value)} className="w-28 rounded border border-gray-300 px-1 py-1 text-right" /> : formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-gray-800">{formatCurrency(item.amount)}</td>
                      {isEditing && (
                        <td className="py-2.5 px-2 print:hidden">
                          <button type="button" onClick={() => removeRow(index)} className="rounded p-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
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

        {(isEditing || notes) && (
          <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-600 space-y-1">
            <p className="font-bold text-gray-700">Ghi chú điều khoản:</p>
            {isEditing ? (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded border border-gray-300 px-3 py-2 text-xs italic" placeholder="Điều khoản, thời hạn hiệu lực, ghi chú giao hàng..." />
            ) : (
              <p className="italic">{notes}</p>
            )}
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 text-center text-xs text-gray-700 pt-6 border-t border-gray-100">
          <div>
            <p className="font-bold uppercase">ĐẠI DIỆN KHÁCH HÀNG</p>
            <p className="text-[10px] text-gray-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20" />
          </div>
          <div>
            <p className="font-bold uppercase">NGƯỜI LẬP BÁO GIÁ</p>
            <p className="text-[10px] text-gray-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20 flex items-end justify-center">
              <p className="font-bold uppercase text-gray-800">{creatorName}</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </form>
  );
}
