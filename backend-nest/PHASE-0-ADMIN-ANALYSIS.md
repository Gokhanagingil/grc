# PHASE 0 – Admin Panel MVP Analiz Raporu

**Date:** 2025-01-27  
**Status:** ✅ COMPLETED

## Mevcut Durum Analizi

### 1. Auth & Role Yapısı

**JWT Strategy (`jwt.strategy.ts`):**
- JWT payload'da `roles?: string[]` field'ı var
- `validate()` method'u `roles: payload.roles ?? ['user']` döndürüyor
- Default role: `'user'` (eğer payload'da yoksa)

**Auth Service (`auth.service.ts`):**
- `login()` method'unda: `const roles = ['admin']; // TODO: derive from role assignments`
- **ÖNEMLİ:** Şu an tüm kullanıcılara hardcoded `'admin'` rolü atanıyor
- **TODO:** Roller user entity'den veya role assignment tablosundan alınmalı

**JWT Guard (`jwt.guard.ts`):**
- JWT token validation yapıyor
- `request.user` objesini set ediyor (userId, email, roles, tenantId içerir)

**Admin Guard (`admin/guards/admin.guard.ts`):**
- ✅ **MEVCUT:** AdminGuard zaten var!
- `user.roles` array'inde `'admin'` rolü kontrol ediliyor
- `ForbiddenException` fırlatıyor eğer admin değilse

### 2. User Entity

**UserEntity (`entities/auth/user.entity.ts`):**
- `id` (UUID, primary)
- `tenant_id` (UUID, foreign key to TenantEntity)
- `email` (unique, case-insensitive)
- `password_hash`
- `display_name`
- `is_email_verified`
- `is_active`
- `mfa_enabled`, `mfa_secret`
- `failed_attempts`, `locked_until`
- `created_at`, `updated_at`
- **ÖNEMLİ:** `roles` field'ı YOK! Roller sadece JWT payload'da taşınıyor.

### 3. Tenant Entity

**TenantEntity (`entities/tenant/tenant.entity.ts`):**
- ✅ **MEVCUT:** TenantEntity var
- `id` (UUID, primary)
- `name` (unique)
- `slug` (unique)
- `is_active`
- `created_at`, `updated_at`

### 4. Mevcut Admin Modülü

**AdminModule (`modules/admin/`):**
- ✅ **MEVCUT:** AdminModule zaten var!
- `admin.module.ts` - Module tanımı (UserEntity, TenantEntity, PolicyEntity, RequirementEntity, BCM entities, RiskCatalogEntity import edilmiş)
- `admin.controller.ts` - Controller (2 endpoint: health, summary)
- `admin.service.ts` - Service (summary ve health methodları, entity count'ları yapıyor)
- `guards/admin.guard.ts` - AdminGuard (rol kontrolü)

**Mevcut Endpoint'ler:**
- `GET /api/v2/admin/health` - Health check
- `GET /api/v2/admin/summary` - System statistics (users, tenants, policies, requirements, BCM, risk catalog counts)

**AdminGuard:**
- `@UseGuards(JwtAuthGuard, AdminGuard)` ile kullanılıyor
- `user.roles.includes('admin')` kontrolü yapıyor
- ✅ **ÇALIŞIYOR:** Mevcut yapı korunacak

### 5. Role & Permission Entities

**RoleEntity (`entities/auth/role.entity.ts`):**
- ✅ **MEVCUT:** RoleEntity var
- `id` (UUID, primary)
- `tenant_id` (UUID, foreign key)
- `name` (text, unique per tenant)
- `description` (text, nullable)
- `is_system` (boolean, default false)
- `created_at`, `updated_at`

**PermissionEntity (`entities/auth/permission.entity.ts`):**
- ✅ **MEVCUT:** PermissionEntity var
- `id` (UUID, primary)
- `code` (text, unique)
- `description` (text, nullable)
- `created_at`, `updated_at`

**Not:** User-Role assignment tablosu yok. MVP için UserEntity'ye `roles` JSON field ekleyeceğiz.

### 6. Mevcut Modüller

**GRC Modülleri:**
- ✅ Governance (Policy)
- ✅ Compliance (Requirement)
- ✅ BCM (BIA Process, BCP Plan, BCP Exercise)
- ✅ Risk (Risk Catalog)
- ✅ Audit
- ✅ Users
- ✅ Auth

**Entity'ler:**
- `PolicyEntity`
- `RequirementEntity`
- `BIAProcessEntity`, `BCPPlanEntity`, `BCPExerciseEntity`
- `RiskCatalogEntity`
- `UserEntity`
- `TenantEntity`

### 7. Smoke Testler

**Mevcut Smoke Testler:**
- ✅ `npm run health:probe` - Health endpoint testi
- ✅ `npm run smoke:login` - Login ve protected endpoint testi
- ✅ `npm run smoke:modules` - Tüm modül smoke testleri (policies, requirements, bcm)
- ✅ `npm run smoke:admin` - Admin smoke testi (script mevcut)

### 8. API Prefix & Routing

**API Yapısı:**
- Global prefix: `/api/v2` (korunmalı)
- Admin prefix: `/api/v2/admin` (mevcut)
- Versioning: URI-based (`/api/v2/...`)

## Kritik Noktalar (KIRILMAMALI)

### 1. Login Endpoint
- ✅ `POST /api/v2/auth/login` - Çalışıyor, değiştirilmemeli
- ✅ JWT token generation - Çalışıyor, değiştirilmemeli
- ✅ Token TTL (15 dakika access, 7 gün refresh) - Çalışıyor

### 2. JWT & Auth Flow
- ✅ `JwtAuthGuard` - Çalışıyor, değiştirilmemeli
- ✅ `JwtStrategy` - Çalışıyor, değiştirilmemeli
- ✅ `request.user` objesi - Çalışıyor, format değiştirilmemeli

### 3. API Prefix
- ✅ `/api/v2` - Korunmalı, değiştirilmemeli
- ✅ `/api/v2/admin` - Mevcut, genişletilebilir

### 4. Mevcut Modüller
- ✅ Governance, Compliance, BCM, Risk modülleri - Çalışıyor, değiştirilmemeli
- ✅ CRUD endpoint'leri - Çalışıyor, değiştirilmemeli

### 5. Database
- ✅ SQLite (`data/grc.sqlite`) - Korunmalı, silinmemeli
- ✅ Mevcut entity'ler - Schema değişikliği minimal olmalı

## Eksikler & Yapılacaklar

### 1. User Roles Storage
- ✅ RoleEntity var (`entities/auth/role.entity.ts`)
- ❌ UserEntity'de `roles` field'ı yok
- ❌ User-Role assignment tablosu yok (Many-to-Many ilişki yok)
- **Çözüm:** 
  - Option A: UserEntity'ye `roles` JSON field ekle (basit, MVP için yeterli)
  - Option B: UserRoleAssignment entity oluştur (daha esnek, ama karmaşık)
  - **MVP için:** Option A (JSON field) yeterli - Roller string array olarak saklanacak

### 2. Admin User Management
- ❌ `GET /api/v2/admin/users` - YOK
- ❌ `POST /api/v2/admin/users` - YOK
- ❌ `PATCH /api/v2/admin/users/:id` - YOK
- ❌ `GET /api/v2/admin/tenants` - YOK

### 3. Dictionary/Lookup System
- ❌ DictionaryGroup entity - YOK
- ❌ DictionaryItem entity - YOK
- ❌ Admin dictionary endpoint'leri - YOK

### 4. Code Generator
- ❌ CodePattern entity - YOK
- ❌ CodeGeneratorService - YOK
- ❌ Admin code pattern endpoint'leri - YOK

### 5. Frontend Admin UI
- ❌ `/admin` route - YOK
- ❌ Admin layout/component'ler - YOK
- ❌ Role-based route guard - YOK

### 6. ListViewConfig
- ❌ ListViewConfig entity - YOK
- ❌ Admin list view config endpoint'leri - YOK

## Admin Panelinin Oturma Yeri

**Backend:**
- Mevcut `/api/v2/admin` prefix'i altında genişletilecek
- Yeni endpoint'ler:
  - `/api/v2/admin/users` - User management
  - `/api/v2/admin/tenants` - Tenant management
  - `/api/v2/admin/dictionaries` - Dictionary management
  - `/api/v2/admin/code-patterns` - Code pattern management
  - `/api/v2/admin/list-configs` - List view config management

**Frontend:**
- `/admin` route'u oluşturulacak
- Mevcut Layout component'ine admin menü item'ı eklenecek (sadece admin kullanıcılar için)
- Admin alt route'ları:
  - `/admin` - Overview/Dashboard
  - `/admin/users` - User management
  - `/admin/dictionaries` - Dictionary management
  - `/admin/code-patterns` - Code pattern management
  - `/admin/system` - System/Logs

## Sonraki Adımlar

1. **PHASE 1:** Admin modülü zaten var, sadece genişletilecek
2. **PHASE 2:** User management endpoint'leri eklenecek
3. **PHASE 3:** Dictionary system oluşturulacak
4. **PHASE 4:** Code generator altyapısı eklenecek
5. **PHASE 5:** Frontend admin UI oluşturulacak
6. **PHASE 6:** ListViewConfig altyapısı hazırlanacak

## Notlar

- Mevcut AdminModule yapısı iyi, sadece genişletilecek
- AdminGuard çalışıyor, kullanılmaya devam edilecek
- User roles şu an JWT'de hardcoded 'admin', entity'ye taşınmalı
- Tüm değişiklikler mevcut yapıyı bozmadan yapılacak

---

**Hazırlayan:** AI Assistant  
**Tarih:** 2025-01-27
