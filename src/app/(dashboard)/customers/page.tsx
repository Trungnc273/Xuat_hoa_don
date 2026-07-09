'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { 
  Plus, Search, Edit, Trash2, X, Eye, 
  User, Building2, Phone, Mail,
  AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Customer {
  id: string;
  code: string;
  name: string;
  company: string | null;
  taxCode: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  note: string | null;
  createdAt: string;
}

interface CustomerInvoice {
  id: string;
  code: string;
  date: string;
  total: number;
  status: string;
}

interface CustomerDetail {
  customer: Customer & {
    invoices: CustomerInvoice[];
  };
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingDebt: number;
    totalQuotations: number;
    totalInvoices: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Trạng thái Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [note, setNote] = useState('');

  const { user } = useApp();

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers?search=${search}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    queueMicrotask(() => void fetchCustomers());
  }, [fetchCustomers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    void fetchCustomers();
  };

  // Xem chi tiết khách hàng và lịch sử mua hàng
  const handleViewDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Mở modal Sửa
  const handleOpenEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setName(customer.name);
    setCompany(customer.company || '');
    setTaxCode(customer.taxCode || '');
    setAddress(customer.address || '');
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setContactPerson(customer.contactPerson || '');
    setNote(customer.note || '');
    setIsEditOpen(true);
  };

  // Submit Thêm Khách hàng
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, taxCode, address, email, phone, contactPerson, note }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddOpen(false);
        resetForm();
        fetchCustomers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    }
  };

  // Submit Sửa Khách hàng
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedCustomer) return;
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, taxCode, address, email, phone, contactPerson, note }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsEditOpen(false);
        setSelectedCustomer(null);
        resetForm();
        fetchCustomers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    }
  };

  // Xóa Khách hàng
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) return;
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        fetchCustomers();
        if (selectedCustomer?.id === id) {
          setSelectedCustomer(null);
          setCustomerDetail(null);
        }
      } else {
        alert(data.error);
      }
    } catch {
      alert('Không thể thực hiện xóa');
    }
  };

  const resetForm = () => {
    setName('');
    setCompany('');
    setTaxCode('');
    setAddress('');
    setEmail('');
    setPhone('');
    setContactPerson('');
    setNote('');
    setError('');
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER VÀ NÚT THÊM MỚI */}
      <div className="flex flex-col items-start gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Quản lý Khách hàng</h1>
          <p className="text-sm text-muted-foreground">Xem, thêm, sửa thông tin khách hàng và xem lịch sử giao dịch mua hàng.</p>
        </div>
        {['ADMIN', 'MANAGER', 'STAFF'].includes(user?.role || '') && (
          <button
            onClick={() => { resetForm(); setIsAddOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Thêm khách hàng
          </button>
        )}
      </div>

      {/* THANH TÌM KIẾM */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã, công ty, điện thoại..."
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

      {/* GRID CHÍNH: BẢNG KHÁCH HÀNG & BẢNG CHI TIẾT LỊCH SỬ BÊN PHẢI */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* DANH SÁCH BẢNG KHÁCH HÀNG */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3">Mã số</th>
                  <th className="p-3">Tên khách hàng</th>
                  <th className="p-3">Công ty</th>
                  <th className="p-3">Điện thoại</th>
                  <th className="p-3 text-right">Chức năng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Đang tải danh sách...</td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Không tìm thấy khách hàng nào.</td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedCustomer?.id === c.id ? 'bg-muted/50' : ''}`}
                      onClick={() => handleViewDetail(c)}
                    >
                      <td className="p-3 font-bold text-foreground">{c.code}</td>
                      <td className="p-3 font-semibold text-foreground">{c.name}</td>
                      <td className="p-3 text-muted-foreground max-w-[150px] truncate">{c.company || '—'}</td>
                      <td className="p-3 text-muted-foreground">{c.phone || '—'}</td>
                      <td className="p-3 text-right flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewDetail(c)}
                          className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {['ADMIN', 'MANAGER', 'STAFF'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Sửa"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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

        {/* BẢNG LỊCH SỬ MUA HÀNG & CHI TIẾT (Notion panel style) */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5 h-fit">
          <h3 className="font-bold text-base border-b border-border pb-2 flex items-center gap-1.5">
            <User className="h-4.5 w-4.5 text-primary" />
            Lịch sử giao dịch chi tiết
          </h3>

          {!selectedCustomer ? (
            <div className="text-center py-12 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              Bấm vào tên khách hàng để xem chi tiết lý lịch mua hàng và dư nợ công nợ.
            </div>
          ) : detailLoading ? (
            <div className="text-center py-12 text-xs text-muted-foreground">Đang tải lịch sử...</div>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Profile nhanh */}
              <div>
                <h4 className="text-sm font-bold text-foreground capitalize">{selectedCustomer.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedCustomer.code}</p>
                <div className="mt-3 space-y-2 text-xs">
                  {selectedCustomer.company && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{selectedCustomer.company} (MST: {selectedCustomer.taxCode || 'N/A'})</span>
                    </div>
                  )}
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{selectedCustomer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tóm tắt Công nợ */}
              {customerDetail && (
                <div className="rounded-xl bg-muted/40 p-3 border border-border space-y-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tình hình công nợ</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Tổng mua:</p>
                      <p className="font-bold text-foreground mt-0.5">{formatCurrency(customerDetail.summary.totalInvoiced)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Đã thanh toán:</p>
                      <p className="font-bold text-emerald-500 mt-0.5">{formatCurrency(customerDetail.summary.totalPaid)}</p>
                    </div>
                  </div>
                  <div className="border-t border-border/70 pt-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">Dư nợ còn lại:</span>
                    <span className={`font-extrabold ${customerDetail.summary.outstandingDebt > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                      {formatCurrency(customerDetail.summary.outstandingDebt)}
                    </span>
                  </div>
                </div>
              )}

              {/* Lịch sử hóa đơn mua gần nhất */}
              {customerDetail && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Các hóa đơn gần nhất</span>
                  {customerDetail.customer.invoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Khách hàng chưa có hóa đơn nào.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {customerDetail.customer.invoices.map((inv) => (
                        <div key={inv.id} className="flex justify-between items-center text-xs border border-border/40 p-2 rounded-lg bg-card">
                          <div>
                            <p className="font-bold text-foreground">{inv.code}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(inv.date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(inv.total)}</p>
                            <span className={`text-[9px] font-bold ${
                              inv.status === 'PAID' ? 'text-emerald-500' : 'text-amber-500'
                            }`}>{inv.status === 'PAID' ? 'Đã thu' : 'Chưa thu'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>

      {/* MODAL THÊM KHÁCH HÀNG MỚI */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Thêm khách hàng mới</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tên khách hàng *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tên công ty</label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Mã số thuế (MST)</label>
                  <input type="text" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Điện thoại</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Người liên hệ chính</label>
                  <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Địa chỉ giao dịch</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú thêm</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Lưu khách hàng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SỬA KHÁCH HÀNG */}
      {isEditOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Cập nhật thông tin khách hàng</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tên khách hàng *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tên công ty</label>
                  <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Mã số thuế (MST)</label>
                  <input type="text" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Điện thoại</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Người liên hệ chính</label>
                  <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Địa chỉ giao dịch</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú thêm</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Cập nhật</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
