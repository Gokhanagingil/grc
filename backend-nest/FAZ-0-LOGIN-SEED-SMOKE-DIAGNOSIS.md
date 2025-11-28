# FAZ 0 – Mevcut Login/Seed/Smoke Durum Teşhisi

**Tarih:** 2024-12-19  
**Amaç:** Mevcut login smoke testleri, seed script'leri ve reset pipeline'ının durumunu teşhis etmek (READ-ONLY)

---

## 1. Login Smoke Test Beklentileri

### 1.1. `scripts/login-smoke.js` (Root Scripts)

**Konum:** `scripts/login-smoke.js`

**Beklenen Değerler:**
- **Email:** `grc1@local` (env: `SMOKE_USER`, default: `grc1@local`)
- **Password:** `grc1` (env: `SMOKE_PASS`, default: `grc1`)
- **Tenant ID:** `217492b2-f814-4ba0-ae50-4e4f8ecf6216` (env: `DEFAULT_TENANT_ID`, default: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`)
- **API Base:** `http://localhost:5002` (env: `API_BASE`, default: `http://localhost:5002`)
- **Login Endpoint:** `POST /api/v2/auth/login`
- **Header:** `x-tenant-id: 217492b2-f814-4ba0-ae50-4e4f8ecf6216`

**Beklenen Response:**
- Status: `200` veya `201`
- Body: `{ access_token: "..." }` (JWT token)

**Sonraki Adım:**
- Protected endpoint test: `GET /api/v2/protected/ping` with Bearer token

### 1.2. `backend-nest/scripts/login-smoke.ps1` ve `.sh`

**PowerShell Script:**
- Email: `grc1@local` (env: `SMOKE_EMAIL`)
- Password: `grc1` (env: `SMOKE_PASSWORD`)
- Tenant ID: `DEFAULT_TENANT_ID` env var'dan alınıyor

**Bash Script:**
- Email: `grc1@local` (env: `SMOKE_EMAIL`)
- Password: `grc1` (env: `SMOKE_PASSWORD`)
- Tenant ID: `SMOKE_TENANT_ID` veya `DEFAULT_TENANT_ID` env var'dan

**Test Senaryoları:**
1. Login **with** tenant header → Beklenen: `200 OK` + `accessToken`
2. Login **without** tenant header → Beklenen: `400 Bad Request` + "Tenant context required" mesajı

---

## 2. Seed Script'leri Analizi

### 2.1. `scripts/seed-dev-users.ts` (Ana Seed Script)

**Konum:** `backend-nest/scripts/seed-dev-users.ts`

**Oluşturulan Tenant:**
- **ID:** `217492b2-f814-4ba0-ae50-4e4f8ecf6216` (env: `DEFAULT_TENANT_ID`, default: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`)
- **Name:** `Default Tenant`
- **Slug:** `default`
- **is_active:** `true`

**Oluşturulan Kullanıcılar:**

1. **grc1@local**
   - **Email:** `grc1@local` (lowercase'e çevriliyor)
   - **Password (plain):** `grc1`
   - **Password Hash:** `bcrypt.hash('grc1', saltRounds)` (saltRounds: env `BCRYPT_SALT_ROUNDS` veya default `10`)
   - **Display Name:** `GRC Admin User`
   - **Roles:** `['admin', 'user']` (JSON array)
   - **is_active:** `true`
   - **is_email_verified:** `true`
   - **failed_attempts:** `0` (reset ediliyor)
   - **locked_until:** `undefined` (unlock)

2. **grc2@local**
   - **Email:** `grc2@local` (lowercase'e çevriliyor)
   - **Password (plain):** `grc2`
   - **Password Hash:** `bcrypt.hash('grc2', saltRounds)`
   - **Display Name:** `GRC Regular User`
   - **Roles:** `['user']` (JSON array)
   - **is_active:** `true`
   - **is_email_verified:** `true`

**Özellikler:**
- ✅ **Idempotent:** Tenant ve kullanıcılar varsa güncelleniyor, yoksa oluşturuluyor
- ✅ **Password Hashing:** `bcrypt` (native) kullanıyor (auth service ile uyumlu)
- ✅ **Salt Rounds:** Environment variable'dan alınıyor (default: 10)

### 2.2. `scripts/seed-login-user.ts` (Alternatif Seed Script)

**Konum:** `backend-nest/scripts/seed-login-user.ts`

**Farklar:**
- ⚠️ **Password Hashing:** `bcryptjs` (JS implementation) kullanıyor (auth service `bcrypt` kullanıyor)
- ⚠️ **Salt Rounds Default:** `12` (seed-dev-users.ts'de `10`)
- ✅ **Tenant:** Aynı `DEFAULT_TENANT_ID` kullanıyor
- ✅ **User:** Sadece `grc1@local` oluşturuyor
- ⚠️ **Role Assignment:** `auth.user_roles` tablosuna manuel INSERT yapıyor (Postgres için)

**Not:** Bu script `seed:all` pipeline'ında **kullanılmıyor**.

### 2.3. `scripts/seed-all.ts` (Seed Orchestrator)

**Sıralama:**
1. `seed:dev-users` → Demo kullanıcılar
2. `seed:dictionaries` → Sözlük verileri
3. `seed:standards` → Standartlar
4. `seed:risk-catalog` → Risk kataloğu
5. `seed:calendar` → Takvim verileri

**Önemli:** `seed:dev-users` **ilk** çalışıyor, bu yüzden login için gerekli tenant ve kullanıcılar hazır oluyor.

---

## 3. Reset Pipeline Analizi

### 3.1. `scripts/reset-dev-db.ts`

**Akış:**

1. **Güvenlik Kontrolleri:**
   - ✅ `NODE_ENV !== 'production'` kontrolü
   - ✅ `DB_TYPE === 'sqlite'` kontrolü

2. **Backup:**
   - Mevcut DB varsa → `data/backups/grc-dev-{timestamp}.sqlite` olarak yedekleniyor

3. **DB Silme:**
   - Eski DB dosyası siliniyor

4. **Migration:**
   - `DataSource` oluşturuluyor
   - `dataSource.runMigrations()` çağrılıyor
   - Tüm migration'lar sırayla çalışıyor
   - Tabloların oluşturulduğu doğrulanıyor

5. **Seed:**
   - `npm run seed:all` çağrılıyor (execSync ile)
   - Bu da `seed:dev-users` → `seed:dictionaries` → ... sırasını çalıştırıyor

**DB Dosyası:**
- **Path:** `data/grc.sqlite` (env: `SQLITE_FILE` veya `DB_NAME`, default: `data/grc.sqlite`)
- **Absolute Path:** `process.cwd() + '/data/grc.sqlite'`

---

## 4. Auth Module Password Hashing

### 4.1. `src/modules/auth/auth.service.ts`

**Password Verification:**
```typescript
import * as bcrypt from 'bcrypt';
const passwordValid = await bcrypt.compare(pass, userEntity.password_hash);
```

**Kullanılan Library:** `bcrypt` (native, C++ binding)

**Not:** `bcryptjs` ile uyumlu olsa da, seed script'lerinde `bcrypt` kullanılması önerilir.

---

## 5. Fark Analizi: Beklenen vs. Gerçek

### 5.1. Tenant ID

| Kaynak | Değer | Durum |
|--------|-------|-------|
| Login Smoke | `217492b2-f814-4ba0-ae50-4e4f8ecf6216` | ✅ |
| Seed Script | `217492b2-f814-4ba0-ae50-4e4f8ecf6216` | ✅ |
| **Sonuç** | **UYUMLU** | ✅ |

### 5.2. Kullanıcı Email & Password

| Kullanıcı | Login Smoke | Seed Script | Durum |
|-----------|-------------|-------------|-------|
| grc1@local | `grc1@local` / `grc1` | `grc1@local` / `grc1` | ✅ |
| grc2@local | - (kullanılmıyor) | `grc2@local` / `grc2` | ℹ️ |

**Sonuç:** Login smoke sadece `grc1@local` kullanıyor, seed ise hem `grc1@local` hem `grc2@local` oluşturuyor. Bu bir sorun değil.

### 5.3. Password Hashing

| Script | Library | Salt Rounds | Auth Service | Durum |
|--------|---------|-------------|--------------|-------|
| seed-dev-users.ts | `bcrypt` | 10 (default) | `bcrypt` | ✅ |
| seed-login-user.ts | `bcryptjs` | 12 (default) | `bcrypt` | ⚠️ |

**Not:** `bcryptjs` ve `bcrypt` hash'leri birbiriyle uyumludur, ancak tutarlılık için `bcrypt` kullanılması önerilir.

### 5.4. Roles

| Kullanıcı | Seed Roles | Beklenen | Durum |
|-----------|------------|----------|-------|
| grc1@local | `['admin', 'user']` | Admin yetkisi | ✅ |
| grc2@local | `['user']` | User yetkisi | ✅ |

**Not:** UserEntity.roles alanı JSON array olarak saklanıyor. Role-based permission kontrolü için bu yeterli görünüyor.

---

## 6. Potansiyel Sorunlar

### 6.1. ✅ Çözülmüş/Uyumlu

1. **Tenant ID:** Tüm script'lerde aynı GUID kullanılıyor
2. **Email/Password:** Login smoke ve seed uyumlu
3. **Password Hashing:** seed-dev-users.ts `bcrypt` kullanıyor (auth service ile uyumlu)

### 6.2. ⚠️ İyileştirme Gereken

1. **seed-login-user.ts:** `bcryptjs` yerine `bcrypt` kullanmalı (ancak bu script `seed:all` pipeline'ında kullanılmıyor, sorun değil)
2. **Salt Rounds:** Environment variable'dan alınıyor, default değerler farklı olabilir (10 vs 12)

### 6.3. ❓ Kontrol Edilmesi Gereken

1. **Email Case Sensitivity:** Seed script email'i lowercase'e çeviriyor, auth service de lowercase kullanıyor mu? → ✅ Evet, `email.toLowerCase()` kullanılıyor
2. **Tenant Header:** Login smoke `x-tenant-id` header'ı gönderiyor mu? → ✅ Evet, gönderiyor
3. **Idempotency:** Seed script idempotent mi? → ✅ Evet, `findOne` + `save` pattern'i kullanılıyor

---

## 7. Reset + Seed Pipeline Özeti

```
npm run db:reset:dev
  ↓
1. Backup existing DB (if exists)
  ↓
2. Delete old DB file
  ↓
3. Run migrations (fresh schema)
  ↓
4. npm run seed:all
    ↓
    4.1. seed:dev-users
        → Tenant: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
        → User: grc1@local / grc1 (roles: ['admin', 'user'])
        → User: grc2@local / grc2 (roles: ['user'])
    ↓
    4.2. seed:dictionaries
    ↓
    4.3. seed:standards
    ↓
    4.4. seed:risk-catalog
    ↓
    4.5. seed:calendar
  ↓
✅ Database ready for smoke tests
```

---

## 8. Sonuç ve Öneriler

### 8.1. Mevcut Durum

✅ **Genel olarak uyumlu:** Login smoke testleri ve seed script'leri aynı tenant ID, email ve password değerlerini kullanıyor.

✅ **Idempotent:** Seed script'leri idempotent çalışıyor (tekrar çalıştırılabilir).

✅ **Password Hashing:** Ana seed script (`seed-dev-users.ts`) auth service ile uyumlu `bcrypt` kullanıyor.

### 8.2. İyileştirme Önerileri

1. **Tutarlılık:** Tüm seed script'lerinde `bcrypt` (native) kullanılmalı, `bcryptjs` kullanılmamalı.
2. **Salt Rounds:** Tüm script'lerde aynı default salt rounds değeri kullanılmalı (örneğin 10).
3. **Dokümantasyon:** Seed script'lerinde kullanılan değerlerin (tenant ID, email, password) dokümante edilmesi.

### 8.3. Smoke Test Başarısızlık Senaryoları

Eğer smoke testler başarısız oluyorsa, olası nedenler:

1. **401 Invalid credentials:**
   - Password hash uyumsuzluğu (bcrypt vs bcryptjs)
   - Email case sensitivity sorunu
   - Tenant ID uyumsuzluğu

2. **400 Tenant context required:**
   - `x-tenant-id` header'ı eksik veya yanlış
   - `DEFAULT_TENANT_ID` env var set edilmemiş

3. **423 Account locked:**
   - Kullanıcı hesabı kilitli (failed_attempts >= 5)
   - Seed script'te `locked_until` reset edilmeli

---

**FAZ 0 Tamamlandı.** ✅

**Sıradaki Adım:** FAZ 1 – Kanonik Demo Tenant & Kullanıcı Modeli Tasarımı

