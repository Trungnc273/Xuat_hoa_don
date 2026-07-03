import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { loginSchema } from '@/server/validators/catalog';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { comparePassword, signJWT } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = loginSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ tài khoản và mật khẩu' },
        { status: 400 }
      );
    }

    // Tìm người dùng trong DB kèm vai trò của họ
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // So sánh mật khẩu
    const isPasswordMatch = await comparePassword(password, user.password);
    if (!isPasswordMatch) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // Ký JWT
    const token = signJWT({
      userId: user.id,
      username: user.username,
      role: user.role.name,
    });

    // Thiết lập cookie HttpOnly
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
      path: '/',
    });

    // Ghi nhận nhật ký đăng nhập
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        username: user.username,
        action: 'LOGIN',
        details: `Người dùng ${user.username} đăng nhập thành công.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (error: any) {
    return handleError('API Đăng nhập', error);
  }
}
