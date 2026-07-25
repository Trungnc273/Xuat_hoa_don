import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { comparePassword, hashPassword } from '@/lib/auth';
import { requireAuth } from '@/server/auth';
import { handleError, fail } from '@/server/http';
import { logActivity } from '@/server/activity-log';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
});

// POST: người dùng tự đổi mật khẩu của chính mình (phải nhập đúng mật khẩu hiện tại)
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const input = changePasswordSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: auth.session.userId } });
    if (!user) return fail('Không tìm thấy tài khoản', 404);

    const isMatch = await comparePassword(input.currentPassword, user.password);
    if (!isMatch) return fail('Mật khẩu hiện tại không đúng', 400);

    if (input.currentPassword === input.newPassword) {
      return fail('Mật khẩu mới phải khác mật khẩu hiện tại', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(input.newPassword) },
    });

    await logActivity(auth.session, 'UPDATE_USER', `Tài khoản ${auth.session.username} tự đổi mật khẩu.`, req);

    return NextResponse.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    return handleError('POST ChangePassword', error);
  }
}
