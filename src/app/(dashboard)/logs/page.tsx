'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Search, ShieldAlert,
  Clock, User, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Log {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { user } = useApp();

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/logs?search=${search}&page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      queueMicrotask(() => void fetchLogs());
    }
  }, [fetchLogs, user?.role]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    void fetchLogs();
  };

  const getActionColor = (action: string) => {
    if (action.startsWith('CREATE')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (action.startsWith('UPDATE')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (action.startsWith('DELETE')) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (action === 'LOGIN') return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (action === 'LOGOUT') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-secondary text-foreground border-border';
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'Đăng nhập';
      case 'LOGOUT': return 'Đăng xuất';
      case 'REGISTER': return 'Đăng ký';
      case 'CREATE_CUSTOMER': return 'Tạo Khách hàng';
      case 'UPDATE_CUSTOMER': return 'Sửa Khách hàng';
      case 'DELETE_CUSTOMER': return 'Xóa Khách hàng';
      case 'CREATE_SUPPLIER': return 'Tạo Nhà cung cấp';
      case 'UPDATE_SUPPLIER': return 'Sửa Nhà cung cấp';
      case 'DELETE_SUPPLIER': return 'Xóa Nhà cung cấp';
      case 'CREATE_PRODUCT': return 'Tạo Sản phẩm';
      case 'UPDATE_PRODUCT': return 'Sửa Sản phẩm';
      case 'DELETE_PRODUCT': return 'Xóa Sản phẩm';
      case 'IMPORT_PRODUCTS': return 'Nhập Excel SP';
      case 'CREATE_WAREHOUSE': return 'Tạo Nhà kho';
      case 'STOCK_ADJUSTMENT': return 'Điều chỉnh Kho';
      case 'CREATE_QUOTATION': return 'Lập Báo giá';
      case 'UPDATE_QUOTATION': return 'Sửa Báo giá';
      case 'DELETE_QUOTATION': return 'Xóa Báo giá';
      case 'CONVERT_QUOTATION_TO_INVOICE': return 'Chuyển Báo giá';
      case 'CREATE_INVOICE': return 'Xuất Hóa đơn';
      case 'UPDATE_INVOICE': return 'Sửa Hóa đơn';
      case 'DELETE_INVOICE': return 'Xóa Hóa đơn';
      case 'CREATE_RECEIPT': return 'Lập Phiếu thu';
      case 'CREATE_PAYMENT': return 'Lập Phiếu chi';
      case 'CREATE_EXPENSE': return 'Ghi Chi phí';
      case 'UPDATE_SETTINGS': return 'Cập nhật Cài đặt';
      default: return action;
    }
  };

  // Bảo vệ Router Frontend
  if (user?.role !== 'ADMIN') {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive max-w-md mx-auto">
        <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm font-bold">Truy cập bị từ chối</p>
        <p className="text-xs text-muted-foreground mt-1">Chỉ quản trị viên cấp cao (ADMIN) mới được quyền kiểm tra lịch sử thao tác hệ thống.</p>
        <Link href="/" className="text-xs font-semibold text-foreground underline mt-4 block">Quay lại trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* HEADER NHẬT KÝ */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Nhật ký Hoạt động Hệ thống</h1>
        <p className="text-sm text-muted-foreground">Theo dõi lịch sử truy cập, thay đổi thông tin dữ liệu thời gian thực của toàn bộ nhân viên.</p>
      </div>

      {/* THANH TÌM KIẾM */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
          <input
            type="text"
            placeholder="Tìm theo nhân viên, hành động, mô tả..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer border border-border"
        >
          Tìm kiếm
        </button>
      </form>

      {/* BẢNG NHẬT KÝ */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-3 w-40">Thời gian</th>
                <th className="p-3 w-32">Nhân viên</th>
                <th className="p-3 w-36">Hành động</th>
                <th className="p-3">Mô tả chi tiết</th>
                <th className="p-3 w-32">Địa chỉ IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">Đang tải nhật ký...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">Không có nhật ký hoạt động nào khớp bộ lọc.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-semibold text-foreground capitalize flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {log.username || 'Hệ thống'}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-foreground max-w-sm sm:max-w-md truncate" title={log.details || ''}>
                      {log.details || '—'}
                    </td>
                    <td className="p-3 text-muted-foreground font-mono">{log.ipAddress || '—'}</td>
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
