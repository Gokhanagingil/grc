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
