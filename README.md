# GRC Backend — Stabilized Bootstrap

## Defaults
- PORT: 5000 (override: PORT)
- HEALTH_PATH: /api/health
- LOG_LEVEL: info
- CORS: localhost/127.0.0.1 (3000, 5173); extend via CORS_ORIGINS=a.com,b.com
- Node: ≥ 18 (global fetch)
- Metrics: enable with METRICS_ENABLED=true

## Endpoints
- GET /api/health → status + links
- GET /api/health/live → liveness 200
- GET /api/health/ready → SQLite ping; 503 on failure
- GET /api/version → { name, version, node, commit?, buildTime }
- GET /metrics → Prometheus (http counters, duration summary, auth_failures_total{reason})
- POST /api/auth/register → { email, password }
- POST /api/auth/login → { email, password } → { token }
- GET /api/protected/ping → needs Authorization: Bearer <jwt> + x-tenant-id

## Quick Regression (examples)
- Backend install: `npm --prefix backend ci`
- Start: `PORT=5000 node backend/server.js`
- Smokes:
  - `node scripts/health-smoke.js`
  - `node scripts/auth-tenant-smoke.js`
  - `node scripts/login-smoke.js`
- Version/Metrics:
  - `curl http://localhost:5000/api/version`
  - `curl http://localhost:5000/metrics | head -n 20`

## Graceful Shutdown
SIGINT/SIGTERM → waits in-flight, 30s failsafe.
