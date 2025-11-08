const path = require('path');
const { createRequire } = require('module');
const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const jwt = backendRequire('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'change-me-please';
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4e4f8ecf6216';
const BASE = (process.env.API_BASE || 'http://localhost:5000').replace(/\/+$/,'');
const URL = `${BASE}/api/protected/ping`;

async function call(label, headers){
  try{
    const r = await fetch(URL, { headers });
    const text = await r.text();
    const ok = (
      (label==='NO_TOKEN' && r.status===401) ||
      (label==='INVALID_TOKEN' && r.status===401) ||
      (label==='WRONG_TENANT' && r.status===403) ||
      (label==='OK' && r.status===200)
    );
    console.log(`${ok?'PASS':'FAIL'} ${label} [${r.status}] ${text.slice(0,120)}`);
    return ok;
  }catch(e){
    console.log(`FAIL ${label} error ${e?.message||e}`); return false;
  }
}

(async ()=>{
  const goodToken = jwt.sign({ sub:'auth-smoke', iat: Math.floor(Date.now()/1000) }, SECRET, { expiresIn:'5m' });
  const badToken = goodToken.slice(0, -2)+'xx';

  const A = await call('NO_TOKEN', {});
  const B = await call('INVALID_TOKEN', { Authorization:`Bearer ${badToken}`, 'x-tenant-id': TENANT });
  const C = await call('WRONG_TENANT', { Authorization:`Bearer ${goodToken}`, 'x-tenant-id': 'wrong-tenant' });
  const D = await call('OK', { Authorization:`Bearer ${goodToken}`, 'x-tenant-id': TENANT });

  process.exitCode = (A && B && C && D) ? 0 : 1;
})();
