const BASE = (process.env.API_BASE || 'http://localhost:5000').replace(/\/+$/,'');
const EMAIL = process.env.SMOKE_USER || `grc_${Date.now()}@local`;
const PASS = process.env.SMOKE_PASS || 'grc1!pass';
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4e4f8ecf6216';

async function jsonFetch(url, opts={}){
  const r = await fetch(url, { ...opts, headers:{ 'Content-Type':'application/json', ...(opts.headers||{}) }});
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

(async ()=>{
  const reg = await jsonFetch(`${BASE}/api/auth/register`, { method:'POST', body: JSON.stringify({ email: EMAIL, password: PASS }) });
  if (reg.status===201) console.log('PASS REGISTER');
  else if (reg.status===409) console.log('INFO REGISTER: user exists');
  else { console.log('FAIL REGISTER', reg.status, reg.body); process.exit(1); }

  const login = await jsonFetch(`${BASE}/api/auth/login`, { method:'POST', body: JSON.stringify({ email: EMAIL, password: PASS }) });
  if (login.status!==200 || !login.body?.token){ console.log('FAIL LOGIN', login.status, login.body); process.exit(1); }
  console.log('PASS LOGIN');
  const token = login.body.token;

  const ping = await fetch(`${BASE}/api/protected/ping`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': TENANT } });
  console.log(ping.status===200 ? 'PASS PROTECTED' : `FAIL PROTECTED [${ping.status}]`);
  process.exitCode = ping.status===200 ? 0 : 1;
})().catch(e=>{ console.error(e); process.exit(1); });
