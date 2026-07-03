import { verifyAuth } from '@/lib/auth';
import { fail } from './http';

export type Session = { userId: string; username: string; role: string };

/**
 * Xác thực + phân quyền dùng chung cho API route (thay khối lặp ở 30 route).
 *
 * const auth = await requireAuth(req, ['ADMIN', 'MANAGER']);
 * if (!auth.ok) return auth.response;
 * // auth.session an toàn để dùng
 *
 * Không truyền `roles` = chỉ cần đăng nhập. Xem .sdd/skills/SKILL-rbac-check.md.
 */
export async function requireAuth(
  req: Request,
  roles?: string[]
): Promise<{ ok: true; session: Session } | { ok: false; response: ReturnType<typeof fail> }> {
  const session = await verifyAuth(req);
  if (!session) {
    return { ok: false, response: fail('Chưa xác thực người dùng', 401) };
  }
  if (roles && !roles.includes(session.role)) {
    return { ok: false, response: fail('Bạn không có quyền thực hiện chức năng này', 403) };
  }
  return { ok: true, session };
}
