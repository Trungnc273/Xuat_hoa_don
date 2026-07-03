import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Xác minh JWT HS256 bằng WebCrypto (chạy được trong edge runtime của proxy,
 * không cần thư viện ngoài — SPEC GĐ3, FR-4). Kiểm tra chữ ký + hạn dùng (exp).
 */
async function verifyJwtHs256(token: string, secret: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // base64url → bytes
    const b64urlToBytes = (s: string) => {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
      return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    };

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(signatureB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Các trang không yêu cầu đăng nhập (xác thực)
  // /register đã đóng công khai (SPEC GĐ3, FR-2) — Admin tạo tài khoản trong dashboard
  const isAuthPage = pathname.startsWith('/login') ||
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

  // Token giả/hết hạn bị đối xử như chưa đăng nhập (SPEC GĐ3, FR-4).
  // API route vẫn tự verify riêng (verifyAuth) — đây là lớp chặn cho trang UI.
  const secret = process.env.JWT_SECRET || '';
  const isLoggedIn = token && secret ? await verifyJwtHs256(token, secret) : false;

  // Nếu chưa đăng nhập và cố gắng truy cập trang Dashboard
  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    // Lưu lại trang muốn truy cập để sau khi đăng nhập chuyển hướng ngược lại
    loginUrl.searchParams.set('callbackUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    // Dọn cookie hỏng để không lặp vòng redirect
    if (token) response.cookies.delete('token');
    return response;
  }

  // Nếu đã đăng nhập mà cố truy cập trang login
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Cấu hình phạm vi áp dụng proxy
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
