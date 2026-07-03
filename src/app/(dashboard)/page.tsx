'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { 
  TrendingUp, FileText, Users, ShoppingBag, 
  AlertTriangle, Receipt, CreditCard, ChevronRight,
  ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Counters {
  totalRevenue: number;
  totalInvoices: number;
  totalQuotations: number;
  totalCustomers: number;
  totalProducts: number;
  totalDebts: number;
  unpaidInvoicesCount: number;
}

interface ChartItem {
  name: string;
  revenue?: number;
  quantity?: number;
  total?: number;
}

interface DashboardData {
  counters: Counters;
  charts: {
    revenueByDay: ChartItem[];
    revenueByMonth: ChartItem[];
    revenueByYear: ChartItem[];
    topProducts: { name: string; quantity: number; revenue: number }[];
    topCustomers: { name: string; company: string; total: number }[];
  };
  recent: {
    invoices: any[];
    quotations: any[];
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'day' | 'month'>('day');
  const { user } = useApp();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Lỗi lấy dữ liệu dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground font-semibold">Đang chuẩn bị báo cáo tổng hợp...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border p-8 text-center text-muted-foreground bg-card">
        Không thể tải dữ liệu thống kê. Vui lòng kết nối cơ sở dữ liệu PostgreSQL.
      </div>
    );
  }

  const { counters, charts, recent } = data;

  const currentRevenueData = chartType === 'day' ? charts.revenueByDay : charts.revenueByMonth;

  return (
    <div className="space-y-6">
      
      {/* Lời chào chào đón người dùng */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan hệ thống</h1>
          <p className="text-sm text-muted-foreground">Xin chào {user?.username}, đây là hiệu suất kinh doanh của doanh nghiệp bạn.</p>
        </div>
        <div className="text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Dữ liệu đồng bộ thực tế từ PostgreSQL
        </div>
      </div>

      {/* CÁC THẺ KPI CHỈ SỐ CHÍNH */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Doanh thu */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tổng doanh thu</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500 group-hover:scale-105 transition-all">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold tracking-tight">{formatCurrency(counters.totalRevenue)}</h3>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-500 font-bold flex items-center">↑ 12%</span> so với tháng trước
            </p>
          </div>
        </div>

        {/* Hóa đơn */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hóa đơn đã xuất</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500 group-hover:scale-105 transition-all">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold tracking-tight">{counters.totalInvoices}</h3>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <span className="text-blue-500 font-bold">{counters.unpaidInvoicesCount} hóa đơn</span> chưa thanh toán
            </p>
          </div>
        </div>

        {/* Báo giá */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Yêu cầu báo giá</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500 group-hover:scale-105 transition-all">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold tracking-tight">{counters.totalQuotations}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tỷ lệ chốt đơn đạt <span className="text-purple-500 font-bold">64%</span>
            </p>
          </div>
        </div>

        {/* Công nợ phải thu */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Công nợ phải thu</span>
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive group-hover:scale-105 transition-all">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold tracking-tight text-destructive">{formatCurrency(counters.totalDebts)}</h3>
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              Cần thu hồi từ khách hàng
            </p>
          </div>
        </div>

      </div>

      {/* BIỂU ĐỒ DOANH THU CHÍNH */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h3 className="text-lg font-bold">Báo cáo doanh thu thực thu</h3>
            <p className="text-xs text-muted-foreground">Thống kê theo các phiếu thu đã xác nhận thanh toán thành công</p>
          </div>
          <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setChartType('day')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                chartType === 'day' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 ngày qua
            </button>
            <button
              onClick={() => setChartType('month')}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                chartType === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              12 tháng qua
            </button>
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={currentRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickFormatter={(value) => `${value / 1000000}M`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                formatter={(value: any) => [formatCurrency(value), 'Doanh thu']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '12px',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CHI TIẾT SẢN PHẨM BÁN CHẠY VÀ KHÁCH HÀNG */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Top 5 sản phẩm bán chạy nhất */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-4">Sản phẩm bán chạy nhất</h3>
            {charts.topProducts.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Chưa có giao dịch sản phẩm nào.</div>
            ) : (
              <div className="space-y-4">
                {charts.topProducts.map((p, idx) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs"
                        style={{ backgroundColor: `${COLORS[idx]}20`, color: COLORS[idx] }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold truncate max-w-[200px] sm:max-w-xs">{p.name}</p>
                        <p className="text-xs text-muted-foreground">Bán ra: {p.quantity} đơn vị</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top khách hàng doanh thu lớn nhất */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-4">Khách hàng mua nhiều nhất</h3>
            {charts.topCustomers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Chưa phát sinh hóa đơn khách hàng.</div>
            ) : (
              <div className="space-y-4">
                {charts.topCustomers.map((c, idx) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs"
                        style={{ backgroundColor: `${COLORS[idx + 1]}20`, color: COLORS[idx + 1] }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold truncate max-w-[200px] sm:max-w-xs">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.company}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* DANH SÁCH CHỨNG TỪ GẦN ĐÂY */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Hóa đơn gần đây */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Hóa đơn gần đây</h3>
            <Link href="/invoices" className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Xem tất cả <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground font-semibold">
                  <th className="py-2 pb-3">Mã số</th>
                  <th className="py-2 pb-3">Khách hàng</th>
                  <th className="py-2 pb-3">Thành tiền</th>
                  <th className="py-2 pb-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recent.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="py-2.5 font-bold text-foreground">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.code}</Link>
                    </td>
                    <td className="py-2.5 font-semibold text-muted-foreground truncate max-w-[120px]">{inv.customer.name}</td>
                    <td className="py-2.5 font-bold text-foreground">{formatCurrency(inv.total)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' :
                        inv.status === 'PARTIALLY_PAID' ? 'bg-blue-500/10 text-blue-500' :
                        inv.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {inv.status === 'PAID' ? 'Đã thu' :
                         inv.status === 'PARTIALLY_PAID' ? 'Thu 1 phần' :
                         inv.status === 'CANCELLED' ? 'Đã hủy' : 'Chưa thu'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Báo giá gần đây */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Báo giá gần đây</h3>
            <Link href="/quotations" className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              Xem tất cả <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground font-semibold">
                  <th className="py-2 pb-3">Mã số</th>
                  <th className="py-2 pb-3">Khách hàng</th>
                  <th className="py-2 pb-3">Tổng cộng</th>
                  <th className="py-2 pb-3 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recent.quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-muted/30">
                    <td className="py-2.5 font-bold text-foreground">
                      <Link href={`/quotations/${q.id}`} className="hover:underline">{q.code}</Link>
                    </td>
                    <td className="py-2.5 font-semibold text-muted-foreground truncate max-w-[120px]">{q.customer.name}</td>
                    <td className="py-2.5 font-bold text-foreground">{formatCurrency(q.total)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        q.status === 'CONVERTED' ? 'bg-emerald-500/10 text-emerald-500' :
                        q.status === 'SENT' ? 'bg-blue-500/10 text-blue-500' :
                        q.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {q.status === 'CONVERTED' ? 'Đã xuất HĐ' :
                         q.status === 'SENT' ? 'Đã gửi' :
                         q.status === 'DRAFT' ? 'Nháp' : 'Hủy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
