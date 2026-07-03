import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireAuth } from '@/server/auth';
import { handleError, fail } from '@/server/http';
import { logActivity } from '@/server/activity-log';
import { registerSchema } from '@/server/validators/catalog';

// 1. GET: Danh sách tài khoản (chỉ ADMIN — SPEC GĐ3, FR-1)
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        role: { select: { name: true, description: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return handleError('GET Users', error);
  }
}

// 2. POST: ADMIN tạo tài khoản nhân viên mới
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const { username, email, password, roleName } = registerSchema.parse(await req.json());

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existingUser) {
      return fail('Tên tài khoản hoặc Email đã tồn tại trong hệ thống', 400);
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return fail(`Vai trò ${roleName} không tồn tại — hãy chạy seed dữ liệu`, 400);
    }

    const user = await prisma.user.create({
      data: { username, email, password: await hashPassword(password), roleId: role.id },
      select: { id: true, username: true, email: true, createdAt: true, role: { select: { name: true } } },
    });

    await logActivity(
      auth.session,
      'CREATE_USER',
      `Admin ${auth.session.username} tạo tài khoản ${user.username} với vai trò ${user.role.name}.`,
      req
    );

    return NextResponse.json({ message: 'Tạo tài khoản thành công', user });
  } catch (error) {
    return handleError('POST User', error);
  }
}
