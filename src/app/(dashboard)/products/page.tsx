'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { 
  Plus, Search, Edit, Trash2, X,
  Upload, FileSpreadsheet, Download,
  ChevronLeft, ChevronRight, Image as ImageIcon
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import MoneyInput from '@/components/MoneyInput';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  code: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  categoryId: string | null;
  category: { name: string } | null;
  importPrice: number;
  salePrice: number;
  tierPrices: ProductTierPrice[];
  vatRate: number;
  unit: string;
  images: string[];
  description: string | null;
  stock: number;
  createdAt: string;
}

interface CustomerPriceTier {
  id: string;
  name: string;
  color: string;
  description?: string | null;
}

interface ProductTierPrice {
  id: string;
  tierId: string;
  price: number;
  tier: CustomerPriceTier;
}

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

type ProductImportRow = Record<string, string | number | boolean | null | undefined>;

const TIER_COLORS = ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#9333ea', '#0891b2', '#64748b'];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceTiers, setPriceTiers] = useState<CustomerPriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryIdFilter, setCategoryIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  
  // Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [importPrice, setImportPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [tierPriceValues, setTierPriceValues] = useState<Record<string, string>>({});
  const [vatRate, setVatRate] = useState('10');
  const [unit, setUnit] = useState('Cái');
  const [images, setImages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState('0'); // Chỉ dùng khi tạo mới

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { user } = useApp();

  const parseOptionalPrice = (value: string) => {
    const trimmed = value.trim();
    return trimmed === '' ? null : parseFloat(trimmed);
  };

  const buildTierPricePayload = () => Object.fromEntries(
    priceTiers.map((tier) => [tier.id, parseOptionalPrice(tierPriceValues[tier.id] || '')])
  );

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/products?search=${search}&categoryId=${categoryIdFilter}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [categoryIdFilter, page, search]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPriceTiers = async () => {
    try {
      const res = await fetch('/api/customer-price-tiers');
      if (res.ok) {
        const data = await res.json();
        setPriceTiers(data.tiers);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // States for Category Management Modal
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState('');
  const [inlineCategoryMode, setInlineCategoryMode] = useState(false);
  const [isPriceTierOpen, setIsPriceTierOpen] = useState(false);
  const [tierName, setTierName] = useState('');
  const [tierColor, setTierColor] = useState(TIER_COLORS[0]);
  const [tierDesc, setTierDesc] = useState('');
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [priceTierError, setPriceTierError] = useState('');

  // Submit Category (Add or Update)
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError('');

    if (!catName.trim()) {
      setCategoryError('Tên danh mục là bắt buộc');
      return;
    }

    try {
      const url = editingCatId ? `/api/categories/${editingCatId}` : '/api/categories';
      const method = editingCatId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });

      const data = await res.json();
      if (res.ok) {
        setCatName('');
        setCatDesc('');
        setEditingCatId(null);
        void fetchCategories();
        if (!editingCatId && inlineCategoryMode && data.category?.id) {
          setCategoryId(data.category.id);
          setInlineCategoryMode(false);
          setIsCategoryOpen(false);
        }
      } else {
        setCategoryError(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      setCategoryError('Lỗi kết nối máy chủ');
    }
  };

  const handleCategorySelect = (value: string) => {
    if (value === '__create__') {
      setInlineCategoryMode(true);
      setEditingCatId(null);
      setCatName('');
      setCatDesc('');
      setCategoryError('');
      setIsCategoryOpen(true);
      return;
    }
    setCategoryId(value);
  };

  const handlePriceTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPriceTierError('');

    if (!tierName.trim()) {
      setPriceTierError('Tên phân loại là bắt buộc');
      return;
    }

    try {
      const url = editingTierId ? `/api/customer-price-tiers/${editingTierId}` : '/api/customer-price-tiers';
      const method = editingTierId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tierName, color: tierColor, description: tierDesc }),
      });
      const data = await res.json();

      if (res.ok) {
        setTierName('');
        setTierColor(TIER_COLORS[0]);
        setTierDesc('');
        setEditingTierId(null);
        await fetchPriceTiers();
      } else {
        setPriceTierError(data.error || 'Có lỗi xảy ra');
      }
    } catch {
      setPriceTierError('Lỗi kết nối máy chủ');
    }
  };

  const handlePriceTierDelete = async (tierId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phân loại khách hàng này?')) return;
    setPriceTierError('');

    try {
      const res = await fetch(`/api/customer-price-tiers/${tierId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setTierPriceValues((current) => {
          const next = { ...current };
          delete next[tierId];
          return next;
        });
        if (editingTierId === tierId) {
          setEditingTierId(null);
          setTierName('');
          setTierColor(TIER_COLORS[0]);
          setTierDesc('');
        }
        await fetchPriceTiers();
      } else {
        setPriceTierError(data.error || 'Có lỗi xảy ra khi xóa');
      }
    } catch {
      setPriceTierError('Lỗi kết nối máy chủ');
    }
  };

  // Delete Category
  const handleCategoryDelete = async (catId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này? Tất cả sản phẩm thuộc danh mục sẽ chuyển thành "Không phân mục".')) return;
    setCategoryError('');

    try {
      const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (editingCatId === catId) {
          setEditingCatId(null);
          setCatName('');
          setCatDesc('');
        }
        fetchCategories();
        fetchProducts(); // Tải lại sản phẩm để cập nhật hiển thị không phân mục
      } else {
        setCategoryError(data.error || 'Có lỗi xảy ra khi xóa');
      }
    } catch {
      setCategoryError('Lỗi kết nối máy chủ');
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchProducts();
      void fetchCategories();
      void fetchPriceTiers();
    });
  }, [fetchProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    void fetchProducts();
  };

  // Upload hình ảnh sản phẩm lên server
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError('');

    try {
      const uploadedUrls: string[] = [...images];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          uploadedUrls.push(data.url);
        } else {
          setError(data.error || 'Lỗi khi tải ảnh lên');
        }
      }
      setImages(uploadedUrls);
    } catch {
      setError('Đã xảy ra lỗi khi tải ảnh lên');
    } finally {
      setUploadingImage(false);
    }
  };

  // Xóa ảnh trong danh sách ảnh preview
  const removeImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
  };

  // Mở modal sửa
  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product);
    setName(product.name);
    setSku(product.sku || '');
    setBarcode(product.barcode || '');
    setCategoryId(product.categoryId ?? '');
    setImportPrice(product.importPrice.toString());
    setSalePrice(product.salePrice.toString());
    setTierPriceValues(Object.fromEntries(
      product.tierPrices.map((tierPrice) => [tierPrice.tierId, tierPrice.price.toString()])
    ));
    setVatRate(product.vatRate.toString());
    setUnit(product.unit);
    setImages(product.images);
    setDescription(product.description || '');
    setIsEditOpen(true);
  };

  // Thêm mới sản phẩm
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !categoryId || !importPrice || !salePrice) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    // Chặn gửi trùng khi bấm nhiều lần / mạng chậm (ví dụ qua ngrok) — xem CLAUDE.md bài học 04/07/2026
    if (saving || uploadingImage) return;
    setSaving(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, sku, barcode, categoryId,
          importPrice: parseFloat(importPrice),
          salePrice: parseFloat(salePrice),
          tierPrices: buildTierPricePayload(),
          vatRate: parseFloat(vatRate),
          unit, images, description,
          stock: parseInt(stock)
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsAddOpen(false);
        resetForm();
        fetchProducts();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    } finally {
      setSaving(false);
    }
  };

  // Sửa sản phẩm
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedProduct) return;
    if (saving || uploadingImage) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, sku, barcode, categoryId,
          importPrice: parseFloat(importPrice),
          salePrice: parseFloat(salePrice),
          tierPrices: buildTierPricePayload(),
          vatRate: parseFloat(vatRate),
          unit, images, description,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsEditOpen(false);
        setSelectedProduct(null);
        resetForm();
        fetchProducts();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    } finally {
      setSaving(false);
    }
  };

  // Xóa sản phẩm
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchProducts();
      } else {
        alert(data.error);
      }
    } catch {
      alert('Không thể thực hiện xóa');
    }
  };

  // Nhập Excel (Import Excel)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<ProductImportRow>(ws);

        // Map header tiếng Việt sang Key khớp API
        const mappedProducts = rawData.map((row) => ({
          sku: row['Mã SKU'] || row['SKU'],
          barcode: undefined,
          name: row['Tên Sản Phẩm'] || row['Tên'],
          categoryName: row['Danh Mục'] || row['Nhóm'],
          importPrice: row['Giá Nhập'],
          salePrice: row['Giá Khách Lẻ'] || row['Giá Bán'],
          tierPrices: Object.fromEntries(
            priceTiers.map((tier) => [tier.id, row[`Giá ${tier.name}`]])
          ),
          vatRate: row['Thuế VAT (%)'] || 10,
          unit: row['Đơn Vị Tính'] || 'Cái',
          stock: row['Tồn Kho'] || 0,
          description: row['Mô Tả'] || '',
        }));

        const res = await fetch('/api/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: mappedProducts }),
        });

        const data = await res.json();
        if (res.ok) {
          alert(data.message);
          setIsImportOpen(false);
          fetchProducts();
        } else {
          setError(data.error || 'Có lỗi xảy ra khi import tệp Excel');
        }
      } catch {
        setError('Định dạng tệp tin Excel không đúng cấu trúc');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Xuất Excel (Export Excel)
  const handleExportExcel = async () => {
    try {
      const res = await fetch('/api/products/export');
      if (res.ok) {
        const data = await res.json();
        
        // Sử dụng XLSX để sinh tệp tải về
        const worksheet = XLSX.utils.json_to_sheet(data.products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sản Phẩm');
        XLSX.writeFile(workbook, 'danh_sach_san_pham.xlsx');
      }
    } catch {
      alert('Đã xảy ra lỗi khi xuất Excel');
    }
  };

  const resetForm = () => {
    setName('');
    setSku('');
    setBarcode('');
    setCategoryId('');
    setImportPrice('');
    setSalePrice('');
    setTierPriceValues({});
    setVatRate('10');
    setUnit('Chiếc');
    setImages([]);
    setDescription('');
    setStock('0');
    setError('');
  };

  const renderTierPriceFields = () => (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">Giá theo phân loại khách hàng</p>
          <p className="text-[11px] text-muted-foreground">Mỗi phân loại có thể đặt một giá bán riêng cho sản phẩm này.</p>
        </div>
        <button
          type="button"
          onClick={() => { setPriceTierError(''); setIsPriceTierOpen(true); }}
          className="shrink-0 rounded border border-border px-3 py-1.5 text-[11px] font-bold hover:bg-secondary cursor-pointer"
        >
          Quản lý phân loại
        </button>
      </div>

      {priceTiers.length === 0 ? (
        <div className="rounded border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          Chưa có phân loại khách hàng. Tạo phân loại trước, sau đó các ô giá sẽ hiện ở đây.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {priceTiers.map((tier) => (
            <div key={tier.id}>
              <label className="block font-semibold mb-1">Giá {tier.name} (VND)</label>
              <MoneyInput
                value={tierPriceValues[tier.id] ? parseFloat(tierPriceValues[tier.id]) : 0}
                onChange={(v) => setTierPriceValues((current) => ({ ...current, [tier.id]: v ? v.toString() : '' }))}
                className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ CÁC NÚT NHẬP/XUẤT EXCEL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Danh mục Sản phẩm</h1>
          <p className="text-sm text-muted-foreground">Quản lý kho hàng sản phẩm, dịch vụ, xuất nhập Excel và tải lên hình ảnh sản phẩm.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 text-xs font-semibold rounded-lg bg-card border border-border px-3 py-2 hover:bg-secondary cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
          {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
            <>
              <button
                onClick={() => { setError(''); setIsImportOpen(true); }}
                className="flex items-center gap-1 text-xs font-semibold rounded-lg bg-card border border-border px-3 py-2 hover:bg-secondary cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Nhập Excel
              </button>
              <button
                onClick={() => { resetForm(); setIsAddOpen(true); }}
                className="flex items-center gap-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Thêm sản phẩm
              </button>
            </>
          )}
        </div>
      </div>

      {/* THANH BỘ LỌC TÌM KIẾM */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
            <input
              type="text"
              placeholder="Tìm theo tên, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-all cursor-pointer border border-border"
          >
            Tìm
          </button>
        </form>

        {/* Lọc theo Nhóm Danh Mục */}
        <select
          value={categoryIdFilter}
          onChange={(e) => { setPage(1); setCategoryIdFilter(e.target.value); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none cursor-pointer"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
          <>
            <button
              onClick={() => { setInlineCategoryMode(false); setCategoryError(''); setIsCategoryOpen(true); }}
              className="rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
            >
              Quản lý danh mục
            </button>
            <button
              onClick={() => { setPriceTierError(''); setIsPriceTierOpen(true); }}
              className="rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
            >
              Quản lý phân loại khách
            </button>
          </>
        )}
      </div>

      {/* DANH SÁCH BẢNG SẢN PHẨM */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-3">Mã số</th>
                <th className="p-3">Hình</th>
                <th className="p-3">Tên sản phẩm</th>
                <th className="p-3">Danh mục</th>
                <th className="p-3">Giá nhập</th>
                <th className="p-3">Giá bán</th>
                <th className="p-3">Giá theo phân loại</th>
                <th className="p-3">Đơn vị</th>
                <th className="p-3 text-center">Tồn kho</th>
                <th className="p-3 text-right">Chức năng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">Đang tải danh sách...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">Không tìm thấy sản phẩm nào.</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-bold text-foreground">
                      {p.code}
                      {p.sku && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>}
                    </td>
                    <td className="p-3">
                      {p.images && p.images.length > 0 ? (
                        <Image src={p.images[0]} alt={p.name} width={36} height={36} unoptimized className="h-9 w-9 rounded-lg object-cover border border-border bg-muted" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-foreground max-w-[200px] truncate">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{p.category?.name ?? 'Không phân mục'}</td>
                    <td className="p-3 font-semibold text-muted-foreground">{formatCurrency(p.importPrice)}</td>
                    <td className="p-3 font-extrabold text-foreground">{formatCurrency(p.salePrice)}</td>
                    <td className="p-3 text-[10px] text-muted-foreground">
                      {p.tierPrices.length === 0 ? (
                        <span>-</span>
                      ) : (
                        p.tierPrices.map((tierPrice) => (
                          <div key={tierPrice.id}>
                            {tierPrice.tier.name}: <span className="font-semibold text-foreground">{formatCurrency(tierPrice.price)}</span>
                          </div>
                        ))
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.unit}</td>
                    <td className="p-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        p.stock > 10 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                      }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Sửa"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="flex items-center justify-between border-t border-border p-3">
          <span className="text-xs text-muted-foreground">Trang {page} / {totalPages}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg p-1.5 hover:bg-secondary text-muted-foreground disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL THÊM SẢN PHẨM MỚI */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Thêm sản phẩm mới</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tên sản phẩm *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" placeholder="Laptop Dell Latitude..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Mã SKU</label>
                  <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" placeholder="LAP-DELL-5520" />
                </div>
                <div className="hidden" aria-hidden="true">
                  <input type="hidden" value={barcode} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nhóm danh mục</label>
                  <select value={categoryId} onChange={(e) => handleCategorySelect(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer">
                    <option value="">Không phân mục</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    <option value="__create__">+ Thêm phân loại mới...</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Đơn vị tính</label>
                  <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Giá nhập (VND) *</label>
                  <MoneyInput required value={importPrice ? parseFloat(importPrice) : 0} onChange={(v) => setImportPrice(v ? v.toString() : '')} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Giá khách lẻ (VND) *</label>
                  <MoneyInput required value={salePrice ? parseFloat(salePrice) : 0} onChange={(v) => setSalePrice(v ? v.toString() : '')} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Thuế VAT (%)</label>
                  <input type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
              </div>

              {renderTierPriceFields()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tồn kho ban đầu</label>
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
              </div>

              {/* Tải lên hình ảnh sản phẩm (Nhiều ảnh) */}
              <div>
                <label className="block font-semibold mb-1">Hình ảnh sản phẩm</label>
                <div className="flex flex-wrap gap-2.5 items-center mt-1">
                  {images.map((url, idx) => (
                    <div key={url} className="relative h-14 w-14 rounded-lg border border-border overflow-hidden bg-muted group">
                      <Image src={url} alt="product" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Khung tải ảnh lên */}
                  <label className="h-14 w-14 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer transition-colors">
                    {uploadingImage ? (
                      <span className="text-[10px] animate-pulse">...</span>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span className="text-[8px] mt-0.5">Tải lên</span>
                      </>
                    )}
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mô tả sản phẩm</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground resize-none bg-transparent" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" disabled={saving || uploadingImage} className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer">{uploadingImage ? 'Đang tải ảnh...' : saving ? 'Đang lưu...' : 'Lưu sản phẩm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SỬA SẢN PHẨM */}
      {isEditOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Cập nhật sản phẩm</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tên sản phẩm *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Mã SKU</label>
                  <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
                <div className="hidden" aria-hidden="true">
                  <input type="hidden" value={barcode} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nhóm danh mục</label>
                  <select value={categoryId} onChange={(e) => handleCategorySelect(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer">
                    <option value="">Không phân mục</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                    <option value="__create__">+ Thêm phân loại mới...</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Đơn vị tính</label>
                  <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Giá nhập (VND) *</label>
                  <MoneyInput required value={importPrice ? parseFloat(importPrice) : 0} onChange={(v) => setImportPrice(v ? v.toString() : '')} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Giá khách lẻ (VND) *</label>
                  <MoneyInput required value={salePrice ? parseFloat(salePrice) : 0} onChange={(v) => setSalePrice(v ? v.toString() : '')} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Thuế VAT (%)</label>
                  <input type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent" />
                </div>
              </div>

              {renderTierPriceFields()}

              <div>
                <label className="block font-semibold mb-1">Hình ảnh sản phẩm</label>
                <div className="flex flex-wrap gap-2.5 items-center mt-1">
                  {images.map((url, idx) => (
                    <div key={url} className="relative h-14 w-14 rounded-lg border border-border overflow-hidden bg-muted group">
                      <Image src={url} alt="product" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  <label className="h-14 w-14 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer transition-colors">
                    {uploadingImage ? (
                      <span className="text-[10px] animate-pulse">...</span>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span className="text-[8px] mt-0.5">Tải lên</span>
                      </>
                    )}
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mô tả sản phẩm</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground resize-none bg-transparent" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" disabled={saving || uploadingImage} className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer">{uploadingImage ? 'Đang tải ảnh...' : saving ? 'Đang lưu...' : 'Cập nhật sản phẩm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HƯỚNG DẪN IMPORT EXCEL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsImportOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-1.5">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              Nhập sản phẩm từ file Excel
            </h3>
            
            <div className="space-y-3.5 text-xs text-muted-foreground border-b border-border pb-4 mb-4">
              <p>Tải lên tệp Excel của bạn chứa danh sách hàng hóa. Tệp cần phải chứa các tiêu đề cột đúng định dạng sau:</p>
              <ul className="list-disc pl-5 space-y-1 font-semibold text-foreground">
                <li><code className="text-primary">Tên Sản Phẩm</code> (Bắt buộc)</li>
                <li><code className="text-primary">Danh Mục</code> (Tên danh mục, e.g. Thiết bị điện tử)</li>
                <li><code className="text-primary">Giá Nhập</code> (Số nguyên)</li>
                <li><code className="text-primary">Giá Khách Lẻ</code> hoặc <code className="text-primary">Giá Bán</code> (Số nguyên)</li>
                {priceTiers.length > 0 && (
                  <li>
                    Các cột giá theo phân loại hiện có: {priceTiers.map((tier) => (
                      <code key={tier.id} className="text-primary"> Giá {tier.name}</code>
                    ))} (Tùy chọn)
                  </li>
                )}
                <li><code className="text-primary">Mã SKU</code> (Tùy chọn)</li>
                <li><code className="text-primary">Thuế VAT (%)</code> (Số nguyên, mặc định 10)</li>
                <li><code className="text-primary">Đơn Vị Tính</code> (Mặc định: Cái)</li>
                <li><code className="text-primary">Tồn Kho</code> (Số lượng tồn kho ban đầu)</li>
              </ul>
            </div>

            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border p-6 rounded-xl bg-muted/20">
              <Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <span className="text-xs font-semibold text-foreground mb-1">Nhấp để chọn file Excel</span>
              <span className="text-[10px] text-muted-foreground">Hỗ trợ tệp định dạng .xlsx, .xls</span>
              <input
                type="file"
                ref={importFileRef}
                accept=".xlsx, .xls"
                onChange={handleImportExcel}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="mt-4 rounded bg-primary text-primary-foreground px-4 py-2 font-bold hover:opacity-90 transition-all cursor-pointer"
              >
                Chọn tệp tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ DANH MỤC */}
      {isCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl relative max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => { setIsCategoryOpen(false); setInlineCategoryMode(false); setEditingCatId(null); setCatName(''); setCatDesc(''); }}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-1.5 text-foreground">
              Quản lý danh mục sản phẩm
            </h3>

            {categoryError && (
              <div className="mb-3 text-xs font-semibold text-destructive rounded bg-destructive/10 p-2.5 border border-destructive/20">
                {categoryError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 overflow-y-auto pr-1">
              {/* Form Thêm/Sửa */}
              <form onSubmit={handleCategorySubmit} className="space-y-3.5 text-xs border-r border-border/60 pr-5">
                <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">
                  {editingCatId ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
                </h4>
                
                <div>
                  <label className="block font-semibold mb-1">Tên danh mục *</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent"
                    placeholder="e.g. Mỹ phẩm, Đồ điện tử..."
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Mô tả danh mục</label>
                  <textarea
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent resize-none"
                    placeholder="Nhập mô tả ngắn..."
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 font-bold cursor-pointer">
                    {editingCatId ? 'Lưu cập nhật' : 'Tạo mới'}
                  </button>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={() => { setEditingCatId(null); setCatName(''); setCatDesc(''); }}
                      className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer"
                    >
                      Hủy sửa
                    </button>
                  )}
                </div>
              </form>

              {/* Danh sách danh mục */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto text-xs">
                <h4 className="font-bold text-foreground text-sm uppercase tracking-wider mb-2.5">
                  Danh sách hiện tại
                </h4>

                {categories.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">Chưa có danh mục nào.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {categories.map((cat) => (
                      <div key={cat.id} className="py-2.5 flex justify-between items-start gap-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground text-sm">{cat.name}</p>
                          {cat.description && <p className="text-muted-foreground text-[10px] italic">{cat.description}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingCatId(cat.id); setCatName(cat.name); setCatDesc(cat.description || ''); }}
                            className="rounded px-2 py-1 bg-secondary hover:bg-muted text-[10px] font-bold border border-border cursor-pointer text-foreground"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCategoryDelete(cat.id)}
                            className="rounded px-2 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive text-[10px] font-bold border border-destructive/20 cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ PHÂN LOẠI KHÁCH HÀNG */}
      {isPriceTierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl relative max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => { setIsPriceTierOpen(false); setEditingTierId(null); setTierName(''); setTierColor(TIER_COLORS[0]); setTierDesc(''); }}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-1.5 text-foreground">
              Quản lý phân loại khách hàng
            </h3>

            {priceTierError && (
              <div className="mb-3 text-xs font-semibold text-destructive rounded bg-destructive/10 p-2.5 border border-destructive/20">
                {priceTierError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 overflow-y-auto pr-1">
              <form onSubmit={handlePriceTierSubmit} className="space-y-3.5 text-xs border-r border-border/60 pr-5">
                <h4 className="font-bold text-foreground text-sm uppercase tracking-wider">
                  {editingTierId ? 'Cập nhật phân loại' : 'Thêm phân loại mới'}
                </h4>

                <div>
                  <label className="block font-semibold mb-1">Tên phân loại *</label>
                  <input
                    type="text"
                    required
                    value={tierName}
                    onChange={(e) => setTierName(e.target.value)}
                    className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent"
                    placeholder="Ví dụ: Khách sỉ, Đại lý miền Bắc, VIP..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold">Màu</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={tierColor}
                      onChange={(e) => setTierColor(e.target.value)}
                      className="h-9 w-12 rounded border border-border bg-card p-1 cursor-pointer"
                    />
                    {TIER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setTierColor(color)}
                        className={`h-5 w-5 rounded-full border cursor-pointer ${tierColor === color ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'border-border'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Mô tả</label>
                  <textarea
                    value={tierDesc}
                    onChange={(e) => setTierDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground bg-transparent resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 font-bold cursor-pointer">
                    {editingTierId ? 'Lưu cập nhật' : 'Tạo mới'}
                  </button>
                  {editingTierId && (
                    <button
                      type="button"
                      onClick={() => { setEditingTierId(null); setTierName(''); setTierColor(TIER_COLORS[0]); setTierDesc(''); }}
                      className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer"
                    >
                      Hủy sửa
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto text-xs">
                <h4 className="font-bold text-foreground text-sm uppercase tracking-wider mb-2.5">
                  Danh sách hiện tại
                </h4>

                {priceTiers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">Chưa có phân loại nào.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {priceTiers.map((tier) => (
                      <div key={tier.id} className="py-2.5 flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <span
                            className="inline-flex max-w-[180px] rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: tier.color }}
                          >
                            <span className="truncate">{tier.name}</span>
                          </span>
                          {tier.description && <p className="text-muted-foreground text-[10px] italic">{tier.description}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => { setEditingTierId(tier.id); setTierName(tier.name); setTierColor(tier.color); setTierDesc(tier.description || ''); }}
                            className="rounded px-2 py-1 bg-secondary hover:bg-muted text-[10px] font-bold border border-border cursor-pointer text-foreground"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePriceTierDelete(tier.id)}
                            className="rounded px-2 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive text-[10px] font-bold border border-destructive/20 cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
