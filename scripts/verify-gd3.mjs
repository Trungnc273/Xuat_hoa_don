// Kiểm chứng tiêu chí chấp nhận GĐ3 (SPEC Mục 7) bằng API thật.
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
const api = (cookie) => (path, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) } });

const adminS = await login('admin', 'admin123');
const staffS = await login('staff', 'staff123');
const managerS = await login('manager', 'manager123');
const admin = api(adminS.cookie);
const staff = api(staffS.cookie);
const manager = api(managerS.cookie);

// AC: ADMIN tạo tài khoản mới → đăng nhập được
{
  const uname = `testnv${Date.now().toString().slice(-6)}`;
  const res = await admin('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username: uname, email: `${uname}@test.local`, password: 'test1234', roleName: 'STAFF' }),
  });
  const newLogin = await login(uname, 'test1234');
  record('ADMIN tạo tài khoản → đăng nhập được', res.status === 200 && newLogin.status === 200,
    `tạo HTTP ${res.status}, login HTTP ${newLogin.status}`);
}

// AC: STAFF bị chặn quản lý tài khoản
{
  const g = await staff('/api/users');
  const p = await staff('/api/users', { method: 'POST', body: JSON.stringify({ username: 'x', email: 'x@x.vn', password: '123456' }) });
  record('STAFF GET/POST /api/users → 403', g.status === 403 && p.status === 403, `GET ${g.status}, POST ${p.status}`);
}

// AC: register công khai đã đóng
{
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'hacker', email: 'h@h.vn', password: '123456' }),
  });
  record('POST /api/auth/register không đăng nhập → 401', res.status === 401, `HTTP ${res.status}`);

  const page = await fetch(`${BASE}/register`, { redirect: 'manual' });
  const loc = page.headers.get('location') || '';
  record('GET /register → redirect /login', [307, 308, 302].includes(page.status) && loc.includes('/login'),
    `HTTP ${page.status} → ${loc}`);
}

// AC: MANAGER tạo phiếu chi → 403 (Permission: chỉ ADMIN/ACCOUNTANT có Payment)
{
  const res = await manager('/api/payments', { method: 'POST', body: JSON.stringify({ amount: 1000 }) });
  record('MANAGER POST /api/payments → 403 (RBAC theo Permission)', res.status === 403, `HTTP ${res.status}`);
}

// AC: cookie giả (sai chữ ký) vào / → redirect /login (proxy verify thật)
{
  const fake = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJoYWNrIiwidXNlcm5hbWUiOiJoYWNrIiwicm9sZSI6IkFETUlOIn0.c2lnbmF0dXJlLWdpYQ';
  const res = await fetch(`${BASE}/`, { redirect: 'manual', headers: { cookie: `token=${fake}` } });
  const loc = res.headers.get('location') || '';
  record('Token giả vào / → redirect /login', [307, 308, 302].includes(res.status) && loc.includes('/login'),
    `HTTP ${res.status} → ${loc}`);
}

// AC: upload sai loại / quá cỡ → 400; ảnh nhỏ → OK
{
  const mkForm = (name, type, sizeBytes) => {
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array(sizeBytes)], name, { type }));
    return fd;
  };
  const up = (fd) => fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: adminS.cookie }, body: fd });

  const exe = await up(mkForm('virus.exe', 'application/x-msdownload', 100));
  const big = await up(mkForm('big.png', 'image/png', 6 * 1024 * 1024));
  const okUp = await up(mkForm('logo.png', 'image/png', 1024));
  record('Upload .exe → 400, ảnh 6MB → 400, ảnh nhỏ → 200',
    exe.status === 400 && big.status === 400 && okUp.status === 200,
    `exe ${exe.status}, big ${big.status}, ok ${okUp.status}`);
}

// AC: ADMIN tự đổi vai trò chính mình → 400
{
  const me = await (await admin('/api/auth/me')).json();
  const res = await admin(`/api/users/${me.user.id}`, { method: 'PATCH', body: JSON.stringify({ roleName: 'STAFF' }) });
  record('ADMIN tự đổi vai trò → 400', res.status === 400, `HTTP ${res.status}`);
}

const passed = results.filter(Boolean).length;
console.log(`\n=== KẾT QUẢ GĐ3: ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
