// Kiểm thử TRỌN LUỒNG nghiệm thu MVP (DANH-GIA-VA-LO-TRINH.md Mục 7 + SPEC GĐ4, FR-2).
// Chạy: node scripts/verify-mvp.mjs            → luồng nghiệp vụ + smoke UI
//       node scripts/verify-mvp.mjs --restart  → thêm test khởi động lại container Docker
import { execSync } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const results = [];
const record = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const m = /token=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return { status: res.status, cookie: m ? `token=${m[1]}` : '' };
}
const api = (cookie) => async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const suffix = Date.now().toString().slice(-6);
const admin = api((await login('admin', 'admin123')).cookie);

// ===== Bước 1: Admin tạo tài khoản nhân viên =====
const staffName = `nv${suffix}`;
{
  const res = await admin('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username: staffName, email: `${staffName}@shop.local`, password: 'nhanvien123', roleName: 'STAFF' }),
  });
  record('B1: Admin tạo tài khoản nhân viên', res.status === 200, `HTTP ${res.status}`);
}
const staff = api((await login(staffName, 'nhanvien123')).cookie);
const accountant = api((await login('accountant', 'accountant123')).cookie);

// ===== Bước 2: Tạo sản phẩm kèm tồn kho + khách hàng =====
let productId, customerId;
{
  const p = await admin('/api/products', {
    method: 'POST',
    body: JSON.stringify({ name: `Bàn gỗ MVP ${suffix}`, importPrice: 500000, salePrice: 800000, vatRate: 10, unit: 'Cái', stock: 20 }),
  });
  productId = p.body?.product?.id;
  const c = await admin('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ name: `Khách MVP ${suffix}`, phone: '0900000000' }),
  });
  customerId = c.body?.customer?.id;
  record('B2: Tạo sản phẩm (tồn 20) + khách hàng', p.status === 200 && c.status === 200 && !!productId && !!customerId,
    `sp ${p.status}, kh ${c.status}`);
}

// ===== Bước 3: Nhân viên tạo báo giá → chuyển thành hóa đơn, kho trừ đúng =====
let invoiceId, invoiceTotal;
{
  const q = await staff('/api/quotations', {
    method: 'POST',
    body: JSON.stringify({ customerId, items: [{ productId, productName: `Bàn gỗ MVP ${suffix}`, unitPrice: 800000, vatRate: 10, discountRate: 0, quantity: 3 }] }),
  });
  const conv = await staff(`/api/quotations/${q.body?.quotation?.id}/convert`, { method: 'POST' });
  invoiceId = conv.body?.invoice?.id;
  invoiceTotal = conv.body?.invoice?.total;
  const prod = (await admin('/api/products?limit=100&search=' + encodeURIComponent(`Bàn gỗ MVP ${suffix}`))).body.products?.[0];
  record('B3: Báo giá → hóa đơn, kho 20 → 17', q.status === 200 && conv.status === 200 && prod?.stock === 17,
    `bg ${q.status}, hd ${conv.status}, tồn ${prod?.stock}, tổng tiền ${invoiceTotal}`);
}

// ===== Bước 4: Kế toán thu đủ tiền → hóa đơn PAID, công nợ về 0 =====
{
  const r = await accountant('/api/receipts', {
    method: 'POST',
    body: JSON.stringify({ invoiceId, amount: invoiceTotal, paymentMethod: 'CASH' }),
  });
  const inv = (await admin(`/api/invoices/${invoiceId}`)).body?.invoice;
  record('B4: Thu đủ tiền → hóa đơn PAID, còn nợ 0',
    r.status === 200 && inv?.status === 'PAID' && inv?.remainingAmount === 0,
    `phiếu thu ${r.status}, trạng thái ${inv?.status}, còn nợ ${inv?.remainingAmount}`);
}

// ===== Bước 5: Dashboard + nhật ký phản ánh đúng =====
{
  const dash = await admin('/api/dashboard');
  const logs = await admin('/api/logs?limit=30');
  const logList = JSON.stringify(logs.body);
  const hasFlow = logList.includes('CREATE_USER') && logList.includes('CONVERT_QUOTATION') && logList.includes('CREATE_RECEIPT');
  record('B5: Dashboard 200 + nhật ký ghi đủ luồng', dash.status === 200 && !!dash.body?.counters && hasFlow,
    `dash ${dash.status}, log đủ: ${hasFlow}`);
  // Cache: gọi lần 2 phải nhanh hơn
  const t1 = Date.now(); await admin('/api/dashboard'); const d1 = Date.now() - t1;
  const t2 = Date.now(); await admin('/api/dashboard'); const d2 = Date.now() - t2;
  record('B5b: Dashboard lần 2 nhanh hơn (cache hit)', d2 <= d1, `lần1 ${d1}ms, lần2 ${d2}ms`);
}

// ===== Bước 6: Settings cache được xóa chủ động khi cập nhật =====
{
  await admin('/api/settings'); // nạp cache
  const newName = `Cửa hàng MVP ${suffix}`;
  await admin('/api/settings', { method: 'POST', body: JSON.stringify({ companyName: newName }) });
  const after = await admin('/api/settings');
  record('B6: PUT settings → GET thấy ngay giá trị mới', after.body?.setting?.companyName === newName,
    `nhận "${after.body?.setting?.companyName}"`);
}

// ===== Bước 7: Smoke 18 trang dashboard × 4 vai trò (không 500) =====
{
  const pages = ['/', '/customers', '/suppliers', '/products', '/stock', '/quotations', '/quotations/new',
    '/invoices', '/invoices/new', '/receipts', '/payments', '/expenses', '/debts', '/settings', '/logs', '/users'];
  const roles = [['admin', 'admin123'], ['manager', 'manager123'], ['accountant', 'accountant123'], ['staff', 'staff123']];
  let bad = [];
  for (const [u, p] of roles) {
    const { cookie } = await login(u, p);
    for (const pg of pages) {
      const res = await fetch(`${BASE}${pg}`, { headers: { cookie }, redirect: 'manual' });
      if (res.status >= 500) bad.push(`${u}:${pg}=${res.status}`);
    }
  }
  record('B7: Smoke 16 trang × 4 vai trò, không trang nào 500', bad.length === 0, bad.join(', ') || 'sạch');
}

// ===== Bước 8 (tùy chọn --restart): sống sót sau khởi động lại =====
if (process.argv.includes('--restart')) {
  console.log('... đang khởi động lại container (docker restart) ...');
  execSync('docker restart hoadon-app hoadon-db', { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 15000));
  const re = await login('admin', 'admin123');
  const inv = re.status === 200 ? await api(re.cookie)(`/api/invoices/${invoiceId}`) : { status: 0, body: {} };
  record('B8: Restart container → đăng nhập lại được, hóa đơn còn nguyên',
    re.status === 200 && inv.body?.invoice?.status === 'PAID',
    `login ${re.status}, hóa đơn ${inv.body?.invoice?.status}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n=== KẾT QUẢ MVP: ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
