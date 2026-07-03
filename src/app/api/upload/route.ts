import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { verifyAuth } from '@/lib/auth';

// POST: Nhận file tải lên và lưu vào thư mục public/uploads
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy tệp tải lên' }, { status: 400 });
    }

    // Giới hạn upload: chỉ ảnh, tối đa 5MB (SPEC GĐ3, FR-5)
    const MAX_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Chỉ chấp nhận file ảnh (JPG, PNG, WebP)' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB) — tối đa 5MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Xác định thư mục lưu trữ public/uploads trong thư mục làm việc của dự án
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    // Đảm bảo thư mục tồn tại (tạo đệ quy nếu cần)
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Đã tồn tại thư mục
    }

    // Làm sạch tên file để tránh lỗi đường dẫn và ký tự lạ
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    const filePath = join(uploadDir, filename);

    // Ghi file vật lý
    await writeFile(filePath, buffer);

    // Trả về đường dẫn tĩnh có thể truy cập qua Web
    const fileUrl = `/uploads/${filename}`;

    return NextResponse.json({
      message: 'Tải lên tệp thành công',
      url: fileUrl,
    });
  } catch (error) {
    console.error('Lỗi API Upload:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi khi tải lên tệp' }, { status: 500 });
  }
}
