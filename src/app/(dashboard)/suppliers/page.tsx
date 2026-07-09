'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { 
  Plus, Search, Edit, Trash2, X, Eye, 
  User, Building2, Phone, Mail,
  AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

interface Supplier {
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

interface SupplierPayment {
  id: string;
  code: string;
  date: string;
  amount: number;
  paymentMethod: string;
}

interface SupplierDetail {
  supplier: Supplier & {
    payments: SupplierPayment[];
  };
  summary: {
    totalPaid: number;
    totalPayments: number;
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Trạng thái Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<SupplierDetail | null>(null);
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

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`/api/suppliers?search=${search}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    queueMicrotask(() => void fetchSuppliers());
  }, [fetchSuppliers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    void fetchSuppliers();
  };

  const handleViewDetail = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`);
      if (res.ok) {
        const data = await res.json();
        setSupplierDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setName(supplier.name);
    setCompany(supplier.company || '');
    setTaxCode(supplier.taxCode || '');
    setAddress(supplier.address || '');
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setContactPerson(supplier.contactPerson || '');
    setNote(supplier.note || '');
    setIsEditOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, taxCode, address, email, phone, contactPerson, note }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddOpen(false);
        resetForm();
        fetchSuppliers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedSupplier) return;
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, taxCode, address, email, phone, contactPerson, note }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsEditOpen(false);
        setSelectedSupplier(null);
        resetForm();
        fetchSuppliers();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Đã xảy ra lỗi hệ thống');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhà cung cấp này?')) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        fetchSuppliers();
        if (selectedSupplier?.id === id) {
          setSelectedSupplier(null);
          setSupplierDetail(null);
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
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Quản lý Nhà cung cấp</h1>
          <p className="text-sm text-muted-foreground">Danh sách các đối tác, nhà cung cấp hàng hóa cho doanh nghiệp.</p>
        </div>
        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
          <button
            onClick={() => { resetForm(); setIsAddOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Thêm nhà cung cấp
          </button>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 left-3 h-full w-4 text-muted-foreground flex items-center" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã, MST, điện thoại..."
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

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* DANH SÁCH BẢNG NHÀ CUNG CẤP */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3">Mã số</th>
                  <th className="p-3">Tên đối tác</th>
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
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Không tìm thấy nhà cung cấp nào.</td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedSupplier?.id === s.id ? 'bg-muted/50' : ''}`}
                      onClick={() => handleViewDetail(s)}
                    >
                      <td className="p-3 font-bold text-foreground">{s.code}</td>
                      <td className="p-3 font-semibold text-foreground">{s.name}</td>
                      <td className="p-3 text-muted-foreground max-w-[150px] truncate">{s.company || '—'}</td>
                      <td className="p-3 text-muted-foreground">{s.phone || '—'}</td>
                      <td className="p-3 text-right flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewDetail(s)}
                          className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Sửa"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {['ADMIN', 'MANAGER'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleDelete(s.id)}
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

        {/* LỊCH SỬ CHI TIẾT */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5 h-fit">
          <h3 className="font-bold text-base border-b border-border pb-2 flex items-center gap-1.5">
            <User className="h-4.5 w-4.5 text-primary" />
            Lịch sử giao dịch chi tiết
          </h3>

          {!selectedSupplier ? (
            <div className="text-center py-12 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              Bấm vào tên nhà cung cấp để xem chi tiết lịch sử phiếu chi trả tiền.
            </div>
          ) : detailLoading ? (
            <div className="text-center py-12 text-xs text-muted-foreground">Đang tải lịch sử...</div>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h4 className="text-sm font-bold text-foreground">{selectedSupplier.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedSupplier.code}</p>
                <div className="mt-3 space-y-2 text-xs">
                  {selectedSupplier.company && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{selectedSupplier.company} (MST: {selectedSupplier.taxCode || 'N/A'})</span>
                    </div>
                  )}
                  {selectedSupplier.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{selectedSupplier.phone}</span>
                    </div>
                  )}
                  {selectedSupplier.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{selectedSupplier.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tóm tắt chi trả */}
              {supplierDetail && (
                <div className="rounded-xl bg-muted/40 p-3 border border-border space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Tài chính</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Đã thanh toán (Phiếu chi):</span>
                    <span className="font-extrabold text-emerald-500">{formatCurrency(supplierDetail.summary.totalPaid)}</span>
                  </div>
                </div>
              )}

              {/* Lịch sử phiếu chi gần nhất */}
              {supplierDetail && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Các phiếu chi tiền gần nhất</span>
                  {supplierDetail.supplier.payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Chưa lập phiếu chi nào cho nhà cung cấp này.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {supplierDetail.supplier.payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-xs border border-border/40 p-2 rounded-lg bg-card">
                          <div>
                            <p className="font-bold text-foreground">{p.code}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(p.date)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-destructive">-{formatCurrency(p.amount)}</p>
                            <span className="text-[9px] font-semibold text-muted-foreground">{p.paymentMethod}</span>
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

      {/* MODAL THÊM NHÀ CUNG CẤP */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Thêm nhà cung cấp mới</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tên nhà cung cấp *</label>
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
                <label className="block font-semibold mb-1">Địa chỉ</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground" />
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú thêm</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded border border-border p-2 focus:outline-none focus:border-foreground resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddOpen(false)} className="rounded px-4 py-2 border border-border text-foreground hover:bg-secondary cursor-pointer">Hủy</button>
                <button type="submit" className="rounded px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Lưu nhà cung cấp</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SỬA NHÀ CUNG CẤP */}
      {isEditOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Cập nhật thông tin nhà cung cấp</h3>
            {error && <div className="mb-3 text-xs font-semibold text-destructive">{error}</div>}
            
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tên nhà cung cấp *</label>
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
                <label className="block font-semibold mb-1">Địa chỉ</label>
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
