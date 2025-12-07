# GRC Platform - Staging Docker Overview

Bu dokuman, GRC platformunun Docker ve staging ortami icin mevcut durumu ve yapilan iyilestirmeleri aciklar.

## Mevcut Durum Analizi

### Backend Dockerfile (backend-nest/Dockerfile)

Mevcut Dockerfile incelendi ve asagidaki ozellikler tespit edildi:

**Olumlu Noktalar:**
- Multi-stage build yapisi mevcut (builder + production)
- Node 20 Alpine kullaniliyor (hafif ve guvenli)
- Non-root kullanici (nestjs) olusturulmus
- Health check tanimli (/health/live endpoint'i)
- Proper OCI labels ekli
- Production dependencies prune ediliyor

**Dockerfile Detaylari:**
- Stage 1 (builder): `npm ci` ile bagimliliklari yukler, `npm run build` ile derler
- Stage 2 (production): Sadece dist ve production node_modules kopyalanir
- Port: 3002 (package.json ve compose ile uyumlu)
- CMD: `node dist/main.js` (package.json'daki `start:prod` ile uyumlu)

**Sonuc:** Backend Dockerfile production-ready durumda. Onemli bir degisiklik gerektirmiyor.

### docker-compose.nest.yml

Mevcut compose dosyasi incelendi:

**Servisler:**
1. `db` - PostgreSQL 15 Alpine
   - Volume: `grc_postgres_data:/var/lib/postgresql/data`
   - Port: 5432 (configurable via DB_EXTERNAL_PORT)
   - Health check: `pg_isready`

2. `backend-nest` - NestJS API
   - Build context: `./backend-nest`
   - Port: 3002
   - Depends on: db (service_healthy)
   - Health check: wget to /health/ready

**Environment Variables:**
- DB_USER, DB_PASSWORD, DB_NAME (defaults: postgres/postgres/grc_platform)
- JWT_SECRET (default: dev secret - MUST change for staging)
- CORS_ORIGINS (default: localhost ports)
- DB_SYNC (default: true - MUST be false for staging)

**Eksikler:**
- Frontend servisi yok
- Staging-specific konfigurasyonlar yok

**Sonuc:** Yeni bir `docker-compose.staging.yml` olusturmak daha dogru. Mevcut dosya development/demo icin uygun.

### Frontend Durumu

Frontend klasoru incelendi:

**Mevcut Yapi:**
- Framework: Create React App (react-scripts)
- Build output: `build/` klasoru
- API URL: `REACT_APP_API_URL` environment variable
- Dockerfile: YOK (olusturulmasi gerekiyor)

**Onemli Not:** Task'ta Vite olarak belirtilmis ancak gercekte Create React App kullaniliyor. Bu fark dikkate alinarak Dockerfile olusturulacak.

## Backend Dockerfile - Final Tasarim

Mevcut Dockerfile zaten production-ready oldugu icin buyuk degisiklik yapilmadi. Sadece dokumantasyon ve staging env ornegi eklendi.

```dockerfile
# Multi-stage build
# Stage 1: Builder - npm ci, npm run build
# Stage 2: Production - Node 20 Alpine, non-root user

# Key features:
# - Port 3002
# - Health check on /health/live
# - Non-root user (nestjs:nodejs)
# - Production dependencies only
```

**Staging Environment Beklentileri:**
- `backend-nest/.env.staging.example` dosyasi referans olarak kullanilacak
- JWT_SECRET: Minimum 32 karakter, random generated
- DB_SYNC: false (migrations kullanilacak)
- CORS_ORIGINS: Staging frontend URL'i

## Frontend Dockerfile - Final Tasarim

Yeni olusturulan Dockerfile:

```dockerfile
# Stage 1: Builder
# - Node 20 Alpine
# - npm ci
# - npm run build (react-scripts build)

# Stage 2: Runtime
# - Nginx stable Alpine
# - Build output /usr/share/nginx/html
# - Custom nginx.conf for SPA routing
```

**Ozellikler:**
- Multi-stage build ile kucuk image boyutu
- Nginx ile static file serving
- SPA routing icin try_files konfigurasyonu
- Gzip compression enabled
- Security headers

**API Base URL:**
- Build time'da `REACT_APP_API_URL` environment variable ile set edilir
- Staging icin: `http://46.224.99.150:3002` veya reverse proxy arkasinda `/api`

## docker-compose.staging.yml Tasarimi

Root seviyede yeni compose dosyasi:

**Servisler:**

1. `db` - PostgreSQL 15
   - Image: postgres:15-alpine
   - Volume: postgres_data_staging
   - Environment: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
   - Health check: pg_isready
   - Port: Internal only (5432)

2. `backend` - NestJS API
   - Build: ./backend-nest
   - Depends on: db (healthy)
   - Environment: Staging-specific values
   - Port: 3002:3002
   - Health check: /health/ready

3. `frontend` - React SPA
   - Build: ./frontend
   - Depends on: backend
   - Port: 80:80
   - Nginx serving static files

**Network:**
- Default bridge network (staging icin yeterli)

**Volumes:**
- postgres_data_staging: Persistent database storage

## Staging vs Development Farklari

| Ozellik | Development | Staging |
|---------|-------------|---------|
| DB_SYNC | true | false |
| JWT_SECRET | Dev secret | Random 64+ chars |
| CORS_ORIGINS | localhost:* | Staging URL |
| NODE_ENV | development | production |
| Frontend Port | 3000 | 80 |
| SSL/TLS | Yok | Opsiyonel (reverse proxy) |

## Sonraki Adimlar

1. Frontend Dockerfile olustur
2. docker-compose.staging.yml olustur
3. Staging env dosyalarini hazirla
4. Staging sunucusunda kurulum yap
5. GitHub Actions deploy pipeline'i olustur
6. Smoke test ve dogrulama
