// Kiểm chứng tiêu chí chấp nhận GĐ2 (SPEC Mục 7) bằng API thật.
// Chạy: node scripts/verify-gd2.mjs (app đang chạy, DB seed)
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
  return `token=${/token=([^;]+)/.exec(res.headers.get('set-cookie'))?.[1]}`;
}
const api = (cookie) => (path, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', cookie } });

const admin = api(await login('admin', 'admin123'));

// AC2: hóa đơn quantity âm → 400 + details, DB không đổi
{
  const customers = (await (await admin('/api/customers?limit=1')).json()).customers;
  const products = (await (await admin('/api/products?limit=1')).json()).products;
  const before = products[0].stock;
  const res = await admin('/api/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customerId: customers[0].id,
      items: [{ productId: products[0].id, productName: products[0].name, unitPrice: 100, quantity: -5 }],
    }),
  });
  const body = await res.json();
  const after = (await (await admin('/api/products?limit=1')).json()).products[0].stock;
  record('Hóa đơn quantity=-5 → 400 + details, kho không đổi',
    res.status === 400 && Array.isArray(body.details) && after === before,
    `HTTP ${res.status}, details: ${JSON.stringify(body.details)?.slice(0, 80)}, kho ${before}→${after}`);

  const res2 = await admin('/api/invoices', {
    method: 'POST',
    body: JSON.stringify({ customerId: customers[0].id, items: [{ productName: 'x', unitPrice: 'abc', quantity: 1 }] }),
  });
  record('Hóa đơn unitPrice="abc" → 400', res2.status === 400, `HTTP ${res2.status}`);
}

// AC3: phiếu thu âm → 400
{
  const res = await admin('/api/receipts', { method: 'POST', body: JSON.stringify({ amount: -1000 }) });
  record('Phiếu thu amount=-1000 → 400', res.status === 400, `HTTP ${res.status}`);
}

// AC6: proxy còn chặn trang chưa đăng nhập
{
  const res = await fetch(`${BASE}/`, { redirect: 'manual' });
  const loc = res.headers.get('location') || '';
  record('Chưa đăng nhập vào / → redirect /login (proxy hoạt động)',
    [307, 308, 302].includes(res.status) && loc.includes('/login'),
    `HTTP ${res.status} → ${loc}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n=== KẾT QUẢ GĐ2: ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
