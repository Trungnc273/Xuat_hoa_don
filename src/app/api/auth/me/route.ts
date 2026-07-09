import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Tìm người dùng trong database kèm vai trò và danh sách quyền hạn
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    action: true,
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      const response = NextResponse.json(
        { error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' },
        { status: 401 }
      );
      response.cookies.delete('token');
      return response;
    }

    // Biến đổi danh sách quyền phẳng cho dễ kiểm tra trên Frontend
    // Ví dụ: ["CREATE_Customer", "READ_Customer", "ALL_Product"]
    const permissions = user.role.permissions.map(
      (rp) => `${rp.permission.action}_${rp.permission.subject}`
    );

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role.name,
        permissions,
      },
    });
  } catch (error) {
    console.error('Lỗi API /api/auth/me:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
