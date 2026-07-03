import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Thiếu secret = mọi token có thể bị giả mạo. Từ chối chạy thay vì âm thầm dùng giá trị mặc định.
  throw new Error('Thiếu biến môi trường JWT_SECRET — xem HUONG-DAN-CAI-DAT.md mục 1.');
}

/**
 * Băm mật khẩu người dùng
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Kiểm tra mật khẩu có khớp hay không
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Ký mã thông báo JWT
 */
export function signJWT(payload: { userId: string; username: string; role: string }): string {
  // Token có hiệu lực trong 7 ngày
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Xác minh mã thông báo JWT
 */
export function verifyJWT(token: string): { userId: string; username: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
    return decoded ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * Xác thực yêu cầu HTTP (API Route)
 * Đọc JWT token từ header Authorization (Bearer <token>) hoặc Cookie
 */
export async function verifyAuth(req: Request): Promise<{ userId: string; username: string; role: string } | null> {
  try {
    // 1. Kiểm tra header Authorization
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyJWT(token);
      if (decoded) return decoded;
    }

    // 2. Kiểm tra Cookie (dùng cho Next.js Client requests)
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => c.trim().split('='))
      );
      const token = cookies['token'];
      if (token) {
        const decoded = verifyJWT(token);
        if (decoded) return decoded;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}
