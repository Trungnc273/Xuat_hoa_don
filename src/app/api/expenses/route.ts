import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { generateDocumentCode } from '@/lib/utils';

// 1. GET: Lấy danh sách chi phí khác
export async function GET(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || ''; // OFFICE, MARKETING, SALARY, v.v.
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const total = await prisma.expense.count({ where });

    const expenses = await prisma.expense.findMany({
      where,
      skip,
      take: limit,
      include: {
        payor: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      expenses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Lỗi GET Expenses:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}

// 2. POST: Thêm mới khoản chi phí
export async function POST(req: Request) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    if (!['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(session.role)) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện chức năng này' }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, amount, date, note } = body;

    const expAmount = parseFloat(amount);
    if (!title || !category || !expAmount || expAmount <= 0) {
      return NextResponse.json({ error: 'Vui lòng cung cấp tiêu đề, danh mục và số tiền lớn hơn 0' }, { status: 400 });
    }

    const expenseCode = await generateDocumentCode('CP', 'expense');

    const expense = await prisma.expense.create({
      data: {
        code: expenseCode,
        title,
        category,
        amount: expAmount,
        date: date ? new Date(date) : new Date(),
        payorId: session.userId,
        note,
      },
    });

    // Ghi nhật ký hệ thống
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action: 'CREATE_EXPENSE',
        details: `Tạo chi phí khác: ${expense.code} - ${expense.title} (Số tiền: ${expense.amount} VND, Danh mục: ${expense.category})`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });

    return NextResponse.json({ message: 'Tạo chi phí thành công', expense });
  } catch (error) {
    console.error('Lỗi POST Expense:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi hệ thống' }, { status: 500 });
  }
}
