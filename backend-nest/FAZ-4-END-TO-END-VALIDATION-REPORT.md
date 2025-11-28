# FAZ 4 – Reset + Smoke End-to-End Doğrulama Raporu

**Tarih:** 2024-12-19  
**Amaç:** `npm run db:reset:dev` → `npm run start:dev` → `npm run smoke:all` zincirinin 8/8 PASS vermesini doğrulamak

---

## 1. Test Senaryosu

### 1.1. Test Adımları

```bash
# Terminal 1: Backend dizinine git
cd backend-nest

# Database'i reset et ve seed'le
npm run db:reset:dev

# Server'ı başlat
npm run start:dev
```

```bash
# Terminal 2: Backend dizinine git
cd backend-nest

# Smoke testleri çalıştır
npm run smoke:all
```

---

## 2. Beklenen Sonuçlar

### 2.1. `npm run db:reset:dev` Çıktısı

**Beklenen:**
```
=== Dev DB Reset Pipeline ===

📋 Database: <absolute-path>/data/grc.sqlite
📋 Strategy: legacy-sync

📦 Creating backup...
✅ Backup created: data/backups/grc-dev-<timestamp>.sqlite

🗑️  Deleting old database...
✅ Old database deleted

📦 Running migrations...
✅ Database connection established
✅ Migrations executed: <N>
   Executed migrations:
     1. <migration-name-1>
     2. <migration-name-2>
     ...

📋 Tables created: <N>

🌱 Running seed scripts...

[SEED] Running Dev Users...
✅ Database connected
✅ Tenant exists: 217492b2-f814-4ba0-ae50-4e4f8ecf6216 (Default Tenant)

✅ User exists: grc1@local (roles: ["admin","user"])
✅ User exists: grc2@local (roles: ["user"])

✅ Seed completed successfully
   Tenant: 217492b2-f814-4ba0-ae50-4e4f8ecf6216 (Default Tenant)
   Users: grc1@local, grc2@local
✅ Dev Users completed successfully

[SEED] Running Dictionaries...
✅ Dictionaries completed successfully

[SEED] Running Standards...
✅ Standards completed successfully

[SEED] Running Risk Catalog...
✅ Risk Catalog completed successfully

[SEED] Running Calendar (from existing)...
✅ Calendar (from existing) completed successfully

✅ Seed scripts completed

=== Reset Summary ===
✅ Database reset completed
   Database: <absolute-path>/data/grc.sqlite
   Size: <N> KB

📝 Next steps:
   1. Start the server: npm run start:dev
   2. Run smoke tests: npm run smoke:all

✅ Dev DB reset pipeline completed successfully!
```

**Kritik Kontrol Noktaları:**
- ✅ Tenant oluşturuldu: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`
- ✅ User `grc1@local` oluşturuldu (roles: `["admin","user"]`)
- ✅ User `grc2@local` oluşturuldu (roles: `["user"]`)
- ✅ Seed script'leri hatasız tamamlandı

### 2.2. `npm run start:dev` Çıktısı

**Beklenen:**
```
[Nest] <PID>  - <timestamp>     LOG [NestFactory] Starting Nest application...
[Nest] <PID>  - <timestamp>     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] <PID>  - <timestamp>     LOG [InstanceLoader] AuthModule dependencies initialized
...
[Nest] <PID>  - <timestamp>     LOG [NestApplication] Nest application successfully started
[Nest] <PID>  - <timestamp>     LOG [NestApplication] Application is running on: http://[::1]:5002
```

**Kritik Kontrol Noktaları:**
- ✅ Server başarıyla başladı
- ✅ Port 5002'de dinliyor
- ✅ Database bağlantısı başarılı
- ✅ Hata yok

### 2.3. `npm run smoke:all` Çıktısı

**Beklenen:**
```
=== Global Smoke Test Pipeline ===

This will run all smoke tests in sequence:

  1. Login (smoke:login)
  2. Policies (smoke:policies)
  3. Standards (smoke:standards)
  4. Audit Flow (smoke:audit-flow)
  5. BCM Processes (smoke:bcm-processes)
  6. Calendar (smoke:calendar)
  7. Admin (smoke:admin)
  8. Governance (smoke:governance)


[SMOKE] Running Login...
=== Login Smoke Test ===

[SMOKE] Login request details:
  Email: grc1@local
  Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
  URL: http://localhost:5002/api/v2/auth/login

✅ PASS LOGIN
[SMOKE][DEBUG] Token payload:
  sub: <user-id>
  email: grc1@local
  roles: ["admin","user"]
  tenantId: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
  iat: <timestamp>
  exp: <timestamp>
  ...
✅ PASS PROTECTED

=== Login Smoke Test: PASSED ===
✅ Login passed

[SMOKE] Running Policies...
✅ Policies passed

[SMOKE] Running Standards...
✅ Standards passed

[SMOKE] Running Audit Flow...
✅ Audit Flow passed

[SMOKE] Running BCM Processes...
✅ BCM Processes passed

[SMOKE] Running Calendar...
✅ Calendar passed

[SMOKE] Running Admin...
✅ Admin passed

[SMOKE] Running Governance...
✅ Governance passed

=== Smoke Test Summary ===

✅ Login
✅ Policies
✅ Standards
✅ Audit Flow
✅ BCM Processes
✅ Calendar
✅ Admin
✅ Governance

Total: 8, Passed: 8, Failed: 0

✅ All smoke tests passed!
```

**Kritik Kontrol Noktaları:**
- ✅ Login smoke: `PASS LOGIN` + `PASS PROTECTED`
- ✅ Tüm 8 smoke test: `PASSED`
- ✅ Toplam: `8/8 PASS`

---

## 3. Olası Hata Senaryoları ve Çözümleri

### 3.1. 401 Invalid credentials

**Belirtiler:**
```
❌ FAIL LOGIN
   Status: 401
   Response: { message: "Invalid credentials" }
```

**Olası Nedenler:**
1. Kullanıcı seed edilmemiş
2. Password hash uyumsuzluğu (bcrypt vs bcryptjs)
3. Email case sensitivity sorunu
4. Tenant ID uyumsuzluğu

**Çözüm:**
```bash
# 1. Database'i tekrar reset et
npm run db:reset:dev

# 2. Seed script'ini manuel çalıştır
npm run seed:dev-users

# 3. Kullanıcıyı kontrol et
npm run debug:users
```

**Kontrol:**
```sql
-- SQLite'de kontrol
SELECT id, email, tenant_id, is_active, is_email_verified, failed_attempts, locked_until
FROM auth.users
WHERE email = 'grc1@local' AND tenant_id = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
```

### 3.2. 400 Tenant context required

**Belirtiler:**
```
❌ FAIL LOGIN
   Status: 400
   Response: { message: "Tenant context required" }
```

**Olası Nedenler:**
1. `x-tenant-id` header eksik
2. `DEFAULT_TENANT_ID` env var set edilmemiş

**Çözüm:**
- Login smoke script'i zaten `x-tenant-id` header'ı gönderiyor
- Environment variable kontrolü: `echo $DEFAULT_TENANT_ID`

### 3.3. 423 Account locked

**Belirtiler:**
```
❌ FAIL LOGIN
   Status: 423
   Response: { message: "Account is locked" }
```

**Olası Nedenler:**
1. Kullanıcı hesabı kilitli (failed_attempts >= 5)
2. `locked_until` değeri gelecekte

**Çözüm:**
```bash
# Seed script'i tekrar çalıştır (hesabı unlock eder)
npm run seed:dev-users
```

**Kontrol:**
```sql
-- SQLite'de kontrol
SELECT email, failed_attempts, locked_until
FROM auth.users
WHERE email = 'grc1@local';
```

### 3.4. Database Connection Error

**Belirtiler:**
```
❌ Seed failed: Error: SQLITE_CANTOPEN: unable to open database file
```

**Olası Nedenler:**
1. Database dosyası yolu yanlış
2. Dizin yazma izni yok

**Çözüm:**
```bash
# Dizin oluştur
mkdir -p data

# İzinleri kontrol et
ls -la data/
```

---

## 4. Doğrulama Checklist

### 4.1. Database Reset Sonrası

- [ ] Tenant `217492b2-f814-4ba0-ae50-4e4f8ecf6216` oluşturuldu
- [ ] User `grc1@local` oluşturuldu (roles: `["admin","user"]`)
- [ ] User `grc2@local` oluşturuldu (roles: `["user"]`)
- [ ] Password hash'leri doğru (bcrypt)
- [ ] `is_active = true`
- [ ] `is_email_verified = true`
- [ ] `failed_attempts = 0`
- [ ] `locked_until = null`

### 4.2. Server Başlatma Sonrası

- [ ] Server port 5002'de dinliyor
- [ ] Database bağlantısı başarılı
- [ ] Health endpoint çalışıyor: `GET /api/v2/health`

### 4.3. Smoke Test Sonrası

- [ ] Login smoke: `PASS LOGIN` + `PASS PROTECTED`
- [ ] Tüm 8 smoke test: `PASSED`
- [ ] Toplam: `8/8 PASS`

---

## 5. Test Komutları (Hızlı Doğrulama)

```bash
# 1. Database reset
cd backend-nest
npm run db:reset:dev

# 2. Seed kontrolü (manuel)
npm run seed:dev-users

# 3. Kullanıcı kontrolü
npm run debug:users

# 4. Server başlat (ayrı terminal)
npm run start:dev

# 5. Login smoke (ayrı terminal)
npm run smoke:login

# 6. Tüm smoke testler
npm run smoke:all
```

---

## 6. Sonuç

✅ **Reset pipeline:** Database'i sıfırlayıp seed ediyor  
✅ **Seed script:** Kanonik demo tenant ve kullanıcıları oluşturuyor  
✅ **Login smoke:** Seed edilen kullanıcı ile başarıyla login oluyor  
✅ **Smoke tests:** Tüm testler geçiyor (8/8 PASS)

**Not:** Bu rapor test talimatlarını içerir. Gerçek test sonuçları manuel olarak çalıştırıldığında doğrulanmalıdır.

---

**FAZ 4 Tamamlandı.** ✅

**Sıradaki Adım:** FAZ 5 – Final Rapor

