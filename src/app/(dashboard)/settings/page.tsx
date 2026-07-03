'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Settings, Building2, Upload, Save, 
  Landmark, User, ShieldAlert, Sparkles, 
  Mail, Phone, Globe, CheckCircle2, AlertCircle, X
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function SettingsPage() {
  const [logo, setLogo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [representative, setRepresentative] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { user } = useApp();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.setting;
        if (s) {
          setLogo(s.logo || '');
          setCompanyName(s.companyName || '');
          setTaxCode(s.taxCode || '');
          setAddress(s.address || '');
          setEmail(s.email || '');
          setPhone(s.phone || '');
          setWebsite(s.website || '');
          setBankAccount(s.bankAccount || '');
          setRepresentative(s.representative || '');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Xử lý upload logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setLogo(data.url);
        setSuccessMsg('Tải ảnh logo lên thành công! Bấm Lưu để hoàn tất cấu hình.');
      } else {
        setErrorMsg(data.error || 'Có lỗi xảy ra khi tải logo');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ');
    } finally {
      setUploading(false);
    }
  };

  // Submit Lưu cấu hình
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo,
          companyName,
          taxCode,
          address,
          email,
          phone,
          website,
          bankAccount,
          representative,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Cập nhật cấu hình doanh nghiệp thành công!');
        fetchSettings();
      } else {
        setErrorMsg(data.error || 'Lỗi khi cập nhật cài đặt');
      }
    } catch (err) {
      setErrorMsg('Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Đang tải cài đặt doanh nghiệp...</p>
        </div>
      </div>
    );
  }

  // Phân quyền: Chỉ ADMIN được vào trang này
  if (user?.role !== 'ADMIN') {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive max-w-md mx-auto">
        <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
        <p className="text-sm font-bold">Truy cập bị từ chối</p>
        <p className="text-xs text-muted-foreground mt-1">Chỉ quản trị viên cấp cao (ADMIN) mới có quyền chỉnh sửa cấu hình công ty.</p>
        <Link href="/" className="text-xs font-semibold text-foreground underline mt-4 block">Quay lại trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      
      {/* HEADER CẤU HÌNH */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cấu hình Doanh nghiệp</h1>
        <p className="text-sm text-muted-foreground">Thiết lập hồ sơ tổ chức, mã số thuế, đại diện pháp lý và tài khoản ngân hàng để tự sinh QR thanh toán.</p>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20 flex items-center gap-2">
          <CheckCircle2 className="h-4.5 w-4.5" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg bg-destructive/10 p-3.5 text-xs font-semibold text-destructive border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* HỒ SƠ DOANH NGHIỆP */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold border-b border-border pb-2 flex items-center gap-1.5 text-foreground">
            <Building2 className="h-4.5 w-4.5 text-primary" />
            Hồ sơ pháp lý doanh nghiệp
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Tên công ty / Tổ chức *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Mã số thuế (MST)</label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                className="w-full rounded-lg border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Địa chỉ trụ sở chính</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Số điện thoại liên hệ</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 bg-transparent focus:outline-none focus:border-foreground"
                />
              </div>
            </div>
            
            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Địa chỉ Email</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 bg-transparent focus:outline-none focus:border-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Trang web (Website)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 bg-transparent focus:outline-none focus:border-foreground"
                  placeholder="https://company.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* TÀI KHOẢN NGÂN HÀNG & PHÁP LÝ */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold border-b border-border pb-2 flex items-center gap-1.5 text-foreground">
            <Landmark className="h-4.5 w-4.5 text-primary" />
            Tài khoản nhận tiền (Tạo VietQR) & Ký số
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Cấu hình tài khoản ngân hàng *</label>
              <input
                type="text"
                required
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="w-full rounded-lg border border-border p-2.5 bg-transparent focus:outline-none focus:border-foreground font-mono"
                placeholder="VCB - 1012999999 - NGUYEN VAN A"
              />
              <span className="text-[9px] text-muted-foreground mt-1.5 block leading-normal">
                Bắt buộc nhập đúng định dạng: <code className="bg-secondary px-1 py-0.5 rounded font-mono font-bold text-foreground">BIN_NHOM_NH - STK - CHU_THE</code> để VietQR có thể tạo. Ví dụ: <code className="bg-secondary px-1 py-0.5 rounded font-mono text-foreground font-bold">VCB - 1012999999 - CONG TY SOLTECH</code>
              </span>
            </div>
            <div>
              <label className="block font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Người đại diện & Chức vụ</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  className="w-full rounded-lg border border-border py-2.5 pl-9 pr-3 bg-transparent focus:outline-none focus:border-foreground"
                  placeholder="e.g. Nguyễn Văn A - Giám đốc"
                />
              </div>
              <span className="text-[9px] text-muted-foreground mt-1.5 block leading-normal">Chữ ký đại diện tự động in ở chân trang báo giá/hóa đơn bán lẻ.</span>
            </div>
          </div>
        </div>

        {/* LOGO DOANH NGHIỆP */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4 text-xs">
          <h3 className="text-sm font-bold border-b border-border pb-2 flex items-center gap-1.5 text-foreground">
            <Settings className="h-4.5 w-4.5 text-primary" />
            Hình ảnh Logo doanh nghiệp
          </h3>

          <div className="flex flex-col sm:flex-row gap-6 items-center">
            {logo ? (
              <div className="relative h-28 w-28 rounded-2xl border border-border overflow-hidden bg-muted flex items-center justify-center p-2 bg-white">
                <img src={logo} alt="Company Logo Preview" className="max-h-full max-w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setLogo('')}
                  className="absolute top-1.5 right-1.5 rounded-full p-1 bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="h-28 w-28 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                <Building2 className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-[9px] mt-1">Chưa có logo</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 rounded-lg bg-secondary hover:bg-muted border border-border px-3.5 py-2 text-xs font-bold text-foreground cursor-pointer w-fit transition-all active:scale-95">
                {uploading ? (
                  <span>Đang tải lên...</span>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Tải logo mới lên
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              <p className="text-[9px] text-muted-foreground leading-normal max-w-sm">Hỗ trợ các file định dạng ảnh JPG, PNG, WebP. Kích thước khuyến nghị dạng ngang tỉ lệ 4:1 để in hóa đơn đẹp nhất.</p>
            </div>
          </div>
        </div>

        {/* NÚT LƯU TOÀN BỘ CẤU HÌNH */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-md"
          >
            <Save className="h-4.5 w-4.5" />
            {submitting ? 'Đang lưu cài đặt...' : 'Lưu toàn bộ cài đặt'}
          </button>
        </div>

      </form>

    </div>
  );
}
