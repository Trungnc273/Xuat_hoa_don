import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireAuth } from '@/server/auth';
import { handleError, fail } from '@/server/http';
import { logActivity } from '@/server/activity-log';

const updateUserSchema = z
  .object({
    roleName: z.enum(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF']).optional(),
    password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional(),
  })
  .refine((v) => v.roleName || v.password, { message: 'Không có gì để cập nhật' });

// PATCH: ADMIN đổi vai trò hoặc đặt lại mật khẩu tài khoản khác (SPEC GĐ3, FR-1)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const input = updateUserSchema.parse(await req.json());

    const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!target) return fail('Không tìm thấy tài khoản', 404);

    // Chặn tự đổi vai trò của chính mình — tránh admin tự khóa hệ thống
    if (input.roleName && id === auth.session.userId) {
      return fail('Không thể tự thay đổi vai trò của chính mình', 400);
    }

    const data: { roleId?: string; password?: string } = {};
    const changes: string[] = [];

    if (input.roleName && input.roleName !== target.role.name) {
      const role = await prisma.role.findUnique({ where: { name: input.roleName } });
      if (!role) return fail(`Vai trò ${input.roleName} không tồn tại`, 400);
      data.roleId = role.id;
      changes.push(`vai trò ${target.role.name} → ${input.roleName}`);
    }
    if (input.password) {
      data.password = await hashPassword(input.password);
      changes.push('đặt lại mật khẩu');
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, role: { select: { name: true } } },
    });

    if (changes.length > 0) {
      await logActivity(
        auth.session,
        'UPDATE_USER',
        `Admin ${auth.session.username} cập nhật tài khoản ${user.username}: ${changes.join(', ')}.`,
        req
      );
    }

    return NextResponse.json({ message: 'Cập nhật tài khoản thành công', user });
  } catch (error) {
    return handleError('PATCH User', error);
  }
}
