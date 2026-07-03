'use client';

import React, { useEffect, useState } from 'react';
import { 
  Plus, Search, Landmark, FileText, 
  Calendar, User, X, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Payment {
  id: string;
  code: string;
  amount: number;
  date: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD';
  payor: { username: string };
  supplier: { name: string; company: string | null } | null;
  note: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
  company: string | null;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [note, setNote] = useState('');

  const { user } = useApp();

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?search=${search}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers?limit=999');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page]);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Số tiền chi phải lớn hơn 0');
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierId || null,
          amount: amt,
          paymentMethod,
          note,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsOpen(false);
        setSupplierId('');
        setAmount('');
        setNote('');
        fetchPayments();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ NÚT TẠO MỚI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Phiếu chi tiền</h1>
          <p className="text-sm text-muted-foreground">Theo dõi và quản lý dòng tiền đi ra khỏi doanh nghiệp để trả nợ nhà cung cấp hoặc các hoạt động mua sắm.</p>
        </div>
        {['ADMIN', 'ACCOUNTANT'].includes(user?.role || '') && (
          <button
            onClick={() => { setError(''); setIsOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Lập phiếu chi mới
          </button>
        )}
      </div>

      {/* THANH TÌM KIẾM */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
          <input
            type="text"
            placeholder="Tìm theo mã phiếu chi, nhà cung cấp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer border border-border"
        >
          Tìm
        </button>
      </form>

      {/* BẢNG PHIẾU CHI */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-3">Mã số</th>
                <th className="p-3">Ngày chi</th>
                <th className="p-3">Nhà cung cấp</th>
                <th className="p-3">Hình thức</th>
                <th className="p-3">Số tiền chi</th>
                <th className="p-3">Mô tả/Ghi chú</th>
                <th className="p-3">Người chi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Đang tải danh sách...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Chưa phát sinh phiếu chi nào.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold text-foreground">{p.code}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="p-3 font-semibold text-foreground">
                      {p.supplier?.name || 'Vãng lai'}
                      {p.supplier?.company && <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate max-w-[150px]">{p.supplier.company}</p>}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        p.paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {p.paymentMethod === 'BANK_TRANSFER' ? 'CHUYỂN KHOẢN' : p.paymentMethod === 'CARD' ? 'QUẸT THẺ' : 'TIỀN MẶT'}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-destructive">-{formatCurrency(p.amount)}</td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate" title={p.note || ''}>{p.note || '—'}</td>
                    <td className="p-3 text-muted-foreground capitalize">{p.payor.username}</td>
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

      {/* MODAL LẬP PHIẾU CHI MỚI */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Lập phiếu chi trả tiền mới</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Chi trả cho nhà cung cấp nào?</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer"
                >
                  <option value="">-- Chi tự do / Không liên kết nhà cung cấp --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Số tiền chi ra (VND) *</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded border border-border p-2.5 bg-transparent font-bold text-sm"
                  placeholder="Nhập số tiền chi"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Hình thức thanh toán *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer"
                >
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản (BANK)</option>
                  <option value="CARD">Quẹt thẻ (CARD)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú phiếu chi</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-border p-2 focus:outline-none bg-transparent resize-none"
                  placeholder="Nhập lý do chi tiền..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Tạo phiếu chi</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
