import prisma from '@/lib/prisma';
import type { Session } from './auth';

/**
 * Ghi nhật ký hoạt động dùng chung (CONSTITUTION Layer 3.4).
 * Lỗi ghi log không được làm hỏng nghiệp vụ chính — nuốt lỗi có chủ đích, chỉ console.error.
 */
export async function logActivity(
  session: Session,
  action: string,
  details: string,
  req?: Request
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        username: session.username,
        action,
        details,
        ipAddress: req?.headers.get('x-forwarded-for') || '127.0.0.1',
      },
    });
  } catch (error) {
    console.error('Lỗi ghi ActivityLog:', error);
  }
}
