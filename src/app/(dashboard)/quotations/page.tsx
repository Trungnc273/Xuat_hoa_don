'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, Search, Edit, Trash2, Eye, 
  ArrowRight,
  ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import CustomerTagChip, { type CustomerTagInfo } from '@/components/CustomerTagChip';

interface Quotation {
  id: string;
  code: string;
  customerId: string;
  customer: { name: string; company: string | null; phone: string | null } & CustomerTagInfo;
  date: string;
  dueDate: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  total: number;
  creator: { username: string };
  createdAt: string;
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());
  
  const fetchQuotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations?search=${search}&status=${statusFilter}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setQuotations(data.quotations);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    queueMicrotask(() => void fetchQuotations());
  }, [fetchQuotations]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    void fetchQuotations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa báo giá này?')) return;
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchQuotations();
      } else {
        alert(data.error);
      }
    } catch {
      alert('Không thể thực hiện xóa');
    }
  };

  const handleConvert = async (id: string) => {
    if (!confirm('Bạn có đồng ý chuyển báo giá này thành Hóa đơn bán hàng? Hóa đơn mới sẽ được lập tự động.')) return;
    try {
      const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('Chuyển đổi thành công! Chuyển hướng sang hóa đơn mới lập...');
        router.push(`/invoices/${data.invoice.id}`);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Đã xảy ra lỗi khi chuyển đổi');
    }
  };

  const groupedQuotations = useMemo(() => {
    const groups = new Map<string, { customerId: string; customer: Quotation['customer']; quotations: Quotation[]; total: number }>();

    quotations.forEach((quotation) => {
      const currentGroup = groups.get(quotation.customerId);
      if (currentGroup) {
        currentGroup.quotations.push(quotation);
        currentGroup.total += quotation.total;
        return;
      }

      groups.set(quotation.customerId, {
        customerId: quotation.customerId,
        customer: quotation.customer,
        quotations: [quotation],
        total: quotation.total,
      });
    });

    return Array.from(groups.values());
  }, [quotations]);

  const toggleCustomerGroup = (customerId: string) => {
    setExpandedCustomerIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(customerId)) {
        nextIds.delete(customerId);
      } else {
        nextIds.add(customerId);
      }
      return nextIds;
    });
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ NÚT TẠO MỚI */}
      <div className="flex flex-col items-start gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Quản lý Báo giá</h1>
          <p className="text-sm text-muted-foreground">Lập báo giá gửi khách hàng, theo dõi phản hồi và chuyển đổi trực tiếp thành Hóa đơn.</p>
        </div>
        <Link
          href="/quotations/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Tạo báo giá mới
        </Link>
      </div>

      {/* THANH BỘ LỌC TÌM KIẾM */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
            <input
              type="text"
              placeholder="Tìm theo số báo giá, khách hàng, SĐT..."
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
          <option value="DRAFT">Nháp (DRAFT)</option>
          <option value="SENT">Đã gửi (SENT)</option>
          <option value="ACCEPTED">Đồng ý (ACCEPTED)</option>
          <option value="CONVERTED">Đã xuất HĐ (CONVERTED)</option>
        </select>
      </div>

      {/* BẢNG BÁO GIÁ */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-3">Số báo giá</th>
                <th className="p-3">Ngày lập</th>
                <th className="p-3">Hạn báo giá</th>
                <th className="p-3">Giá trị báo giá</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Người tạo</th>
                <th className="p-3 text-right">Chức năng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Đang tải danh sách báo giá...</td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Không tìm thấy báo giá nào.</td>
                </tr>
              ) : (
                groupedQuotations.map((group) => {
                  const isExpanded = expandedCustomerIds.has(group.customerId);
                  const isDimmed = expandedCustomerIds.size > 0 && !isExpanded;

                  return (
                  <React.Fragment key={group.customerId}>
                    <tr className={`bg-muted/30 hover:bg-muted/50 transition-opacity duration-200 ${isDimmed ? 'opacity-40 hover:opacity-80' : ''}`}>
                      <td colSpan={7} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleCustomerGroup(group.customerId)}
                          className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"
                          aria-expanded={isExpanded}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            <span className="min-w-0 font-bold text-foreground">
                              {group.customer.name}
                              {group.customer.company && <span className="ml-2 text-[10px] font-semibold text-muted-foreground">{group.customer.company}</span>}
                              {group.customer.phone && <span className="ml-2 text-[10px] font-semibold text-muted-foreground">{group.customer.phone}</span>}
                            </span>
                            <CustomerTagChip customer={group.customer} />
                          </span>
                          <span className="pl-6 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:pl-0">
                            {group.quotations.length} báo giá - Tổng {formatCurrency(group.total)}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {isExpanded && group.quotations.map((q) => (
                      <tr key={q.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 pl-8 font-bold text-foreground">
                          <Link href={`/quotations/${q.id}`} className="hover:underline">{q.code}</Link>
                        </td>
                        <td className="p-3 text-muted-foreground">{formatDate(q.date)}</td>
                        <td className="p-3 text-muted-foreground">{q.dueDate ? formatDate(q.dueDate) : '—'}</td>
                        <td className="p-3 font-extrabold text-foreground">{formatCurrency(q.total)}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            q.status === 'CONVERTED' ? 'bg-emerald-500/10 text-emerald-500' :
                            q.status === 'SENT' ? 'bg-blue-500/10 text-blue-500' :
                            q.status === 'ACCEPTED' ? 'bg-indigo-500/10 text-indigo-500' :
                            q.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {q.status === 'CONVERTED' ? 'Đã chuyển HĐ' :
                             q.status === 'SENT' ? 'Đã gửi' :
                             q.status === 'ACCEPTED' ? 'Đã duyệt' :
                             q.status === 'DRAFT' ? 'Bản nháp' : 'Hủy bỏ'}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground capitalize">{q.creator.username}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Link
                              href={`/quotations/${q.id}`}
                              className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Xem chi tiết & In"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {['DRAFT', 'SENT'].includes(q.status) && (
                              <Link
                                href={`/quotations/${q.id}#edit`}
                                className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Chỉnh sửa báo giá"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                            )}
                            {q.status !== 'CONVERTED' && (
                              <button
                                onClick={() => handleConvert(q.id)}
                                className="rounded p-1 hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-600 cursor-pointer"
                                title="Chuyển thành Hóa đơn"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                            {q.status === 'DRAFT' && (
                              <button
                                onClick={() => handleDelete(q.id)}
                                className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Xóa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                  );
                })
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
