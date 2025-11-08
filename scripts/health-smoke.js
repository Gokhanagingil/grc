const { performance } = require('node:perf_hooks');
const DEFAULT_BASE = 'http://localhost:5000/api/health';
const norm = u => (u||DEFAULT_BASE).replace(/\/(live|ready)$/i,'').replace(/\/+$/,'')||DEFAULT_BASE;

async function probe(name, url) {
  const controller = new AbortController(); const to = setTimeout(()=>controller.abort(), 5000);
  const t0 = performance.now();
  try{
    const r = await fetch(url, { signal: controller.signal });
    const ms = Math.round(performance.now()-t0);
    if(!r.ok) return {name, ok:false, status:r.status, ms, msg:`HTTP ${r.status}`};
    let body; try{ body = await r.json(); }catch{ body = await r.text(); }
    return {name, ok:true, status:r.status, ms, msg: typeof body==='string'?body:JSON.stringify(body)};
  }catch(e){
    const ms = Math.round(performance.now()-t0);
    return {name, ok:false, status:0, ms, msg: e?.name==='AbortError'?'timeout':(e?.message||'error')};
  }finally{ clearTimeout(to); controller.abort(); }
}

(async ()=>{
  const base = norm(process.env.HEALTH_BASE_URL || process.env.HEALTH_URL);
  const targets = [
    {name:'HEALTH(LIVE)', url: `${base}/live`},
    {name:'HEALTH(READY)', url: `${base}/ready`},
    {name:'HEALTH(BASE)', url: base},
  ];
  const results = [];
  for (const t of targets){
    const r = await probe(t.name, t.url); results.push(r);
    const tag = r.ok?'PASS':'FAIL'; const sc = r.status?` [${r.status}]`:''; console.log(`${tag} ${t.name}${sc} (${r.ms}ms) ${r.msg}`);
  }
  const failed = results.filter(x=>!x.ok).length;
  process.exitCode = failed?1:0;
})().catch(e=>{ console.error(e); process.exit(1); });
