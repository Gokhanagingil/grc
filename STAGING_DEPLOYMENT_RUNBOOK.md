# GRC Platform - Staging Deployment Runbook

## 🎯 Tek Komut Bloğu (Staging Host'ta Çalıştır)

```bash
cd /opt/grc-platform && \
set -e && \
echo "==========================================" && \
echo "GRC Platform - Staging Deployment" && \
echo "==========================================" && \
echo "" && \
echo "=== 1. GIT PULL ===" && \
git pull && \
echo "" && \
echo "=== 2. CONTAINER STATUS CHECK ===" && \
docker compose -f docker-compose.staging.yml ps && \
echo "" && \
echo "=== 3. BACKEND REBUILD ===" && \
docker compose -f docker-compose.staging.yml up -d --build backend && \
echo "" && \
echo "Waiting 10 seconds for container to stabilize..." && \
sleep 10 && \
echo "" && \
echo "=== 4. CONTAINER STATUS AFTER REBUILD ===" && \
docker compose -f docker-compose.staging.yml ps backend && \
echo "" && \
echo "=== 5. DATASOURCE SMOKE TEST ===" && \
docker compose -f docker-compose.staging.yml exec -T backend node -e "const ds=require('./dist/data-source.js'); console.log('exports:', Object.keys(ds)); console.log('AppDataSource:', !!ds.AppDataSource)" && \
echo "" && \
echo "=== 6. MIGRATION SHOW (First 20 lines) ===" && \
docker compose -f docker-compose.staging.yml exec -T backend npx typeorm migration:show -d dist/data-source.js | head -20 && \
echo "" && \
echo "=== 7. MIGRATION RUN ===" && \
docker compose -f docker-compose.staging.yml exec -T backend npx typeorm migration:run -d dist/data-source.js && \
echo "" && \
echo "=== 8. SEED SCRIPT EXECUTION ===" && \
docker compose -f docker-compose.staging.yml exec -T backend npm run seed:standards:prod && \
echo "" && \
echo "==========================================" && \
echo "✅ Deployment completed successfully!" && \
echo "=========================================="
```

---

## 📋 Copy/Paste Output - İhtiyacım Olan Çıktılar

Aşağıdaki bölümlerin **tam çıktılarını** kopyalayıp paylaşın:

### 1. **Container Status Check** (Adım 2)
```
=== 2. CONTAINER STATUS CHECK ===
[... tam çıktı ...]
```

### 2. **Container Status After Rebuild** (Adım 4)
```
=== 4. CONTAINER STATUS AFTER REBUILD ===
[... tam çıktı ...]
```

### 3. **DataSource Smoke Test** (Adım 5)
```
=== 5. DATASOURCE SMOKE TEST ===
[... tam çıktı ...]
```

### 4. **Migration Show** (Adım 6)
```
=== 6. MIGRATION SHOW (First 20 lines) ===
[... tam çıktı ...]
```

### 5. **Migration Run** (Adım 7)
```
=== 7. MIGRATION RUN ===
[... tam çıktı ...]
```

### 6. **Seed Script Execution** (Adım 8)
```
=== 8. SEED SCRIPT EXECUTION ===
[... tam çıktı ...]
```

### 7. **Hata Durumu** (Eğer varsa)
- Hatanın oluştuğu adım numarası
- Tam hata mesajı
- Exit code (varsa)

---

## 🔧 Hata Durumunda Teşhis Komutları

Eğer herhangi bir adımda hata alırsanız, aşağıdaki komutları çalıştırıp çıktılarını paylaşın:

### Teşhis 1: Backend Container Logs
```bash
docker compose -f docker-compose.staging.yml logs --tail=50 backend
```

### Teşhis 2: Backend Container Health Check
```bash
docker compose -f docker-compose.staging.yml exec -T backend wget --no-verbose --tries=1 --spider http://localhost:3002/health/ready 2>&1 || echo "Health check failed"
```

### Teşhis 3: DataSource File Existence Check
```bash
docker compose -f docker-compose.staging.yml exec -T backend ls -la dist/data-source.js && \
docker compose -f docker-compose.staging.yml exec -T backend ls -la dist/migrations/ 2>&1 | head -10
```

### Teşhis 4: Database Connection Test
```bash
docker compose -f docker-compose.staging.yml exec -T backend node -e "const ds=require('./dist/data-source.js'); ds.AppDataSource.initialize().then(() => { console.log('✅ DB connection OK'); process.exit(0); }).catch(e => { console.error('❌ DB connection FAILED:', e.message); process.exit(1); })"
```

### Teşhis 5: Migration Files Check
```bash
docker compose -f docker-compose.staging.yml exec -T backend find dist/migrations -name "*.js" -type f | sort
```

### Teşhis 6: Duplicate Migration Check (index.js kontrolü)
```bash
# index.js OLMAMALI - eğer varsa duplicate migration hatası oluşur
docker compose -f docker-compose.staging.yml exec -T backend sh -c "test -f /app/dist/migrations/index.js && echo 'ERROR: index.js exists - this will cause duplicate migrations!' || echo 'OK: index.js does not exist'"
```

---

## ✅ Beklenen Çıktı Örnekleri

### DataSource Smoke Test (Başarılı)
```
exports: [ 'AppDataSource' ]
AppDataSource: true
```

### Migration Show (Başarılı - Pending varsa)
```
[X] 1734112800000-CreateOnboardingTables
[ ] 1735000000000-CreateAuditPhase2Tables
```

### Migration Show (Başarılı - Tümü uygulanmış)
```
[X] 1734112800000-CreateOnboardingTables
[X] 1735000000000-CreateAuditPhase2Tables
```

### Migration Run (Başarılı - Pending yok)
```
No migrations are pending
```

### Migration Run (Başarılı - Migration çalıştı)
```
Migration 1735000000000-CreateAuditPhase2Tables has been executed successfully.
```

### Seed Script (Başarılı)
```
Seeding standards...
ISO/IEC 27001:2022 standard seeded successfully
X clauses seeded
```

---

## ⚠️ Önemli Notlar

1. **Container adı varsayılmadı**: Tüm komutlar `docker compose -f docker-compose.staging.yml` ile çalışır
2. **set -e aktif**: Herhangi bir komut başarısız olursa script durur
3. **Service adı**: `backend` service adı kullanıldı (docker-compose.staging.yml'den)
4. **Çıktı formatı**: Her bölüm `=== SECTION ===` ile ayrıldı
5. **Hata durumu**: Script hata verirse, teşhis komutlarını çalıştırın
6. **TypeORM CLI Kullanımı**: 
   - `dist/data-source.js` dosyası `AppDataSource` export eder (CommonJS)
   - Doğru kullanım: `npx typeorm migration:show -d dist/data-source.js`
   - `-d` parametresi data source dosyasının yolunu belirtir
7. **Duplicate Migration Hatası**:
   - **Root Cause**: Eğer `dist/migrations/index.js` dosyası varsa ve DataSource config'de glob pattern `dist/migrations/*.js` kullanılıyorsa, migrations iki kez yüklenir (bir kez dosyalardan, bir kez index'ten)
   - **Çözüm**: `dist/migrations/index.js` dosyası OLMAMALI
   - **Kontrol**: `test -f dist/migrations/index.js && echo "ERROR" || echo "OK"`
   - **Not**: `src/migrations/index.ts` dosyası silinmiş olmalı (build sırasında `dist/migrations/index.js` oluşmasını önlemek için)

---

## 🚀 Çalıştırma

Staging host'ta (46.224.99.150) root veya grcdeploy kullanıcısı ile:

```bash
cd /opt/grc-platform
# Yukarıdaki tek komut bloğunu buraya yapıştırın
```

---

## ✅ Validation (Doğrulama)

Deployment sonrası **mutlaka** aşağıdaki validation komutlarını çalıştırın. Tüm endpoint'ler JSON döndürmeli, `text/html` (index.html) döndürmemeli.

### Validation Komutları (SSH ile Staging Host'ta veya Local'den)

```bash
# Tüm validation komutlarını tek seferde çalıştır
echo "==========================================" && \
echo "STAGING VALIDATION - API Reverse Proxy" && \
echo "==========================================" && \
echo "" && \
echo "=== 1. Backend Health via Proxy (/health) ===" && \
curl -i http://46.224.99.150/health 2>&1 | head -20 && \
echo "" && \
echo "=== 2. Auth Login Endpoint (/auth/login) ===" && \
curl -i http://46.224.99.150/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}' 2>&1 | head -20 && \
echo "" && \
echo "=== 3. Audit Logs Endpoint (/audit-logs) ===" && \
curl -i http://46.224.99.150/audit-logs 2>&1 | head -20 && \
echo "" && \
echo "=== 4. GRC Risks Endpoint (/grc/risks) ===" && \
curl -i http://46.224.99.150/grc/risks 2>&1 | head -20 && \
echo "" && \
echo "=== 5. Frontend Health (/frontend-health) ===" && \
curl -i http://46.224.99.150/frontend-health 2>&1 | head -10 && \
echo "" && \
echo "==========================================" && \
echo "Validation completed" && \
echo "=========================================="
```

### Beklenen Sonuçlar (CRITICAL: text/html OLMAMALI)

Her endpoint için **Content-Type: application/json** olmalı, **text/html** olmamalı:

1. **`/health`** (Backend Health via Proxy):
   - ✅ Status: `200 OK`
   - ✅ Content-Type: `application/json`
   - ✅ Body: JSON health status (ör: `{"status":"ok","timestamp":"..."}`)
   - ❌ **OLMAMALI**: `Content-Type: text/html` veya `index.html` içeriği

2. **`/auth/login`** (POST):
   - ✅ Status: `400`, `401`, veya `405` (validation/auth error - normal)
   - ✅ Content-Type: `application/json`
   - ✅ Body: JSON error response (ör: `{"statusCode":400,"message":"..."}`)
   - ❌ **OLMAMALI**: `Content-Type: text/html` veya `index.html` içeriği

3. **`/audit-logs`** (GET):
   - ✅ Status: `401` veya `403` (unauthorized - normal, auth token gerekli)
   - ✅ Content-Type: `application/json`
   - ✅ Body: JSON error response (ör: `{"statusCode":401,"message":"Unauthorized"}`)
   - ❌ **OLMAMALI**: `Content-Type: text/html` veya `index.html` içeriği

4. **`/grc/risks`** (GET):
   - ✅ Status: `401` veya `403` (unauthorized - normal, auth token gerekli)
   - ✅ Content-Type: `application/json`
   - ✅ Body: JSON error response (ör: `{"statusCode":401,"message":"Unauthorized"}`)
   - ❌ **OLMAMALI**: `Content-Type: text/html` veya `index.html` içeriği

5. **`/frontend-health`** (Frontend Health Check):
   - ✅ Status: `200 OK`
   - ✅ Content-Type: `text/plain`
   - ✅ Body: `healthy\n` (static response, nginx'den)

### E2E Test (Playwright) - Staging

Staging ortamında E2E testleri çalıştırmak için:

```bash
# Frontend dizininde
cd frontend

# Staging URL'i set et ve testleri çalıştır
E2E_BASE_URL=http://46.224.99.150 npx playwright test --project=staging

# Veya tüm testleri staging URL ile
E2E_BASE_URL=http://46.224.99.150 npx playwright test
```

**Not**: `playwright.config.ts` içinde `staging` project tanımlı olmalı. Eğer yoksa, default project kullanılır.

### Hızlı Doğrulama (Local'den)

Staging host'a SSH yapmadan local'den doğrulama:

```bash
# Backend health (proxied)
curl -i http://46.224.99.150/health | grep -E "(HTTP|Content-Type)"

# Auth login (should be JSON, not HTML)
curl -i http://46.224.99.150/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}' | grep -E "(HTTP|Content-Type)"

# Audit logs (should be JSON, not HTML)
curl -i http://46.224.99.150/audit-logs | grep -E "(HTTP|Content-Type)"

# GRC risks (should be JSON, not HTML)
curl -i http://46.224.99.150/grc/risks | grep -E "(HTTP|Content-Type)"

# Frontend health
curl -i http://46.224.99.150/frontend-health | grep -E "(HTTP|Content-Type|healthy)"
```

### Beklenen Sonuçlar

#### ✅ Başarılı Proxy (Doğru Yapılandırma)

1. **Backend Health via Proxy** (`/health`):
   - Status: `200 OK`
   - Content-Type: `application/json` (backend response)
   - Body: JSON health status (NOT `text/html`)

2. **Auth Login** (`/auth/login`):
   - Status: `400` veya `401` (validation/auth error)
   - Content-Type: `application/json`
   - Body: JSON error response (NOT `text/html` veya `index.html`)

3. **Audit Logs** (`/audit-logs`):
   - Status: `401` veya `403` (unauthorized)
   - Content-Type: `application/json`
   - Body: JSON error response (NOT `text/html`)

4. **GRC Risks** (`/grc/risks`):
   - Status: `401` veya `403` (unauthorized)
   - Content-Type: `application/json`
   - Body: JSON error response (NOT `text/html`)

5. **Frontend Health** (`/frontend-health`):
   - Status: `200 OK`
   - Content-Type: `text/plain`
   - Body: `healthy\n`

#### ❌ Başarısız Proxy (Eski Yapılandırma)

Eğer reverse proxy çalışmıyorsa:
- Status: `200 OK`
- Content-Type: `text/html`
- Body: `index.html` içeriği (SPA fallback)

### Container İçi Doğrulama

Frontend container içinde nginx config'i kontrol etmek için:

```bash
# Nginx config'i görüntüle
docker compose -f docker-compose.staging.yml exec frontend cat /etc/nginx/conf.d/default.conf

# Nginx config test
docker compose -f docker-compose.staging.yml exec frontend nginx -t

# Nginx reload (config değişikliği sonrası)
docker compose -f docker-compose.staging.yml exec frontend nginx -s reload

# Frontend container logs
docker compose -f docker-compose.staging.yml logs --tail=50 frontend
```

### Frontend Rebuild (Reverse Proxy Değişiklikleri Sonrası)

Nginx config değişiklikleri için frontend'i rebuild etmek gerekir:

```bash
cd /opt/grc-platform && \
docker compose -f docker-compose.staging.yml up -d --build frontend && \
sleep 5 && \
docker compose -f docker-compose.staging.yml ps frontend
```

### Validation Checklist

Deployment sonrası aşağıdaki checklist'i kontrol edin:

**API Endpoints (CRITICAL - text/html OLMAMALI):**
- [ ] `curl -i http://46.224.99.150/health` → `Content-Type: application/json` (text/html değil)
- [ ] `curl -i http://46.224.99.150/auth/login -X POST ...` → `Content-Type: application/json` (text/html değil)
- [ ] `curl -i http://46.224.99.150/audit-logs` → `Content-Type: application/json` (text/html değil)
- [ ] `curl -i http://46.224.99.150/grc/risks` → `Content-Type: application/json` (text/html değil)

**Frontend Health:**
- [ ] `curl -i http://46.224.99.150/frontend-health` → `200 OK`, `healthy\n`

**Browser UI:**
- [ ] Browser'da `http://46.224.99.150` açılıyor ve UI yükleniyor
- [ ] Browser console'da API çağrıları başarılı (401/403 beklenir, ama JSON response)
- [ ] Network tab'de API istekleri `http://46.224.99.150/auth/login` gibi relative URL'ler kullanıyor (port yok, same-origin)

**E2E Tests:**
- [ ] `E2E_BASE_URL=http://46.224.99.150 npx playwright test --project=staging` başarılı

---

## 📝 Reverse Proxy Yapılandırması

Frontend nginx reverse proxy aşağıdaki route'ları backend'e (`backend:3002`) proxy'ler:

- `/auth/` - Authentication endpoints
- `/grc/` - GRC domain endpoints (risks, audits, policies, etc.)
- `/itsm/` - ITSM endpoints (incidents, problems, changes)
- `/audit-logs` - Audit logging endpoint
- `/onboarding/` - Onboarding endpoints
- `/users/` - User management endpoints
- `/tenants/` - Tenant management endpoints
- `/settings/` - Settings endpoints
- `/dashboard/` - Dashboard endpoints
- `/platform/` - Platform endpoints
- `/api/` - API v2 endpoints
- `/metrics` - Metrics endpoint
- `/health` - Backend health check (proxied to backend)
- `/health/` - Backend health sub-routes (live, ready, db, etc.)
- `/ws/` - WebSocket support (future)
- `/socket.io/` - Socket.IO support (future)

SPA route'ları (`/`) ve static assets nginx tarafından serve edilir.

Frontend health check için ayrı endpoint: `/frontend-health`