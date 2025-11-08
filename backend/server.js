const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const client = require('prom-client');
require('dotenv').config();

const { initDb, getDb } = require('./database/sqlite');
const { authRouter } = require('./routes/auth');
const { auth, tenantGuard } = require('./utils/jwt');

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT ?? 5000);
const HEALTH_PATH = (process.env.HEALTH_PATH ?? '/api/health').replace(/\/+$/, '');
const HEALTH_LIVE_PATH = `${HEALTH_PATH}/live`;
const HEALTH_READY_PATH = `${HEALTH_PATH}/ready`;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const METRICS_ENABLED = String(process.env.METRICS_ENABLED ?? 'true').toLowerCase() === 'true';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000','http://127.0.0.1:3000',
  'http://localhost:5173','http://127.0.0.1:5173',
];
const extraCors = (process.env.CORS_ORIGINS || '')
  .split(',').map(s=>s.trim()).filter(Boolean);
const ALLOWED_CORS_ORIGINS = Array.from(new Set([...DEFAULT_CORS_ORIGINS, ...extraCors]));

const logger = pino({
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: [
    'req.headers.authorization','req.headers.Authorization',
    'req.headers.cookie','req.headers.Cookie',
    'res.headers["set-cookie"]','res.headers["Set-Cookie"]',
  ],
});

// Prometheus
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpReqCounter = new client.Counter({
  name: 'http_requests_total', help: 'HTTP requests', labelNames: ['method','path','status']
});
const httpDurSummary = new client.Summary({
  name: 'http_request_duration_seconds', help: 'HTTP duration', labelNames: ['method','path','status']
});
const authFailCounter = new client.Counter({
  name: 'auth_failures_total', help: 'Auth failures by reason', labelNames: ['reason']
});
[httpReqCounter, httpDurSummary, authFailCounter].forEach(m=> register.registerMetric(m));

const app = express();
app.use(pinoHttp({
  logger,
  genReqId: req => req.id || crypto.randomUUID(),
  customLogLevel: (res, err) => err || res.statusCode>=500 ? 'error' : res.statusCode>=400 ? 'warn' : 'info',
}));
app.use(helmet());
app.use(cors({ origin: ALLOWED_CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Metrics middleware
app.use((req,res,next)=>{
  const start = process.hrtime.bigint();
  res.on('finish', ()=>{
    try {
      const status = String(res.statusCode);
      const pathLabel = (req.route && req.route.path) || req.path;
      httpReqCounter.inc({method:req.method, path:pathLabel, status});
      if (req.authFailure) {
        authFailCounter.inc({ reason: req.authFailure });
      }
      const dur = Number((process.hrtime.bigint()-start)) / 1e9;
      httpDurSummary.observe({method:req.method, path:pathLabel, status}, dur);
    } catch {}
  });
  next();
});

// Routes
app.use('/api/auth', authRouter);

// Health
app.get(HEALTH_PATH, (req,res)=> res.json({ status:'OK', env:NODE_ENV, endpoints:{live:HEALTH_LIVE_PATH, ready:HEALTH_READY_PATH}}));
app.get(HEALTH_LIVE_PATH, (req,res)=> res.json({ status:'OK', uptime:process.uptime(), ts:new Date().toISOString() }));
app.get(HEALTH_READY_PATH, async (req,res)=>{
  try {
    const db = getDb();
    await new Promise((resolve, reject)=> db.get('SELECT 1', (err)=> err?reject(err):resolve()));
    return res.json({ status:'OK', env:NODE_ENV, db:'up' });
  } catch(err){
    return res.status(503).json({ status:'ERROR', env:NODE_ENV, db:'down', error:String(err.message||err) });
  }
});

// Version
app.get('/api/version', (req,res)=>{
  let name='grc-platform', version='0.0.0';
  try {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));
    name = rootPkg.name || name; version = rootPkg.version || version;
  } catch {}
  res.json({ name, version, node: process.version, commit: process.env.GIT_COMMIT || null, buildTime: new Date().toISOString() });
});

// Metrics
app.get('/metrics', async (req,res)=>{
  if(!METRICS_ENABLED) return res.status(404).send('metrics disabled');
  res.set('Content-Type', register.contentType); res.send(await register.metrics());
});

// Protected sample
app.get('/api/protected/ping', auth, tenantGuard, (req,res)=> res.json({ ok:true, user:req.user?.sub||'n/a' }));

// 404
app.use((req,res)=> res.status(404).json({message:'Not found'}));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err,req,res,next)=>{
  req.log?.error({err}, 'Unhandled error');
  res.status(err.status||500).json({ message:'Something went wrong' });
});

(async ()=>{
  try {
    await initDb();
    const server = app.listen(PORT, ()=>{
      logger.info({port:PORT, env:NODE_ENV, health:{base:HEALTH_PATH, live:HEALTH_LIVE_PATH, ready:HEALTH_READY_PATH}}, 'API ready');
    });

    const shutdown = (sig)=>{
      logger.warn({sig}, 'shutdown_start');
      server.close(()=>{ logger.warn('shutdown_complete'); process.exit(0); });
      setTimeout(()=>{ logger.error('shutdown_forced'); process.exit(1); }, 30000).unref();
    };
    process.on('SIGINT', ()=>shutdown('SIGINT'));
    process.on('SIGTERM', ()=>shutdown('SIGTERM'));
  } catch (e) {
    logger.error({e}, 'Failed to init DB');
    process.exit(1);
  }
})();
