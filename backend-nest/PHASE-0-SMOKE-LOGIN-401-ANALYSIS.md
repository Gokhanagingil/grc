# PHASE 0 - smoke:login 401 "Invalid credentials" Analiz Raporu

## Özet

**Durum:** `npm run smoke:login` komutu artık `FAIL LOGIN 401 { message: 'Invalid credentials' }` hatası veriyor.

**Amaç:** Bu hatanın kök sebebini tespit etmek ve çözüm stratejisi belirlemek.

---

## 1. login-smoke.js Analizi

**Dosya:** `scripts/login-smoke.js`

**Kullanılan Credentials:**
```javascript
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
```

**Login İsteği:**
- URL: `${BASE}/api/v2/auth/login`
- Method: POST
- Body: `{ email: 'grc1@local', password: 'grc1' }`
- Header: `x-tenant-id: 217492b2-f814-4ba0-ae50-4e4f8ecf6216` (protected/ping için)

**Beklenen Davranış:**
- ✅ `200` veya `201` status code
- ✅ Response body'de `access_token` olmalı

**Gerçek Davranış:**
- ❌ `401` status code
- ❌ `{ message: 'Invalid credentials', error: 'Unauthorized', statusCode: 401 }`

---

## 2. Backend Auth Flow Analizi

### 2.1. AuthController (`backend-nest/src/modules/auth/auth.controller.ts`)

**Login Endpoint:**
```typescript
@Post('login')
async login(
  @Body() dto: LoginDto,
  @Headers('x-tenant-id') tenantHeader?: string,
) {
  const defaultTenant = this.config.get<string>('DEFAULT_TENANT_ID')?.trim();
  const headerTenant = tenantHeader?.trim();
  
  const effectiveTenant = headerTenant || defaultTenant || null;
  
  if (!effectiveTenant) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Tenant context required',
    });
  }
  
  return this.auth.login(dto.email, dto.password, effectiveTenant, dto.mfaCode);
}
```

**Notlar:**
- `x-tenant-id` header'ı login request'inde gönderilmiyor (login-smoke.js'te sadece body'de email/password var)
- `DEFAULT_TENANT_ID` env değişkeninden tenant ID alınıyor
- `effectiveTenant` login isteğine geçiriliyor

### 2.2. AuthService (`backend-nest/src/modules/auth/auth.service.ts`)

**validateUser Metodu:**
```typescript
async validateUser(
  email: string,
  pass: string,
  tenantId: string,
  mfaCode?: string,
) {
  const userEntity = await this.usersRepo.findOne({
    where: { email: email.toLowerCase(), tenant_id: tenantId },
  });
  
  if (!userEntity) {
    throw new UnauthorizedException('Invalid credentials');
  }
  
  // Check if account is locked
  if (userEntity.locked_until && userEntity.locked_until > new Date()) {
    throw new ForbiddenException({
      statusCode: 423,
      message: 'Account is locked. Please try again later.',
    });
  }
  
  // Verify password
  const passwordValid = await bcrypt.compare(pass, userEntity.password_hash);
  
  if (!passwordValid) {
    // Increment failed attempts
    userEntity.failed_attempts = (userEntity.failed_attempts || 0) + 1;
    
    // Lock account after 5 failed attempts
    if (userEntity.failed_attempts >= 5) {
      const lockDuration = 15 * 60 * 1000; // 15 minutes
      userEntity.locked_until = new Date(Date.now() + lockDuration);
    }
    
    await this.usersRepo.save(userEntity);
    throw new UnauthorizedException('Invalid credentials');
  }
  
  // ... rest of validation
}
```

**Kritik Kontroller:**
1. ✅ Email: `email.toLowerCase()` ile aranıyor
2. ✅ Tenant ID: `tenant_id` ile eşleştiriliyor
3. ✅ Password: `bcrypt.compare(pass, userEntity.password_hash)` ile doğrulanıyor
4. ✅ Account Lock: `locked_until` kontrolü yapılıyor

**Hata Senaryoları:**
- Kullanıcı bulunamazsa → `Invalid credentials` (401)
- Şifre yanlışsa → `Invalid credentials` (401)
- Hesap kilitliyse → `Account is locked` (423)

---

## 3. Seed Script Analizi

### 3.1. seed-dev-users.ts (`backend-nest/scripts/seed-dev-users.ts`)

**Oluşturulan Kullanıcılar:**
```typescript
const users = [
  {
    email: 'grc1@local',
    password: 'grc1',
    displayName: 'GRC Admin User',
    roles: ['admin'],
  },
  {
    email: 'grc2@local',
    password: 'grc2',
    displayName: 'GRC Regular User',
    roles: ['user'],
  },
];
```

**Tenant ID:**
```typescript
const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
```

**User Creation Logic:**
```typescript
let user = await userRepo.findOne({
  where: { tenant_id: tenantId, email: userData.email.toLowerCase() },
});

if (user) {
  user.password_hash = passwordHash;  // ⚠️ Password hash güncelleniyor
  user.display_name = userData.displayName;
  user.is_active = true;
  user.is_email_verified = true;
  console.log(`✅ Updated user: ${userData.email}`);
} else {
  user = userRepo.create({
    id: randomUUID(),
    tenant_id: tenantId,
    email: userData.email.toLowerCase(),
    password_hash: passwordHash,
    display_name: userData.displayName,
    is_active: true,
    is_email_verified: true,
  });
  console.log(`✅ Created user: ${userData.email}`);
}
```

**Notlar:**
- ✅ Email lowercase'e çevriliyor: `userData.email.toLowerCase()`
- ✅ Tenant ID doğru: `DEFAULT_TENANT_ID` kullanılıyor
- ✅ Password hash bcrypt ile oluşturuluyor: `bcrypt.hash(userData.password, saltRounds)`
- ✅ Mevcut kullanıcı varsa password hash güncelleniyor

---

## 4. Olası Sorun Senaryoları

### Senaryo A: Kullanıcı Hiç Yok

**Belirtiler:**
- DB'de `grc1@local` kullanıcısı yok
- `validateUser` metodu `findOne` sonucu `null` döndüğü için `Invalid credentials` hatası

**Çözüm:**
- `npm run seed:dev-users` komutunu çalıştırarak kullanıcıyı oluştur

### Senaryo B: Kullanıcı Var Ama Tenant Uyuşmuyor

**Belirtiler:**
- DB'de `grc1@local` kullanıcısı var
- Ancak `tenant_id` değeri `217492b2-f814-4ba0-ae50-4e4f8ecf6216` değil
- `validateUser` metodu `where: { email: email.toLowerCase(), tenant_id: tenantId }` ile bulamıyor

**Çözüm:**
- Kullanıcının `tenant_id` değerini düzelt
- Veya seed script'ini çalıştırarak password hash'i güncelle ve tenant_id'yi kontrol et

### Senaryo C: Kullanıcı & Tenant Var Ama Password Uyuşmuyor

**Belirtiler:**
- DB'de kullanıcı var ve tenant_id doğru
- Ancak `bcrypt.compare(pass, userEntity.password_hash)` `false` döndürüyor
- Password hash yanlış veya eski

**Çözüm:**
- Seed script'ini çalıştırarak password hash'i güncelle

### Senaryo D: Hesap Kilitli

**Belirtiler:**
- Kullanıcı var, tenant doğru, password doğru
- Ancak `locked_until` değeri gelecekte bir tarihe set edilmiş
- `validateUser` metodu `ForbiddenException` (423) fırlatıyor

**Çözüm:**
- `locked_until` değerini `null` yap
- Veya seed script'ini çalıştırarak `failed_attempts` ve `locked_until` değerlerini sıfırla

---

## 5. Test Edilmesi Gerekenler

1. **DB'de Kullanıcı Var mı?**
   - `grc1@local` email'ine sahip kullanıcı var mı?
   - Kullanıcının `tenant_id` değeri `217492b2-f814-4ba0-ae50-4e4f8ecf6216` mi?

2. **Password Hash Doğru mu?**
   - `grc1` şifresi ile oluşturulmuş hash doğru mu?
   - `bcrypt.compare('grc1', userEntity.password_hash)` `true` döndürüyor mu?

3. **Hesap Aktif mi?**
   - `is_active = true` mu?
   - `locked_until` null veya geçmiş bir tarih mi?

4. **Tenant Var mı?**
   - `217492b2-f814-4ba0-ae50-4e4f8ecf6216` ID'li tenant var mı?

---

## 6. Kök Sebep Hipotezi

**En Olası Senaryo:** Senaryo A veya Senaryo B

**Neden:**
- `validateUser` metodu `findOne` ile kullanıcıyı bulamıyor
- `findOne` sonucu `null` olduğu için hemen `Invalid credentials` hatası fırlatılıyor
- Bu, kullanıcının hiç olmadığını veya tenant_id'nin uyuşmadığını gösteriyor

**Çözüm Stratejisi:**
1. `npm run seed:dev-users` komutunu çalıştırarak kullanıcıyı oluştur/güncelle
2. Script'in başarılı olduğunu doğrula
3. `npm run smoke:login` komutunu tekrar çalıştır

---

## 7. Sonraki Adımlar (PHASE 1)

1. ✅ Seed script'ini çalıştır (`npm run seed:dev-users`)
2. ✅ Seed script'inin başarılı olduğunu doğrula
3. ✅ `npm run smoke:login` komutunu tekrar çalıştır
4. ✅ Eğer hala başarısızsa, debug script'i ile DB'yi kontrol et
5. ✅ Gerekirse manuel olarak kullanıcı/tenant düzeltmesi yap

---

## 8. Debug Script Kullanımı

**Script:** `backend-nest/scripts/debug-users.ts`

**Kullanım:**
```powershell
cd C:\dev\grc-platform\backend-nest
ts-node -r tsconfig-paths/register scripts/debug-users.ts
```

**Beklenen Çıktı:**
- DB'deki tüm kullanıcıları listeler
- `grc1@local` kullanıcısını bulup bulamadığını gösterir
- Tenant ID eşleşmesini kontrol eder
- Password hash'in varlığını kontrol eder

---

## PHASE 0 Sonuçları

**Tespit Edilen Durum:**
- ❌ `npm run smoke:login` komutu `401 Invalid credentials` hatası veriyor
- ✅ `login-smoke.js` doğru credentials kullanıyor: `grc1@local` / `grc1`
- ✅ `seed-dev-users.ts` script'i doğru kullanıcıyı oluşturmalı
- ❓ DB'de kullanıcının varlığı ve doğruluğu kontrol edilmeli

**Önerilen Çözüm:**
1. `npm run seed:dev-users` komutunu çalıştır
2. Seed script'inin başarılı olduğunu doğrula
3. `npm run smoke:login` komutunu tekrar çalıştır

**PHASE 1'e Geçiş:**
- Seed script'ini çalıştır ve kullanıcıyı oluştur/güncelle
- `npm run smoke:login` komutunu test et
- Başarılı olursa PHASE 2'ye geç

