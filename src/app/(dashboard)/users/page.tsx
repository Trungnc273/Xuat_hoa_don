'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/utils';
import { UserPlus, KeyRound, ShieldCheck, X, Loader2 } from 'lucide-react';

type UserRow = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  role: { name: string; description?: string | null };
};

const ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'] as const;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  ACCOUNTANT: 'Kế toán',
  STAFF: 'Nhân viên',
};

export default function UsersPage() {
  const { user: currentUser } = useApp();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Form tạo tài khoản
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', roleName: 'STAFF' });

  // Đặt lại mật khẩu
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không tải được danh sách');
      setUsers(data.users);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadUsers());
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Tạo tài khoản thất bại');
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', roleName: 'STAFF' });
      flash(`Đã tạo tài khoản ${data.user.username} (${ROLE_LABELS[data.user.role.name]})`);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async (target: UserRow, roleName: string) => {
    if (roleName === target.role.name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đổi vai trò thất bại');
      flash(`Đã đổi vai trò ${target.username} thành ${ROLE_LABELS[roleName]}`);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${resetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Đặt lại mật khẩu thất bại');
      flash(`Đã đặt lại mật khẩu cho ${resetTarget.username}`);
      setResetTarget(null);
      setResetPassword('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" /> Quản lý tài khoản
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo tài khoản nhân viên, phân vai trò và đặt lại mật khẩu. Chỉ Quản trị viên truy cập được.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all"
        >
          <UserPlus className="h-4 w-4" /> Tạo tài khoản
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Tài khoản</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Đang tải...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-all">
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">bạn</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role.name}
                      disabled={saving || u.id === currentUser?.id}
                      onChange={(e) => handleChangeRole(u, e.target.value)}
                      title={u.id === currentUser?.id ? 'Không thể tự đổi vai trò của chính mình' : 'Đổi vai trò'}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setResetTarget(u); setResetPassword(''); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-all"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Đặt lại mật khẩu
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal tạo tài khoản */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Tạo tài khoản mới</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input required minLength={3} placeholder="Tên tài khoản" className={inputCls}
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <input required type="email" placeholder="Email" className={inputCls}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input required type="password" minLength={6} placeholder="Mật khẩu (tối thiểu 6 ký tự)" className={inputCls}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <select className={inputCls} value={form.roleName}
                onChange={(e) => setForm({ ...form, roleName: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button type="submit" disabled={creating}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all">
                {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal đặt lại mật khẩu */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Đặt lại mật khẩu — {resetTarget.username}</h2>
              <button onClick={() => setResetTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input required type="password" minLength={6} placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" className={inputCls}
                value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoFocus />
              <button type="submit" disabled={saving}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all">
                {saving ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
