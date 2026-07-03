'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Moon, Sun, User, Mail, Lock, Shield } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('STAFF');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { theme, toggleTheme } = useApp();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, roleName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra khi đăng ký');
      } else {
        setSuccess('Đăng ký tài khoản thành công! Đang chuyển hướng...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch (err) {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-200">
      
      {/* Nút bật/tắt Dark Mode góc trên bên phải */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 hover:bg-secondary text-muted-foreground transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:scale-105">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-foreground">
            Đăng ký tài khoản mới
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Tạo tài khoản để bắt đầu trải nghiệm hệ thống quản lý
          </p>
        </div>

        <div className="bg-card border border-border p-8 rounded-2xl shadow-xl space-y-6 transition-colors duration-200">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500 border border-emerald-500/20 font-medium">
              {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Tên đăng nhập
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-transparent py-2 pl-10 pr-3 text-sm placeholder-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
                  placeholder="Nhập tên đăng nhập"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Địa chỉ Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-transparent py-2 pl-10 pr-3 text-sm placeholder-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
                  placeholder="username@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-transparent py-2 pl-10 pr-3 text-sm placeholder-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Vai trò (Phân quyền thử nghiệm)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                </span>
                <select
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-transparent py-2 pl-10 pr-3 text-sm focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors appearance-none cursor-pointer"
                >
                  <option value="STAFF" className="bg-background text-foreground">Nhân viên kinh doanh (STAFF)</option>
                  <option value="ACCOUNTANT" className="bg-background text-foreground">Kế toán (ACCOUNTANT)</option>
                  <option value="MANAGER" className="bg-background text-foreground">Quản lý (MANAGER)</option>
                  <option value="ADMIN" className="bg-background text-foreground">Quản trị viên (ADMIN)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {submitting ? 'Đang khởi tạo...' : 'Đăng ký tài khoản'}
            </button>
          </form>

          <div className="border-t border-border pt-4 text-center">
            <span className="text-sm text-muted-foreground">Bạn đã có tài khoản? </span>
            <Link
              href="/login"
              className="text-sm font-bold text-foreground hover:underline transition-all"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
