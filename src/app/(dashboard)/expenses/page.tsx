'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { 
  Plus, Search, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Expense {
  id: string;
  code: string;
  title: string;
  category: 'OFFICE' | 'MARKETING' | 'SALARY' | 'TRAVEL' | 'UTILITIES' | 'OTHER';
  amount: number;
  date: string;
  payor: { username: string };
  note: string | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OFFICE');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const { user } = useApp();

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch(`/api/expenses?search=${search}&category=${categoryFilter}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, search]);

  useEffect(() => {
    queueMicrotask(() => void fetchExpenses());
  }, [fetchExpenses]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    void fetchExpenses();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amt = parseFloat(amount);
    if (!title || !category || !amt || amt <= 0) {
      setError('Vui lòng nhập đầy đủ tiêu đề, nhóm chi phí và số tiền lớn hơn 0');
      return;
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          amount: amt,
          note,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsOpen(false);
        setTitle('');
        setAmount('');
        setNote('');
        fetchExpenses();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Lỗi kết nối máy chủ');
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'OFFICE': return 'Văn phòng phẩm';
      case 'MARKETING': return 'Quảng cáo / Marketing';
      case 'SALARY': return 'Lương nhân viên';
      case 'TRAVEL': return 'Công tác phí / Đi lại';
      case 'UTILITIES': return 'Điện nước / Internet';
      default: return 'Chi phí khác';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ NÚT TẠO MỚI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Chi phí Doanh nghiệp</h1>
          <p className="text-sm text-muted-foreground">Ghi chép các chi phí nội bộ như điện, nước, quảng cáo, lương thưởng và các chi phí khác.</p>
        </div>
        {['ADMIN', 'ACCOUNTANT'].includes(user?.role || '') && (
          <button
            onClick={() => { setError(''); setIsOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Ghi nhận chi phí
          </button>
        )}
      </div>

      {/* THANH BỘ LỌC TÌM KIẾM */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, mã số chi phí..."
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

        <select
          value={categoryFilter}
          onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none cursor-pointer"
        >
          <option value="">Tất cả hạng mục</option>
          <option value="OFFICE">Văn phòng phẩm</option>
          <option value="MARKETING">Quảng cáo / Marketing</option>
          <option value="SALARY">Lương nhân viên</option>
          <option value="TRAVEL">Công tác phí / Đi lại</option>
          <option value="UTILITIES">Điện nước / Internet</option>
          <option value="OTHER">Chi phí khác</option>
        </select>
      </div>

      {/* BẢNG CHI PHÍ */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-3">Mã số</th>
                <th className="p-3">Ngày chi</th>
                <th className="p-3">Khoản chi tiêu</th>
                <th className="p-3">Hạng mục</th>
                <th className="p-3">Số tiền</th>
                <th className="p-3">Ghi chú</th>
                <th className="p-3">Người thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Đang tải danh sách...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Không tìm thấy khoản chi phí nào.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold text-foreground">{e.code}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="p-3 font-semibold text-foreground">{e.title}</td>
                    <td className="p-3 text-muted-foreground">{getCategoryLabel(e.category)}</td>
                    <td className="p-3 font-extrabold text-destructive">-{formatCurrency(e.amount)}</td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate" title={e.note || ''}>{e.note || '—'}</td>
                    <td className="p-3 text-muted-foreground capitalize">{e.payor.username}</td>
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

      {/* MODAL GHI NHẬN CHI PHÍ */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Ghi nhận khoản chi phí mới</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tiêu đề khoản chi *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded border border-border p-2 focus:outline-none bg-transparent"
                  placeholder="e.g. Thanh toán tiền điện tháng 06"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Hạng mục chi phí *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded border border-border p-2 focus:outline-none bg-card cursor-pointer"
                  >
                    <option value="OFFICE">Văn phòng phẩm</option>
                    <option value="MARKETING">Quảng cáo / Marketing</option>
                    <option value="SALARY">Lương nhân viên</option>
                    <option value="TRAVEL">Công tác phí / Đi lại</option>
                    <option value="UTILITIES">Điện nước / Internet</option>
                    <option value="OTHER">Hạng mục khác</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Số tiền chi tiêu *</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded border border-border p-2 focus:outline-none bg-transparent font-bold"
                    placeholder="e.g. 1500000"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú thêm</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-border p-2 focus:outline-none bg-transparent resize-none"
                  placeholder="Nhập ghi chú chi tiết..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Lưu chi phí</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
