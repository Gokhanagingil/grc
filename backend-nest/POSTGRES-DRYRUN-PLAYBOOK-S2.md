# Postgres Dry-Run Playbook - Sprint 2

**Tarih:** 2025-01-26  
**Sprint:** DB FOUNDATION - SPRINT 2  
**Amaç:** Postgres üzerinde migration'ları test etmek için dry-run script'i kullanım kılavuzu

---

## 1. Önkoşullar

### 1.1 PostgreSQL Kurulumu

**Lokal Kurulum:**
- PostgreSQL 12+ yüklü ve çalışıyor olmalı
- `psql` komut satırı aracı erişilebilir olmalı

**Docker ile (Önerilen):**
```bash
docker run --name grc-postgres-test \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=grc_test \
  -p 5432:5432 \
  -d postgres:15
```

**Cloud/Remote:**
- PostgreSQL instance'a erişim
- Connection string veya connection bilgileri

### 1.2 Veritabanı Oluşturma

**Test Veritabanı Oluşturma:**
```sql
CREATE DATABASE grc_test;
```

**Veya psql ile:**
```bash
psql -U postgres -c "CREATE DATABASE grc_test;"
```

---

## 2. Environment Variables

### 2.1 Option 1: DATABASE_URL (Önerilen)

**Format:**
```
postgresql://username:password@host:port/database
```

**Örnek:**
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc_test"
```

**Docker için:**
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc_test"
```

### 2.2 Option 2: Individual Variables

**Gerekli:**
- `DB_HOST` veya `PGHOST` - PostgreSQL host (default: localhost)
- `DB_NAME` veya `PGDATABASE` - Database name

**Opsiyonel:**
- `DB_USER` veya `PGUSER` - Username (default: postgres)
- `DB_PASS` veya `PGPASSWORD` - Password (default: postgres)
- `DB_PORT` veya `PGPORT` - Port (default: 5432)
- `DB_SSL` - SSL enabled (default: false)
- `DB_SCHEMA` - Schema name (default: public)

**Örnek:**
```bash
export DB_ENGINE=postgres
export DB_HOST=localhost
export DB_NAME=grc_test
export DB_USER=postgres
export DB_PASS=postgres
export DB_PORT=5432
```

---

## 3. Dry-Run Script Kullanımı

### 3.1 Komut

```bash
cd backend-nest
npm run pg:dryrun
```

### 3.2 Environment Variables ile

**DATABASE_URL ile:**
```bash
DB_ENGINE=postgres DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc_test" npm run pg:dryrun
```

**Individual variables ile:**
```bash
DB_ENGINE=postgres DB_HOST=localhost DB_NAME=grc_test DB_USER=postgres DB_PASS=postgres npm run pg:dryrun
```

### 3.3 .env Dosyası ile

**backend-nest/.env içine ekle:**
```env
DB_ENGINE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/grc_test
```

**Sonra:**
```bash
npm run pg:dryrun
```

---

## 4. Beklenen Çıktı

### 4.1 Başarılı Dry-Run

```
=== Postgres Dry-Run ===

📋 Configuration:
   DATABASE_URL: postgresql://postgres:****@localhost:5432/grc_test

Connecting to Postgres...
✅ Connected to Postgres

📋 Current migration status:
   Executed migrations: 0

📋 Pending migrations: 1
   1. BaselineGrcSchema20250126000000

Running pending migrations...
✅ Migrations executed: 1

📋 Tables created:
   Schema: auth
     - permissions
     - refresh_tokens
     - role_permissions
     - roles
     - user_roles
     - users
   Schema: tenant
     - tenants
   Schema: app
     - policies
     - risk_category
     - standard
   Schema: audit
     - audit_logs

✅ Total tables: 11

✅ Core tables found: 11/11

Testing basic query...
✅ Postgres version: PostgreSQL 15.1

✅ Postgres dry-run completed successfully

📝 Note: This was a dry-run. No production data was affected.

✅ Database connection closed
```

### 4.2 Hata Durumları

**Connection Error:**
```
❌ Error during Postgres dry-run: Error: connect ECONNREFUSED 127.0.0.1:5432

💡 Troubleshooting:
   - Check if PostgreSQL is running
   - Verify connection details (host, port, database)
   - Check firewall/network settings
```

**Authentication Error:**
```
❌ Error during Postgres dry-run: Error: password authentication failed

💡 Troubleshooting:
   - Verify username and password
   - Check pg_hba.conf configuration
```

**Database Not Found:**
```
❌ Error during Postgres dry-run: Error: database "grc_test" does not exist

💡 Troubleshooting:
   - Create the database first: CREATE DATABASE grc_test;
   - Or use an existing database
```

---

## 5. Troubleshooting

### 5.1 Connection Issues

**Problem:** `ECONNREFUSED` veya `timeout` hatası

**Çözümler:**
1. PostgreSQL'in çalıştığını kontrol et:
   ```bash
   # Linux/Mac
   ps aux | grep postgres
   
   # Windows
   Get-Service postgresql*
   ```

2. Port'un açık olduğunu kontrol et:
   ```bash
   # Linux/Mac
   netstat -an | grep 5432
   
   # Windows
   netstat -an | findstr 5432
   ```

3. Firewall ayarlarını kontrol et

### 5.2 Authentication Issues

**Problem:** `password authentication failed`

**Çözümler:**
1. Kullanıcı adı ve şifreyi doğrula
2. `pg_hba.conf` dosyasını kontrol et:
   ```bash
   # Linux/Mac (genellikle)
   /etc/postgresql/*/main/pg_hba.conf
   
   # Windows
   C:\Program Files\PostgreSQL\*\data\pg_hba.conf
   ```

3. Local connection için `trust` veya `md5` authentication kullan

### 5.3 Database Not Found

**Problem:** `database does not exist`

**Çözümler:**
1. Veritabanını oluştur:
   ```sql
   CREATE DATABASE grc_test;
   ```

2. Veya mevcut bir veritabanı kullan

### 5.4 Migration Errors

**Problem:** Migration çalışırken hata

**Çözümler:**
1. Migration log'larını kontrol et
2. Mevcut tabloları kontrol et:
   ```sql
   SELECT table_schema, table_name 
   FROM information_schema.tables 
   WHERE table_schema IN ('public', 'auth', 'tenant', 'app', 'audit', 'comms');
   ```

3. Migration history'yi kontrol et:
   ```sql
   SELECT * FROM migrations ORDER BY timestamp;
   ```

---

## 6. Cleanup (İsteğe Bağlı)

### 6.1 Test Veritabanını Temizleme

**Tüm tabloları sil:**
```sql
DROP SCHEMA IF EXISTS comms CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS tenant CASCADE;
DROP TABLE IF EXISTS migrations;
```

**Veya veritabanını sil:**
```sql
DROP DATABASE grc_test;
```

### 6.2 Docker Container'ı Durdurma

```bash
docker stop grc-postgres-test
docker rm grc-postgres-test
```

---

## 7. Production Kullanımı

**⚠️ UYARI:** Bu script test amaçlıdır. Production'da kullanmadan önce:

1. **Backup al:**
   ```bash
   pg_dump -U postgres -d grc_prod > backup.sql
   ```

2. **Staging ortamında test et:**
   - Önce staging'de çalıştır
   - Tüm testleri geçtiğinden emin ol

3. **Production'da dikkatli ol:**
   - Maintenance window planla
   - Rollback planı hazırla
   - Monitoring ekle

---

## 8. Sonraki Adımlar

**Sprint 2 Sonrası:**
- ✅ Baseline migration test edildi
- ✅ Postgres dry-run script'i hazır

**Sprint 3:**
- Dev ortamı migration-first'e geçiş
- Mevcut dev SQLite'ı migration'a align etme

**Sprint 4:**
- Gerçek Postgres cutover (stage/prod)
- Multi-env strategy

---

**Dokümantasyon Durumu:** ✅ Tamamlandı  
**Script Durumu:** ✅ Hazır  
**Test Durumu:** ⚠️ Kullanıcı testi gerekiyor (Postgres instance gerekli)

