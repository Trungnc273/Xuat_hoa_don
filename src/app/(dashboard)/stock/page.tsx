'use client';

import React, { useEffect, useState } from 'react';
import { 
  Plus, Search, Warehouse, FileText, 
  ArrowUpRight, ArrowDownRight, RefreshCw, 
  X, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  address: string | null;
  description: string | null;
}

interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'CHECK';
  productId: string;
  product: { code: string; name: string; sku: string | null; unit: string };
  quantity: number;
  prevStock: number;
  newStock: number;
  warehouseId: string;
  warehouse: { name: string };
  reason: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface ProductItem {
  id: string;
  code: string;
  name: string;
  sku: string | null;
  stock: number;
}

export default function StockPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [whFilter, setWhFilter] = useState('');

  // Modals
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isAddWhOpen, setIsAddWhOpen] = useState(false);
  const [error, setError] = useState('');

  // Form Adjust Stock
  const [adjProductId, setAdjProductId] = useState('');
  const [adjWarehouseId, setAdjWarehouseId] = useState('');
  const [adjType, setAdjType] = useState('IN'); // IN, OUT, ADJUST
  const [adjQuantity, setAdjQuantity] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjNote, setAdjNote] = useState('');

  // Form Add Warehouse
  const [whName, setWhName] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whDescription, setWhDescription] = useState('');

  const { user } = useApp();

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await fetch('/api/warehouses');
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses);
        if (data.warehouses.length > 0) {
          setAdjWarehouseId(data.warehouses[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const fetchMovements = async () => {
    setLoadingMovements(true);
    try {
      const res = await fetch(`/api/stock-movements?type=${typeFilter}&warehouseId=${whFilter}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setMovements(data.movements);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMovements(false);
    }
  };

  const fetchProductsList = async () => {
    try {
      const res = await fetch('/api/products?limit=999'); // Lấy nhanh danh sách sản phẩm để chọn
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        if (data.products.length > 0) {
          setAdjProductId(data.products[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    fetchProductsList();
  }, []);

  useEffect(() => {
    fetchMovements();
  }, [page, typeFilter, whFilter]);

  // Submit phiếu điều chỉnh kho
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adjProductId || !adjWarehouseId || !adjType || !adjQuantity) {
      setError('Vui lòng nhập đầy đủ các trường bắt buộc');
      return;
    }

    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjProductId,
          warehouseId: adjWarehouseId,
          type: adjType,
          quantity: parseInt(adjQuantity),
          reason: adjReason,
          note: adjNote,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsAdjustOpen(false);
        setAdjQuantity('');
        setAdjReason('');
        setAdjNote('');
        fetchMovements();
        fetchProductsList(); // Cập nhật lại tồn kho trong danh sách chọn
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Đã xảy ra lỗi hệ thống');
    }
  };

  // Submit tạo kho hàng mới
  const handleAddWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!whName) {
      setError('Tên kho hàng là bắt buộc');
      return;
    }

    try {
      const res = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: whName,
          address: whAddress,
          description: whDescription,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsAddWhOpen(false);
        setWhName('');
        setWhAddress('');
        setWhDescription('');
        fetchWarehouses();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Đã xảy ra lỗi hệ thống');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ NÚT CHỨC NĂNG */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Quản lý Kho & Tồn kho</h1>
          <p className="text-sm text-muted-foreground">Theo dõi và thực hiện xuất, nhập, kiểm kê điều chỉnh hàng hóa giữa các kho.</p>
        </div>
        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
          <div className="flex gap-2">
            <button
              onClick={() => { setError(''); setIsAddWhOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3.5 py-2 text-xs font-bold hover:bg-secondary cursor-pointer"
            >
              <Warehouse className="h-4 w-4" />
              Thêm kho hàng
            </button>
            <button
              onClick={() => { setError(''); setIsAdjustOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Điều chỉnh tồn kho
            </button>
          </div>
        )}
      </div>

      {/* DANH SÁCH NHÀ KHO HIỆN TẠI (GRID CARDS) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Danh sách kho hàng doanh nghiệp</h3>
        {loadingWarehouses ? (
          <div className="text-sm text-muted-foreground">Đang tải kho hàng...</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((wh) => (
              <div key={wh.id} className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Warehouse className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{wh.name}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{wh.code}</p>
                  <p className="text-xs text-muted-foreground mt-2">{wh.address || 'Không có địa chỉ'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LỌC NHẬT KÝ LUÂN CHUYỂN KHO */}
      <div className="space-y-3 pt-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Nhật ký nhập xuất, kiểm kê kho</h3>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">Tất cả hình thức</option>
            <option value="IN">Nhập kho (IN)</option>
            <option value="OUT">Xuất kho (OUT)</option>
            <option value="ADJUST">Kiểm kê (ADJUST)</option>
            <option value="CHECK">Điều chỉnh (CHECK)</option>
          </select>

          <select
            value={whFilter}
            onChange={(e) => { setPage(1); setWhFilter(e.target.value); }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">Tất cả kho hàng</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* BẢNG LỊCH SỬ LUÂN CHUYỂN KHO */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3">Ngày tháng</th>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3 text-center">Kiểu</th>
                  <th className="p-3 text-center">Số lượng</th>
                  <th className="p-3 text-center">Tồn trước</th>
                  <th className="p-3 text-center">Tồn sau</th>
                  <th className="p-3">Kho hàng</th>
                  <th className="p-3">Lý do điều chỉnh</th>
                  <th className="p-3">Người lập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loadingMovements ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">Đang tải lịch sử...</td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">Chưa phát sinh nhật ký kho hàng nào.</td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(m.createdAt)}</td>
                      <td className="p-3 font-semibold text-foreground">
                        {m.product.name}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{m.product.code}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          m.type === 'IN' ? 'bg-emerald-500/10 text-emerald-500' :
                          m.type === 'OUT' ? 'bg-destructive/10 text-destructive' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {m.type === 'IN' ? 'NHẬP' : m.type === 'OUT' ? 'XUẤT' : 'ĐIỀU CHỈNH'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold">{m.quantity} {m.product.unit}</td>
                      <td className="p-3 text-center text-muted-foreground">{m.prevStock}</td>
                      <td className="p-3 text-center font-bold text-foreground">{m.newStock}</td>
                      <td className="p-3 text-muted-foreground">{m.warehouse.name}</td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate" title={m.reason || ''}>{m.reason || '—'}</td>
                      <td className="p-3 text-muted-foreground capitalize">{m.createdBy || 'Hệ thống'}</td>
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

      </div>

      {/* MODAL ĐIỀU CHỈNH TỒN KHO */}
      {isAdjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsAdjustOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Lập phiếu điều chỉnh tồn kho</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Sản phẩm điều chỉnh *</label>
                <select value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer">
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code} - Hiện có {p.stock})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Kho hàng tác động *</label>
                  <select value={adjWarehouseId} onChange={(e) => setAdjWarehouseId(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer">
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hình thức *</label>
                  <select value={adjType} onChange={(e) => setAdjType(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer">
                    <option value="IN">Nhập kho bổ sung (IN)</option>
                    <option value="OUT">Xuất kho hao hụt (OUT)</option>
                    <option value="ADJUST">Kiểm kê thực tế (ADJUST)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {adjType === 'ADJUST' ? 'Số lượng tồn kho thực tế kiểm kê *' : 'Số lượng điều chỉnh (tăng/giảm) *'}
                </label>
                <input type="number" required value={adjQuantity} onChange={(e) => setAdjQuantity(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-transparent" placeholder="e.g. 10" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Lý do điều chỉnh *</label>
                <input type="text" required value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-transparent" placeholder="e.g. Kiểm kê kho định kỳ phát hiện thừa/thiếu" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú thêm</label>
                <textarea value={adjNote} onChange={(e) => setAdjNote(e.target.value)} rows={2} className="w-full rounded border border-border p-2 focus:outline-none bg-transparent resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAdjustOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Lưu phiếu điều chỉnh</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM KHO HÀNG */}
      {isAddWhOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsAddWhOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Thêm kho hàng mới</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleAddWhSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tên kho hàng *</label>
                <input type="text" required value={whName} onChange={(e) => setWhName(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-transparent" placeholder="e.g. Kho phụ Miền Trung" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Địa chỉ kho</label>
                <input type="text" value={whAddress} onChange={(e) => setWhAddress(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none bg-transparent" placeholder="Số 102 Đường..." />
              </div>

              <div>
                <label className="block font-semibold mb-1">Mô tả kho</label>
                <textarea value={whDescription} onChange={(e) => setWhDescription(e.target.value)} rows={2} className="w-full rounded border border-border p-2 focus:outline-none bg-transparent resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddWhOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Lưu kho</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
