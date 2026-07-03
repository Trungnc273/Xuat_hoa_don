import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { cached, invalidateCache } from '@/server/cache';

// 1. GET: Lấy cấu hình doanh nghiệp hiện tại
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Cache 5 phút — xóa chủ động khi POST cập nhật (SPEC GĐ4, FR-1)
    const setting = await cached('settings', 5 * 60_000, async () => {
      const existing = await prisma.setting.findFirst();
      if (existing) return existing;
      // Nếu chưa có cài đặt nào, tạo cấu hình mặc định trống
      return prisma.setting.create({
        data: {
          companyName: 'Tên Doanh Nghiệp Mới',
          taxCode: '',
          address: '',
          phone: '',
          email: '',
          website: '',
          bankAccount: '',
          representative: '',
        },
      });
    });

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Lỗi GET Settings:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Cập nhật cấu hình doanh nghiệp
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // Chỉ Admin mới được chỉnh sửa cấu hình hệ thống
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { logo, companyName, taxCode, address, email, phone, website, bankAccount, representative } = body;

    if (!companyName) {
      return NextResponse.json({ error: 'Tên công ty là bắt buộc' }, { status: 400 });
    }

    let setting = await prisma.setting.findFirst();

    if (setting) {
      // Cập nhật cấu hình hiện tại
      setting = await prisma.setting.update({
        where: { id: setting.id },
        data: {
          logo,
          companyName,
          taxCode,
          address,
          email,
          phone,
          website,
          bankAccount,
          representative,
        },
      });
    } else {
      // Tạo mới nếu chưa có
      setting = await prisma.setting.create({
        data: {
          logo,
          companyName,
          taxCode,
          address,
          email,
          phone,
          website,
          bankAccount,
          representative,
        },
      });
    }

    // Xóa cache để GET tiếp theo thấy giá trị mới ngay (SPEC GĐ4, FR-1)
    invalidateCache('settings');

    // Ghi nhật ký
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'UPDATE_SETTINGS',
        details: `Cập nhật thông tin cấu hình doanh nghiệp.`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Cập nhật cấu hình thành công', setting });
  } catch (error) {
    console.error('Lỗi POST Settings:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
