import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Các trang không yêu cầu đăng nhập (xác thực)
  const isAuthPage = pathname.startsWith('/login') || 
                     pathname.startsWith('/register') || 
                     pathname.startsWith('/forgot-password') || 
                     pathname.startsWith('/reset-password');

  // Bỏ qua các file tĩnh, API và asset
  const isStaticOrApi = pathname.startsWith('/_next') || 
                         pathname.startsWith('/api') || 
                         pathname.includes('/logo') || 
                         pathname.includes('/favicon.ico');

  if (isStaticOrApi) {
    return NextResponse.next();
  }

  // Nếu chưa đăng nhập và cố gắng truy cập trang Dashboard
  if (!token && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    // Lưu lại trang muốn truy cập để sau khi đăng nhập chuyển hướng ngược lại
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Nếu đã đăng nhập mà cố truy cập trang login/register
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Cấu hình phạm vi áp dụng middleware
export const config = {
  matcher: [
    /*
     * Áp dụng cho tất cả các request ngoại trừ:
     * - api (các tuyến API)
     * - _next/static (các tệp tĩnh)
     * - _next/image (tối ưu hóa hình ảnh)
     * - favicon.ico (icon trình duyệt)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
