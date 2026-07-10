'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, Trash2, ArrowLeft, 
  ShoppingBag, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  company: string | null;
  tagName: string | null;
  priceTierId: string | null;
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
  salePrice: number;
  tierPrices: ProductTierPrice[];
  vatRate: number;
  unit: string;
  stock: number;
}

interface InvoiceItemInput {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  vatRate: number;
  discountRate: number;
  amount: number;
}

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [templateName, setTemplateName] = useState('DEFAULT');
  const [items, setItems] = useState<InvoiceItemInput[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resCust, resProd] = await Promise.all([
          fetch('/api/customers?limit=999'),
          fetch('/api/products?limit=999'),
        ]);

        if (resCust.ok) {
          const data = await resCust.json();
          setCustomers(data.customers);
        }
        if (resProd.ok) {
          const data = await resProd.json();
          setProducts(data.products);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addRow = () => {
    const newItem: InvoiceItemInput = {
      productId: '',
      productName: '',
      productSku: '',
      unitPrice: 0,
      quantity: 1,
      vatRate: 10,
      discountRate: 0,
      amount: 0,
    };
    setItems([...items, newItem]);
  };

  const removeRow = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const getCustomerTier = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    return {
      id: customer?.priceTierId || null,
      name: customer?.tagName?.trim().toLowerCase() || null,
    };
  };

  const getProductPriceForTier = (product: Product, tier: { id: string | null; name: string | null }) => {
    const matchedById = tier.id ? product.tierPrices.find((tierPrice) => tierPrice.tierId === tier.id) : null;
    const matchedByName = tier.name
      ? product.tierPrices.find((tierPrice) => tierPrice.tier.name.trim().toLowerCase() === tier.name)
      : null;
    return matchedById?.price ?? matchedByName?.price ?? product.salePrice;
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const tier = getCustomerTier(customerId);

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

  const handleProductChange = (index: number, prodId: string) => {
    const matchedProd = products.find((p) => p.id === prodId);
    if (!matchedProd) return;

    const unitPrice = getProductPriceForTier(matchedProd, getCustomerTier(selectedCustomerId));
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: matchedProd.id,
      productName: matchedProd.name,
      productSku: matchedProd.sku || '',
      unitPrice,
      vatRate: matchedProd.vatRate,
      amount: calculateItemAmount(unitPrice, newItems[index].quantity, matchedProd.vatRate, newItems[index].discountRate),
    };
    setItems(newItems);
  };

  const handleItemValueChange = (index: number, field: keyof InvoiceItemInput, val: string) => {
    const newItems = [...items];
    const item = newItems[index];

    let numericVal = parseFloat(val) || 0;
    if (field === 'quantity') numericVal = parseInt(val) || 1;

    const updatedItem = {
      ...item,
      [field]: numericVal,
    };

    updatedItem.amount = calculateItemAmount(
      field === 'unitPrice' ? numericVal : item.unitPrice,
      field === 'quantity' ? numericVal : item.quantity,
      field === 'vatRate' ? numericVal : item.vatRate,
      field === 'discountRate' ? numericVal : item.discountRate
    );

    newItems[index] = updatedItem;
    setItems(newItems);
  };

  const calculateItemAmount = (price: number, qty: number, vat: number, disc: number) => {
    const sub = price * qty;
    const discount = sub * (disc / 100);
    const afterDisc = sub - discount;
    const tax = afterDisc * (vat / 100);
    return afterDisc + tax;
  };

  const getTotals = () => {
    let subtotal = 0;
    let discountAmount = 0;
    let vatAmount = 0;
    let total = 0;

    items.forEach((item) => {
      const itemSub = item.unitPrice * item.quantity;
      const itemDisc = itemSub * (item.discountRate / 100);
      const itemAfterDisc = itemSub - itemDisc;
      const itemVat = itemAfterDisc * (item.vatRate / 100);

      subtotal += itemSub;
      discountAmount += itemDisc;
      vatAmount += itemVat;
      total += item.amount;
    });

    return { subtotal, discountAmount, vatAmount, total };
  };

  const { subtotal, discountAmount, vatAmount, total } = getTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId) {
      setError('Vui lòng chọn khách hàng');
      return;
    }

    if (items.length === 0) {
      setError('Vui lòng chọn ít nhất 1 sản phẩm');
      return;
    }

    const hasUnselectedProduct = items.some((item) => !item.productId);
    if (hasUnselectedProduct) {
      setError('Có dòng sản phẩm chưa được chọn hàng hóa cụ thể');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          notes,
          items,
          templateName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push('/invoices');
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Đang tải danh mục dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lập Hóa đơn Bán hàng</h1>
          <p className="text-sm text-muted-foreground">Lập trực tiếp hóa đơn và trừ tồn kho hàng hóa tương ứng trong hệ thống.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs font-semibold text-destructive border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid gap-4 md:grid-cols-3 bg-card border border-border p-5 rounded-2xl shadow-sm text-xs">
          
          <div>
            <label className="block font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">Khách hàng *</label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full rounded-lg border border-border p-2.5 bg-card focus:outline-none focus:border-foreground cursor-pointer"
            >
              <option value="">-- Chọn khách hàng --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">Mẫu in hóa đơn</label>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border border-border p-2.5 bg-card focus:outline-none focus:border-foreground cursor-pointer"
            >
              <option value="DEFAULT">Mẫu truyền thống (DEFAULT)</option>
              <option value="MODERN">Mẫu hiện đại (MODERN)</option>
              <option value="MINIMAL">Mẫu tối giản (MINIMAL)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1.5 text-muted-foreground uppercase tracking-wider">Ghi chú hóa đơn</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Thanh toán chuyển khoản 100%..."
              className="w-full rounded-lg border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground"
            />
          </div>

        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <ShoppingBag className="h-4.5 w-4.5 text-primary" />
              Chi tiết mặt hàng bán ra
            </h3>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-[11px] font-bold bg-secondary hover:bg-muted border border-border rounded px-2.5 py-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng sản phẩm
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Chưa có sản phẩm nào. Nhấn &quot;Thêm dòng sản phẩm&quot; để chọn hàng hóa bán ra.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="py-2 pr-2">Sản phẩm *</th>
                    <th className="py-2 px-2 w-20">ĐVT</th>
                    <th className="py-2 px-2 w-24">Số lượng</th>
                    <th className="py-2 px-2 w-32">Đơn giá bán</th>
                    <th className="py-2 px-2 w-24">VAT (%)</th>
                    <th className="py-2 px-2 w-24">C.Khấu (%)</th>
                    <th className="py-2 px-2 w-32">Thành tiền</th>
                    <th className="py-2 pl-2 w-10 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const matchedProd = products.find((p) => p.id === item.productId);
                    
                    return (
                      <tr key={index} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="py-2 pr-2">
                          <select
                            required
                            value={item.productId}
                            onChange={(e) => handleProductChange(index, e.target.value)}
                            className="w-full rounded border border-border p-1.5 bg-card focus:outline-none focus:border-foreground max-w-[200px] cursor-pointer"
                          >
                            <option value="">-- Chọn sản phẩm --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.code} - Kho: {p.stock})</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground font-semibold">
                          {matchedProd?.unit || '—'}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemValueChange(index, 'quantity', e.target.value)}
                            className="w-full rounded border border-border p-1 bg-transparent text-center"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            required
                            value={item.unitPrice}
                            onChange={(e) => handleItemValueChange(index, 'unitPrice', e.target.value)}
                            className="w-full rounded border border-border p-1 bg-transparent font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.vatRate}
                            onChange={(e) => handleItemValueChange(index, 'vatRate', e.target.value)}
                            className="w-full rounded border border-border p-1 bg-transparent text-center text-muted-foreground"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={item.discountRate}
                            onChange={(e) => handleItemValueChange(index, 'discountRate', e.target.value)}
                            className="w-full rounded border border-border p-1 bg-transparent text-center text-muted-foreground"
                          />
                        </td>
                        <td className="py-2 px-2 font-bold text-foreground">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="text-destructive p-1 hover:bg-destructive/10 rounded cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div className="w-full md:max-w-md text-xs text-muted-foreground bg-muted/40 p-4 rounded-xl border border-border space-y-1">
            <p className="font-bold text-foreground">Lưu ý nghiệp vụ Kho:</p>
            <p>Khi bấm lưu hóa đơn, hệ thống sẽ tự động xuất kho hàng hóa tương ứng và giảm lượng tồn kho trong danh mục sản phẩm.</p>
          </div>

          <div className="w-full md:w-80 bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3.5 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Tổng tiền hàng:</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Chiết khấu:</span>
              <span className="font-semibold text-destructive">-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Thuế VAT:</span>
              <span className="font-semibold">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="border-t border-border pt-3.5 flex justify-between items-center text-sm">
              <span className="font-bold text-foreground">Tổng cộng hóa đơn:</span>
              <span className="font-extrabold text-foreground">{formatCurrency(total)}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer mt-4"
            >
              {submitting ? 'Đang xuất hóa đơn...' : 'Lập & Lưu Hóa đơn'}
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
