import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await verifyAuth(req);
    
    // Xóa cookie token
    const cookieStore = await cookies();
    cookieStore.delete('token');

    if (user) {
      // Ghi nhận nhật ký đăng xuất
      await prisma.activityLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: 'LOGOUT',
          details: `Người dùng ${user.username} đăng xuất thành công.`,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        },
      });
    }

    return NextResponse.json({ message: 'Đăng xuất thành công' });
  } catch (error) {
    console.error('Lỗi API Đăng xuất:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
