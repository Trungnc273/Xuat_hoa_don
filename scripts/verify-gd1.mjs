// Kiểm chứng 7 tiêu chí chấp nhận của SPEC Giai đoạn 1 bằng API thật.
// Chạy: node scripts/verify-gd1.mjs   (app phải đang chạy ở BASE, DB đã seed)
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const token = /token=([^;]+)/.exec(setCookie)?.[1];
  const body = await res.json();
  return { status: res.status, body, cookie: token ? `token=${token}` : '' };
}

const api = (cookie) => async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

async function main() {
  // ---- AC1: 4 vai trò trả đúng role ----
  const creds = [
    ['admin', 'admin123', 'ADMIN'],
    ['manager', 'manager123', 'MANAGER'],
    ['accountant', 'accountant123', 'ACCOUNTANT'],
    ['staff', 'staff123', 'STAFF'],
  ];
  const sessions = {};
  for (const [u, p, expected] of creds) {
    const s = await login(u, p);
    sessions[u] = api(s.cookie);
    const me = await sessions[u]('/api/auth/me');
    const role = me.body?.user?.role;
    record(`AC1: ${u} có role ${expected}`, role === expected, `nhận "${role}"`);
  }

  // ---- AC2: staff bị chặn tạo phiếu thu ----
  const r = await sessions.staff('/api/receipts', {
    method: 'POST',
    body: JSON.stringify({ amount: 1000 }),
  });
  record('AC2: staff POST /api/receipts bị 403', r.status === 403, `HTTP ${r.status}`);

  // ---- Chuẩn bị: lấy khách hàng + sản phẩm ----
  const admin = sessions.admin;
  const customers = (await admin('/api/customers?limit=1')).body.customers;
  const products = (await admin('/api/products?limit=10')).body.products;
  const customerId = customers[0].id;
  const product = products.find((p) => p.stock > 0) || products[0];

  const mkInvoice = (sess, qty, prodOverride) =>
    sess('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        items: [{
          productId: (prodOverride || product).id,
          productName: (prodOverride || product).name,
          unitPrice: (prodOverride || product).salePrice,
          vatRate: 10, discountRate: 0, quantity: qty,
        }],
      }),
    });

  // ---- AC3: staff chỉ thấy hóa đơn mình tạo ----
  await mkInvoice(admin, 1);            // hóa đơn của admin
  await mkInvoice(sessions.staff, 1);   // hóa đơn của staff
  const staffList = (await sessions.staff('/api/invoices?limit=100')).body.invoices;
  const onlyOwn = staffList.length > 0 && staffList.every((i) => i.creator?.username === 'staff');
  record('AC3: staff chỉ thấy hóa đơn của mình', onlyOwn,
    `thấy ${staffList.length} hóa đơn, creators: ${[...new Set(staffList.map((i) => i.creator?.username))].join(',')}`);

  // ---- AC4: 10 hóa đơn đồng thời → 10 mã khác nhau ----
  const ten = await Promise.all(Array.from({ length: 10 }, () => mkInvoice(admin, 1)));
  const codes = ten.map((x) => x.body?.invoice?.code).filter(Boolean);
  const unique = new Set(codes);
  record('AC4: 10 mã đồng thời không trùng', codes.length === 10 && unique.size === 10,
    `${codes.length} tạo được, ${unique.size} mã khác nhau`);

  // ---- AC5: bán vượt kho → thành công, tồn âm trung thực, có cảnh báo ----
  const before = (await admin(`/api/products/${product.id}`)).body?.product ??
                 (await admin('/api/products?limit=100')).body.products.find((p) => p.id === product.id);
  const over = await mkInvoice(admin, before.stock + 3);
  const after = (await admin('/api/products?limit=100')).body.products.find((p) => p.id === product.id);
  const warned = Array.isArray(over.body.stockWarnings) &&
    over.body.stockWarnings.some((w) => w.productId === product.id && w.newStock === -3);
  record('AC5: bán vượt kho → tồn = -3 + có stockWarnings',
    over.status === 200 && after.stock === -3 && warned,
    `HTTP ${over.status}, tồn sau: ${after?.stock}, cảnh báo: ${JSON.stringify(over.body.stockWarnings)}`);

  // ---- AC6: bán trong tồn → không cảnh báo (dùng sản phẩm khác còn hàng) ----
  const prod2 = (await admin('/api/products?limit=100')).body.products.find((p) => p.stock > 1 && p.id !== product.id);
  if (prod2) {
    const s0 = prod2.stock;
    const ok = await mkInvoice(admin, 1, prod2);
    const s1 = (await admin('/api/products?limit=100')).body.products.find((p) => p.id === prod2.id).stock;
    record('AC6: bán trong tồn → trừ đúng, không cảnh báo',
      ok.status === 200 && s1 === s0 - 1 && (ok.body.stockWarnings || []).length === 0,
      `tồn ${s0} → ${s1}, cảnh báo: ${(ok.body.stockWarnings || []).length}`);
  } else {
    record('AC6: bán trong tồn', false, 'không còn sản phẩm nào đủ tồn để test');
  }

  // ---- AC7: convert báo giá → trừ kho + StockMovement ----
  const prod3 = (await admin('/api/products?limit=100')).body.products.find((p) => p.id !== product.id) || product;
  const s0 = prod3.stock;
  const q = await admin('/api/quotations', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      items: [{ productId: prod3.id, productName: prod3.name, unitPrice: prod3.salePrice, vatRate: 10, discountRate: 0, quantity: 1 }],
    }),
  });
  const qid = q.body?.quotation?.id;
  const conv = await admin(`/api/quotations/${qid}/convert`, { method: 'POST' });
  const s1 = (await admin('/api/products?limit=100')).body.products.find((p) => p.id === prod3.id).stock;
  const movements = (await admin(`/api/stock-movements?limit=5`)).body;
  const movementList = movements.movements || movements.stockMovements || [];
  const hasMove = movementList.some((m) => m.productId === prod3.id && m.type === 'OUT' &&
    (m.reason || '').includes(conv.body?.invoice?.code || '###'));
  record('AC7: convert báo giá trừ kho + có StockMovement',
    conv.status === 200 && s1 === s0 - 1 && hasMove,
    `HTTP ${conv.status}, tồn ${s0} → ${s1}, movement ghi mã HĐ: ${hasMove}`);

  // ---- Tổng kết ----
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== KẾT QUẢ: ${passed}/${results.length} PASS ===`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error('Lỗi script:', e); process.exit(1); });
