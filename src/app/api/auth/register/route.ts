import { NextResponse } from 'next/server';
import { handleError } from '@/server/http';
import { requireAuth } from '@/server/auth';
import { registerSchema } from '@/server/validators/catalog';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    // Đóng đăng ký công khai (SPEC GĐ3, FR-2) — chỉ ADMIN được tạo tài khoản
    const auth = await requireAuth(req, ['ADMIN']);
    if (!auth.ok) return auth.response;

    const { username, email, password, roleName } = registerSchema.parse(await req.json()); // Chốt chặn validation (SPEC GĐ2, FR-2)

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ thông tin: tài khoản, email và mật khẩu' },
        { status: 400 }
      );
    }

    // Kiểm tra trùng lặp tài khoản hoặc email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Tên tài khoản hoặc Email đã tồn tại trong hệ thống' },
        { status: 400 }
      );
    }

    // Tìm vai trò liên kết (mặc định là STAFF nếu không truyền)
    const targetRoleName = roleName || 'STAFF';
    let role = await prisma.role.findUnique({
      where: { name: targetRoleName },
    });

    // Phòng hờ nếu chưa chạy seed hoặc db trống
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: targetRoleName,
          description: `Vai trò tự động khởi tạo: ${targetRoleName}`,
        },
      });
    }

    // Băm mật khẩu
    const passwordHash = await hashPassword(password);

    // Lưu người dùng mới vào DB
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: passwordHash,
        roleId: role.id,
      },
      include: {
        role: true,
      },
    });

    // Ghi nhận nhật ký hoạt động
    await prisma.activityLog.create({
      data: {
        userId: newUser.id,
        username: newUser.username,
        action: 'REGISTER',
        details: `Tài khoản mới ${newUser.username} đăng ký thành công với vai trò ${newUser.role.name}.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({
      message: 'Đăng ký tài khoản thành công',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role.name,
      },
    });
  } catch (error: any) {
    return handleError('API Đăng ký', error);
  }
}
