/**
 * Cache in-memory đơn giản với TTL (SPEC GĐ4, FR-1).
 * Đủ dùng cho 1 tiến trình Next.js nội bộ — KHÔNG thêm Redis khi chưa có nhu cầu đo được
 * (CONSTITUTION Layer 2.5). Nếu sau này chạy nhiều instance thì mới cần cache tập trung.
 */
const store = new Map<string, { value: unknown; expiresAt: number }>();

/** Lấy từ cache hoặc tính mới rồi lưu với TTL. */
export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Xóa chủ động mọi key bắt đầu bằng prefix — gọi từ API ghi tương ứng. */
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
