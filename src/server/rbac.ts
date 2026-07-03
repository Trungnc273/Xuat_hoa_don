import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { fail } from './http';
import type { Session } from './auth';

/**
 * RBAC theo bảng Permission/RolePermission — nguồn sự thật duy nhất về quyền (SPEC GĐ3, FR-3).
 * Cache mapping trong bộ nhớ với TTL ngắn để không truy vấn DB mỗi request;
 * đổi quyền trong DB có hiệu lực chậm nhất sau CACHE_TTL_MS.
 */
const CACHE_TTL_MS = 60_000;

type PermissionKey = `${string}_${string}`; // `${action}_${subject}`
let cache: { data: Map<string, Set<PermissionKey>>; expiresAt: number } | null = null;

async function loadPermissionMap(): Promise<Map<string, Set<PermissionKey>>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;

  const roles = await prisma.role.findMany({
    select: {
      name: true,
      permissions: { select: { permission: { select: { action: true, subject: true } } } },
    },
  });

  const data = new Map<string, Set<PermissionKey>>();
  for (const role of roles) {
    data.set(
      role.name,
      new Set(role.permissions.map((rp) => `${rp.permission.action}_${rp.permission.subject}` as PermissionKey))
    );
  }
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

/** Kiểm tra vai trò có quyền (action, subject) không; action 'ALL' bao trùm. */
export async function hasPermission(roleName: string, action: string, subject: string): Promise<boolean> {
  const map = await loadPermissionMap();
  const perms = map.get(roleName);
  if (!perms) return false;
  return perms.has(`ALL_${subject}`) || perms.has(`${action}_${subject}`);
}

/**
 * Xác thực + kiểm tra quyền theo bảng Permission — thay cho mảng tên vai trò hardcode.
 *
 * const auth = await requirePermission(req, 'CREATE', 'Invoice');
 * if (!auth.ok) return auth.response;
 */
export async function requirePermission(
  req: Request,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'APPROVE',
  subject: string
): Promise<{ ok: true; session: Session } | { ok: false; response: ReturnType<typeof fail> }> {
  const session = await verifyAuth(req);
  if (!session) {
    return { ok: false, response: fail('Chưa xác thực người dùng', 401) };
  }
  if (!(await hasPermission(session.role, action, subject))) {
    return { ok: false, response: fail('Bạn không có quyền thực hiện chức năng này', 403) };
  }
  return { ok: true, session };
}
