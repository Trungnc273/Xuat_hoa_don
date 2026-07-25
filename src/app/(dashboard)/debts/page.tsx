'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle, Clock, ChevronDown, ChevronRight,
  TrendingDown, TrendingUp
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Receivable {
  id: string;
  invoiceCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  company: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  isOverdue: boolean;
  overdueDays: number;
}

interface Payable {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  company: string;
  totalPaid: number;
}

interface Summary {
  totalReceivables: number;
  totalOverdue: number;
  totalPaidSuppliers: number;
  overdueAlertCount: number;
}

interface DebtData {
  receivables: Receivable[];
  payables: Payable[];
  summary: Summary;
}

export default function DebtsPage() {
  const [data, setData] = useState<DebtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables'>('receivables');
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());

  const fetchDebtData = async () => {
    try {
      const res = await fetch('/api/debts');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void fetchDebtData());
  }, []);

  // Gộp hóa đơn còn nợ theo khách hàng — cùng khuôn với danh sách Hóa đơn/Báo giá để nhất quán trải nghiệm
  const groupedReceivables = useMemo(() => {
    const groups = new Map<string, {
      customerId: string;
      customerName: string;
      company: string;
      invoices: Receivable[];
      total: number;
      remaining: number;
      hasOverdue: boolean;
    }>();

    (data?.receivables || []).forEach((r) => {
      const currentGroup = groups.get(r.customerId);
      if (currentGroup) {
        currentGroup.invoices.push(r);
        currentGroup.total += r.amount;
        currentGroup.remaining += r.remainingAmount;
        currentGroup.hasOverdue = currentGroup.hasOverdue || r.isOverdue;
        return;
      }

      groups.set(r.customerId, {
        customerId: r.customerId,
        customerName: r.customerName,
        company: r.company,
        invoices: [r],
        total: r.amount,
        remaining: r.remainingAmount,
        hasOverdue: r.isOverdue,
      });
    });

    return Array.from(groups.values());
  }, [data?.receivables]);

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

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground font-semibold">Đang tổng hợp đối chiếu công nợ...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border p-8 text-center text-muted-foreground bg-card">
        Không thể tải dữ liệu công nợ. Vui lòng chạy dữ liệu mẫu và kết nối CSDL.
      </div>
    );
  }

  const { receivables, payables, summary } = data;

  return (
    <div className="space-y-6">
      
      {/* HEADER BÁO CÁO */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Đối chiếu & Quản lý Công nợ</h1>
        <p className="text-sm text-muted-foreground">Theo dõi các khoản tiền chưa thu của khách hàng, nợ quá hạn và lịch sử trả tiền nhà cung cấp.</p>
      </div>

      {/* THẺ KPI CÔNG NỢ */}
      <div className="grid gap-4 sm:grid-cols-3">
        
        {/* Tổng phải thu khách hàng */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-start gap-4">
          <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Nợ phải thu khách hàng</span>
            <h3 className="text-xl font-extrabold text-foreground mt-1.5">{formatCurrency(summary.totalReceivables)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Từ tất cả các hóa đơn đang treo</p>
          </div>
        </div>

        {/* Nợ quá hạn trễ hạn */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-start gap-4">
          <div className="rounded-lg bg-destructive/10 p-2.5 text-destructive">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Nợ quá hạn cần thu hồi</span>
            <h3 className="text-xl font-extrabold text-destructive mt-1.5">{formatCurrency(summary.totalOverdue)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Đã quá ngày hạn định (Cảnh báo: {summary.overdueAlertCount} đơn)</p>
          </div>
        </div>

        {/* Tổng chi trả NCC */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-start gap-4">
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Đã thanh toán Nhà cung cấp</span>
            <h3 className="text-xl font-extrabold text-foreground mt-1.5">{formatCurrency(summary.totalPaidSuppliers)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tổng số tiền mặt/chuyển khoản đã chi</p>
          </div>
        </div>

      </div>

      {/* CHUYỂN TABS PHẢI THU / PHẢI TRẢ */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('receivables')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'receivables' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Phải thu Khách hàng ({receivables.length})
          </button>
          <button
            onClick={() => setActiveTab('payables')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'payables' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Nợ Nhà cung cấp ({payables.length})
          </button>
        </div>
      </div>

      {/* HIỂN THỊ DỮ LIỆU TAB TƯƠNG ỨNG */}
      {activeTab === 'receivables' ? (
        
        /* BẢNG CÔNG NỢ KHÁCH HÀNG (PHẢI THU) — GỘP THEO KHÁCH HÀNG */
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3">Hóa đơn nợ</th>
                  <th className="p-3">Giá trị đơn</th>
                  <th className="p-3 text-emerald-500">Đã trả</th>
                  <th className="p-3 text-destructive">Còn nợ</th>
                  <th className="p-3">Ngày đến hạn</th>
                  <th className="p-3">Cảnh báo trễ hạn</th>
                  <th className="p-3 text-right">Chức năng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {groupedReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">Tuyệt vời! Không có hóa đơn nào nợ tiền.</td>
                  </tr>
                ) : (
                  groupedReceivables.map((group) => {
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
                                {group.customerName}
                                {group.company && <span className="ml-2 text-[10px] font-semibold text-muted-foreground">{group.company}</span>}
                              </span>
                              {group.hasOverdue && (
                                <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">
                                  <Clock className="h-3 w-3" />
                                  Có nợ quá hạn
                                </span>
                              )}
                            </span>
                            <span className="pl-6 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:pl-0">
                              {group.invoices.length} hóa đơn - Tổng {formatCurrency(group.total)}
                              {group.remaining > 0 && <span className="text-destructive"> · Còn nợ {formatCurrency(group.remaining)}</span>}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {isExpanded && group.invoices.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 pl-8 font-bold text-foreground">
                            <Link href={`/invoices/${r.id}`} className="hover:underline">{r.invoiceCode}</Link>
                          </td>
                          <td className="p-3 font-semibold text-muted-foreground">{formatCurrency(r.amount)}</td>
                          <td className="p-3 text-emerald-500 font-semibold">{formatCurrency(r.paidAmount)}</td>
                          <td className="p-3 text-destructive font-extrabold">{formatCurrency(r.remainingAmount)}</td>
                          <td className="p-3 text-muted-foreground">{formatDate(r.dueDate)}</td>
                          <td className="p-3">
                            {r.isOverdue ? (
                              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">
                                <Clock className="h-3 w-3" />
                                Quá hạn {r.overdueDays} ngày
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
                                <CheckCircle className="h-3 w-3" />
                                Trong hạn
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Link
                                href={`/invoices/${r.id}`}
                                className="rounded px-2.5 py-1.5 bg-secondary hover:bg-muted font-bold text-[10px] text-foreground border border-border cursor-pointer flex items-center gap-0.5"
                              >
                                Thu nợ nhanh
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
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
        </div>

      ) : (
        
        /* BẢNG CÔNG NỢ NHÀ CUNG CẤP */
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3">Mã đối tác</th>
                  <th className="p-3">Nhà cung cấp</th>
                  <th className="p-3">Công ty</th>
                  <th className="p-3">Tổng tiền đã chi trả</th>
                  <th className="p-3 text-right">Chức năng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Chưa có giao dịch thanh toán nhà cung cấp nào.</td>
                  </tr>
                ) : (
                  payables.map((p) => (
                    <tr key={p.supplierId} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-bold text-foreground">{p.supplierCode}</td>
                      <td className="p-3 font-semibold text-foreground">{p.supplierName}</td>
                      <td className="p-3 text-muted-foreground">{p.company || '—'}</td>
                      <td className="p-3 font-extrabold text-foreground">{formatCurrency(p.totalPaid)}</td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/suppliers`}
                          className="rounded px-2.5 py-1.5 bg-secondary hover:bg-muted font-bold text-[10px] text-foreground border border-border cursor-pointer inline-block"
                        >
                          Chi tiết đối tác
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      )}

    </div>
  );
}
