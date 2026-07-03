'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Plus, Search, Edit, Trash2, Eye, 
  Receipt, ArrowRight, Calendar, User, 
  ChevronLeft, ChevronRight, Landmark, XCircle
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Invoice {
  id: string;
  code: string;
  customerId: string;
  customer: { name: string; company: string | null };
  date: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  total: number;
  paidAmount: number;
  remainingAmount: number;
  creator: { username: string };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const { user } = useApp();

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices?search=${search}&status=${statusFilter}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  // Hủy hóa đơn (đổi trạng thái sang CANCELLED, Backend tự động hoàn kho)
  const handleCancelInvoice = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn HỦY hóa đơn này? Hành động này sẽ tự động HOÀN TRẢ toàn bộ số lượng sản phẩm về kho hàng.')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Hủy hóa đơn thành công! Tồn kho đã được hoàn.');
        fetchInvoices();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Không thể thực hiện hủy hóa đơn');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ NÚT TẠO MỚI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Hóa đơn Bán hàng</h1>
          <p className="text-sm text-muted-foreground">Quản lý hóa đơn xuất bán, theo dõi tình trạng thanh toán nợ và lập phiếu thu tiền mặt/chuyển khoản.</p>
        </div>
        <Link
          href="/invoices/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Xuất hóa đơn trực tiếp
        </Link>
      </div>

      {/* THANH BỘ LỌC TÌM KIẾM */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
            <input
              type="text"
              placeholder="Tìm theo số hóa đơn, khách hàng..."
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
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none cursor-pointer"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="UNPAID">Chưa thanh toán</option>
          <option value="PARTIALLY_PAID">Thanh toán 1 phần</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="CANCELLED">Đã hủy hóa đơn</option>
        </select>
      </div>

      {/* BẢNG HÓA ĐƠN */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-3">Số hóa đơn</th>
                <th className="p-3">Khách hàng</th>
                <th className="p-3">Ngày xuất</th>
                <th className="p-3">Giá trị hóa đơn</th>
                <th className="p-3">Đã thu</th>
                <th className="p-3">Còn nợ</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Chức năng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">Đang tải danh sách hóa đơn...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">Không tìm thấy hóa đơn nào.</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold text-foreground">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.code}</Link>
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {inv.customer.name}
                      {inv.customer.company && <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate max-w-[150px]">{inv.customer.company}</p>}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(inv.date)}</td>
                    <td className="p-3 font-bold text-foreground">{formatCurrency(inv.total)}</td>
                    <td className="p-3 font-semibold text-emerald-500">{formatCurrency(inv.paidAmount)}</td>
                    <td className="p-3 font-semibold text-destructive">{formatCurrency(inv.remainingAmount)}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' :
                        inv.status === 'PARTIALLY_PAID' ? 'bg-blue-500/10 text-blue-500' :
                        inv.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {inv.status === 'PAID' ? 'Đã thu tiền' :
                         inv.status === 'PARTIALLY_PAID' ? 'Trả một phần' :
                         inv.status === 'CANCELLED' ? 'Đã hủy' : 'Chưa thu tiền'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Xem chi tiết & In"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && ['ADMIN', 'ACCOUNTANT'].includes(user?.role || '') && (
                          <Link
                            href={`/receipts?invoiceId=${inv.id}`}
                            className="rounded p-1 hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-600 cursor-pointer"
                            title="Lập phiếu thu tiền"
                          >
                            <Landmark className="h-4 w-4" />
                          </Link>
                        )}
                        {inv.status !== 'CANCELLED' && ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            className="rounded p-1 hover:bg-destructive/10 text-destructive cursor-pointer"
                            title="Hủy hóa đơn (Hoàn kho)"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
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

    </div>
  );
}
