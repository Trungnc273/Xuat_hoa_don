'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Lock, User, Eye, EyeOff, Sparkles, Moon, Sun } from 'lucide-react';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, refreshUser, theme, toggleTheme } = useApp();
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  // Nếu người dùng đã đăng nhập sẵn, chuyển hướng thẳng vào Dashboard
  useEffect(() => {
    if (user) {
      router.push(callbackUrl);
    }
  }, [user, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra khi đăng nhập');
      } else {
        await refreshUser(); // Cập nhật trạng thái người dùng trong Context
        router.push(callbackUrl);
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
          {/* Logo đại diện dạng tối giản hiện đại */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:scale-105">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-foreground">
            Đăng nhập hệ thống
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Nhập tài khoản của bạn để quản lý doanh nghiệp
          </p>
        </div>

        <div className="bg-card border border-border p-8 rounded-2xl shadow-xl space-y-6 transition-colors duration-200">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 font-medium">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
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
                  className="block w-full rounded-lg border border-border bg-transparent py-2.5 pl-10 pr-3 text-sm placeholder-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
                  placeholder="admin, manager..."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-foreground">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-transparent py-2.5 pl-10 pr-10 text-sm placeholder-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="text-center text-xs text-muted-foreground pt-2">
            Mẫu chạy thử: <code className="bg-secondary px-1 py-0.5 rounded font-mono text-foreground">admin</code> / mật khẩu <code className="bg-secondary px-1 py-0.5 rounded font-mono text-foreground">admin123</code>
          </div>

          <div className="border-t border-border pt-4 text-center">
            <span className="text-sm text-muted-foreground">Bạn chưa có tài khoản? </span>
            <Link
              href="/register"
              className="text-sm font-bold text-foreground hover:underline transition-all"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background text-xs text-muted-foreground">
        Đang tải...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
