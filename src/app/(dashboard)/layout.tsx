'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { 
  LayoutDashboard, Users, Truck, ShoppingBag, Warehouse, 
  FileText, Receipt, Landmark, DollarSign, Settings, 
  History, LogOut, Menu, X, Sun, Moon, Bell, ChevronRight, 
  User as UserIcon, Sparkles 
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, theme, toggleTheme, loading } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();

  // Đóng menu di động khi chuyển trang
  useEffect(() => {
    setMobileSidebarOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Nếu đang tải thông tin user, hiện màn hình chờ
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background transition-colors duration-200">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Đang tải cấu hình hệ thống...</p>
        </div>
      </div>
    );
  }

  // Nếu không đăng nhập, middleware sẽ chuyển hướng, nhưng phòng hờ:
  if (!user) {
    return null;
  }

  // Danh sách menu điều hướng dựa trên vai trò
  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'] },
    { name: 'Khách hàng', path: '/customers', icon: Users, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'] },
    { name: 'Nhà cung cấp', path: '/suppliers', icon: Truck, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
    { name: 'Sản phẩm', path: '/products', icon: ShoppingBag, roles: ['ADMIN', 'MANAGER', 'STAFF', 'ACCOUNTANT'] },
    { name: 'Kho hàng', path: '/stock', icon: Warehouse, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Báo giá', path: '/quotations', icon: FileText, roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    { name: 'Hóa đơn', path: '/invoices', icon: Receipt, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'] },
    { name: 'Phiếu thu (Tiền vào)', path: '/receipts', icon: Landmark, roles: ['ADMIN', 'ACCOUNTANT'] },
    { name: 'Phiếu chi (Tiền ra)', path: '/payments', icon: DollarSign, roles: ['ADMIN', 'ACCOUNTANT'] },
    { name: 'Chi phí khác', path: '/expenses', icon: DollarSign, roles: ['ADMIN', 'ACCOUNTANT'] },
    { name: 'Công nợ', path: '/debts', icon: Landmark, roles: ['ADMIN', 'ACCOUNTANT'] },
    { name: 'Quản lý tài khoản', path: '/users', icon: UserIcon, roles: ['ADMIN'] },
    { name: 'Cấu hình doanh nghiệp', path: '/settings', icon: Settings, roles: ['ADMIN'] },
    { name: 'Nhật ký hệ thống', path: '/logs', icon: History, roles: ['ADMIN'] },
  ];

  // Lọc menu hiển thị
  const filteredNavItems = navItems.filter((item) => item.roles.includes(user.role));

  // Tạo breadcrumbs hiển thị vị trí trang hiện tại
  const getBreadcrumbs = () => {
    if (pathname === '/') return [{ name: 'Tổng quan', path: '/' }];
    
    const parts = pathname.split('/').filter(Boolean);
    const crumbs = [{ name: 'Tổng quan', path: '/' }];
    
    let currentPath = '';
    parts.forEach((part) => {
      currentPath += `/${part}`;
      // Tìm nhãn tương ứng với path
      const matchedItem = navItems.find(item => item.path === currentPath);
      let name = part;
      
      if (matchedItem) {
        name = matchedItem.name;
      } else if (part === 'new') {
        name = 'Lập mới';
      } else if (part.length > 20) {
        name = 'Chi tiết';
      }

      crumbs.push({ name, path: currentPath });
    });
    
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      
      {/* SIDEBAR TRÊN DESKTOP */}
      <aside 
        className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Header của Sidebar */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-lg tracking-tight select-none">Web Hóa Đơn</span>
            )}
          </Link>
        </div>

        {/* Danh sách Menu */}
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer của Sidebar */}
        <div className="p-4 border-t border-border bg-muted/30">
          <button
            onClick={logout}
            className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
          >
            <LogOut className={`h-5 w-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
            {sidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR (Drawer overlay) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-background/80 backdrop-blur-sm">
          <div className="relative flex w-64 flex-col border-r border-border bg-card p-4 animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-secondary cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-12 items-center mb-6">
              <Link href="/" className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <span className="font-bold text-base tracking-tight">Web Hóa Đơn</span>
              </Link>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-border">
              <button
                onClick={logout}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VÙNG NỘI DUNG CHÍNH (Bao gồm Top Navbar + Page body) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center space-x-3">
            {/* Nút Hamburger bật Sidebar ở Mobile */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-md p-1.5 hover:bg-secondary md:hidden text-muted-foreground cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* Nút co giãn Sidebar trên Desktop */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex rounded-md p-1.5 hover:bg-secondary text-muted-foreground cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* BREADCRUMBS */}
            <nav className="hidden sm:flex items-center space-x-1 text-sm font-medium text-muted-foreground">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="text-foreground font-semibold">{crumb.name}</span>
                  ) : (
                    <Link href={crumb.path} className="hover:text-foreground transition-all">
                      {crumb.name}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* CÁC PHÍM CHỨC NĂNG PHÍA BÊN PHẢI */}
          <div className="flex items-center space-x-2">
            
            {/* Đổi Theme Dark/Light */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 hover:bg-secondary text-muted-foreground transition-all cursor-pointer"
              title="Đổi chủ đề sáng/tối"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Khung Thông báo */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative rounded-lg p-2 hover:bg-secondary text-muted-foreground transition-all cursor-pointer"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-xl z-50 animate-in fade-in-50 slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                    <span className="font-bold text-sm">Thông báo hệ thống</span>
                    <span className="text-xs text-muted-foreground hover:underline cursor-pointer">Đánh dấu đã đọc</span>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    <div className="flex items-start gap-2.5 text-xs pb-2 border-b border-border/50">
                      <span className="h-2 w-2 rounded-full bg-destructive mt-1.5"></span>
                      <div>
                        <p className="font-bold text-foreground">Hóa đơn quá hạn</p>
                        <p className="text-muted-foreground mt-0.5">Khách hàng Trần Minh Hoàng (HD000002) đã quá hạn thanh toán 5 ngày.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">2 phút trước</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs pb-2 border-b border-border/50">
                      <span className="h-2 w-2 rounded-full bg-amber-400 mt-1.5"></span>
                      <div>
                        <p className="font-bold text-foreground">Cảnh báo tồn kho</p>
                        <p className="text-muted-foreground mt-0.5">Laptop Dell Latitude 5520 i5 (SP000001) sắp hết hàng (Còn 15 chiếc).</p>
                        <p className="text-[10px] text-muted-foreground mt-1">1 giờ trước</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Menu User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-secondary text-muted-foreground transition-all cursor-pointer"
              >
                <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                  <UserIcon className="h-4.5 w-4.5" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-foreground capitalize leading-none">{user.username}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold leading-none mt-1">{user.role}</p>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-2 shadow-xl z-50 animate-in fade-in-50 slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-border text-xs mb-1">
                    <p className="font-bold text-foreground">Xin chào, {user.username}</p>
                    <p className="text-muted-foreground truncate mt-0.5">{user.email}</p>
                  </div>
                  <button
                    onClick={() => router.push('/settings')}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Cấu hình
                  </button>
                  <button
                    onClick={logout}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-all cursor-pointer mt-1"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* PHẦN HIỂN THỊ NỘI DUNG TRANG CON */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 transition-colors duration-200">
          {children}
        </main>
      </div>

    </div>
  );
}
