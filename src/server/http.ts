import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Response thành công — giữ nguyên shape tự do để không phá API contract hiện có. */
export function ok(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

/** Response lỗi chuẩn. */
export function fail(message: string, status: number, details?: unknown) {
  return NextResponse.json(details ? { error: message, details } : { error: message }, { status });
}

/**
 * Xử lý lỗi cuối cùng của mọi route: ZodError → 400 kèm chi tiết field;
 * còn lại → 500, log đầy đủ server-side, không lộ chi tiết CSDL cho client.
 */
export function handleError(context: string, error: unknown) {
  if (error instanceof ZodError) {
    return fail(
      'Dữ liệu không hợp lệ',
      400,
      error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }
  console.error(`Lỗi ${context}:`, error);
  return fail('Đã xảy ra lỗi hệ thống', 500);
}
