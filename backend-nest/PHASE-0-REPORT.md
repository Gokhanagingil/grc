# PHASE 0 - Durum Tespiti Raporu

## Özet

**Sorun:** `npm run smoke:login` komutu `401 Invalid credentials` hatası veriyor.

**Durum:** ✅ **ÇÖZÜLDÜ** - Kullanıcı seed edildi, smoke:login artık PASS LOGIN + PASS PROTECTED veriyor.

---

## Analiz Sonuçları

### 1. smoke:login Hangi Credentials ile Deniyor?

**Script:** `scripts/login-smoke.js`

**Kullanılan Bilgiler:**
- Email: `grc1@local` (env: `SMOKE_USER` veya default)
- Password: `grc1` (env: `SMOKE_PASS` veya default)
- Tenant ID: `217492b2-f814-4ba0-ae50-4e4f8ecf6216` (env: `DEFAULT_TENANT_ID` veya default)
- Base URL: `http://localhost:5002/api/v2`

**Not:** `login-smoke.js` login isteğinde `x-tenant-id` header'ı göndermiyor, ama `auth.controller.ts` bu header yoksa `DEFAULT_TENANT_ID` environment variable'ını kullanıyor.

### 2. DB'de Kullanıcı Var mı?

**Kontrol Script'i:** `backend-nest/scripts/debug-users.ts` (oluşturuldu)

**Sonuç:** ✅ **KULLANICI VAR**

**DB'deki Kullanıcılar:**
```
📋 All Users (2):
  - ID: c1f74278-72f0-48cf-ae4d-9a020ecc068b
    Email: grc1@local
    Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
    Display Name: GRC Admin User
    Active: true
    Email Verified: true
    MFA Enabled: false
    Password Hash: SET (60 chars)

  - ID: 1ad000b6-44cd-4dc5-bad2-ea76e9437372
    Email: grc2@local
    Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
    Display Name: GRC Regular User
    Active: true
    Email Verified: true
    MFA Enabled: false
    Password Hash: SET (60 chars)
```

**Tenant:**
```
📋 Tenants (1):
  - ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
    Name: Default Tenant
    Slug: default
    Active: true
```

### 3. Tenant ID Eşleşiyor mu?

✅ **EŞLEŞİYOR**
- smoke:login kullanılan tenant: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`
- DB'deki kullanıcının tenant_id: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`
- DB'deki tenant: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`

### 4. Seed/Migration Eksik mi?

**Seed Script:** `backend-nest/scripts/seed-dev-users.ts` ✅ **MEVCUT**

**Çalıştırma:**
```powershell
cd C:\dev\grc-platform\backend-nest
npm run seed:dev-users
```

**Sonuç:** ✅ **BAŞARILI**
```
✅ Database connected
✅ Created tenant: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
✅ Created user: grc1@local
✅ Created user: grc2@local
✅ Seed completed
```

---

## Backend Validation Logic

### AuthService.validateUser

**File:** `backend-nest/src/modules/auth/auth.service.ts`

**Kontrol Adımları:**
1. `where: { email: email.toLowerCase(), tenant_id: tenantId }` ile kullanıcı bulunur
2. Kullanıcı yoksa: `UnauthorizedException('Invalid credentials')`
3. Account locked kontrolü
4. `bcrypt.compare(pass, userEntity.password_hash)` ile şifre kontrol edilir
5. Şifre yanlışsa: `UnauthorizedException('Invalid credentials')`

**Not:** `validateUser` metodu `tenantId` parametresi alıyor ve kullanıcıyı email + tenant_id kombinasyonu ile arıyor.

### AuthController.login

**File:** `backend-nest/src/modules/auth/auth.controller.ts`

**Kontrol Adımları:**
1. `x-tenant-id` header'ı kontrol edilir
2. Header yoksa: `DEFAULT_TENANT_ID` environment variable'ı kullanılır
3. Header geçersiz UUID ise: `BadRequestException`
4. Tenant ID hiç yoksa: `BadRequestException('Tenant context required')`
5. `auth.login(dto.email, dto.password, effectiveTenant, dto.mfaCode)` çağrılır

---

## Sorun Tespiti

### Root Cause

**Sorun:** Kullanıcı DB'de yoktu.

**Çözüm:** `npm run seed:dev-users` script'i çalıştırıldı ve kullanıcılar oluşturuldu.

### Neden Bu Kadar Uzun Sürdü?

1. Seed script mevcut ama otomatik çalışmıyor
2. DB reset edildiğinde veya yeni kurulumda kullanıcılar seed edilmemişti
3. smoke:login testi çalıştırıldığında kullanıcı olmadığı için 401 hatası veriyordu

---

## Test Sonuçları

### smoke:login Test Sonucu (Çözüm Sonrası)

```powershell
cd C:\dev\grc-platform\backend-nest
npm run smoke:login
```

**Çıktı:**
```
PASS LOGIN
[SMOKE][DEBUG] Token payload:
  sub: c1f74278-72f0-48cf-ae4d-9a020ecc068b
  email: grc1@local
  iat: 1763753487 (2025-11-21T19:31:27.000Z)
  exp: 1763754387 (2025-11-21T19:46:27.000Z)
  exp - iat (sec): 900
  TTL (minutes): 15
  now (sec): 1763753487
  remaining TTL (sec): 900
  remaining TTL (minutes): 15
PASS PROTECTED
```

✅ **PASS LOGIN** - Login başarılı
✅ **PASS PROTECTED** - Protected endpoint erişimi başarılı

---

## Öneriler

### 1. Seed Script'i Otomatik Çalıştırma

**Öneri:** Backend başlatılırken seed script'i otomatik çalıştırılabilir (sadece dev ortamında).

**Not:** Şu an için manuel çalıştırma yeterli. Bu prompt'ta otomatik çalıştırma eklenmeyecek.

### 2. Debug Script'i Package.json'a Ekleme

**Öneri:** `debug:users` script'i package.json'a eklenebilir:

```json
"debug:users": "ts-node -r tsconfig-paths/register scripts/debug-users.ts"
```

**Not:** Bu prompt'ta eklenmeyecek, gerekirse ileride eklenebilir.

---

## Sonuç

✅ **smoke:login artık PASS LOGIN + PASS PROTECTED veriyor**

**Yapılan İşlemler:**
1. `debug-users.ts` script'i oluşturuldu (DB'deki kullanıcıları kontrol etmek için)
2. `npm run seed:dev-users` çalıştırıldı
3. Kullanıcılar DB'ye eklendi
4. smoke:login test edildi ve PASS oldu

**Bir sonraki adım:** PHASE 2 - Policy/Requirement/BCM create ve validation hatalarını çözme

