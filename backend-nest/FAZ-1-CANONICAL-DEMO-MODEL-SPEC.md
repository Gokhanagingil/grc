# FAZ 1 – Kanonik Demo Tenant & Kullanıcı Modeli Tasarımı

**Tarih:** 2024-12-19  
**Amaç:** Seed ve smoke testlerin kullanacağı kanonik demo ortamı modelini tasarlamak

---

## 1. Kanonik Demo Tenant

### 1.1. Tenant Özellikleri

| Özellik | Değer | Açıklama |
|---------|-------|----------|
| **ID** | `217492b2-f814-4ba0-ae50-4e4f8ecf6216` | Sabit GUID (değiştirilmeyecek) |
| **Name** | `Default Tenant` | Görünen isim |
| **Slug** | `default` | URL-friendly identifier |
| **is_active** | `true` | Aktif tenant |

**Not:** Bu tenant ID tüm codebase'de yaygın olarak kullanılıyor ve değiştirilmemeli.

---

## 2. Kanonik Demo Kullanıcılar

### 2.1. GRC Admin User (grc1@local)

| Özellik | Değer | Açıklama |
|---------|-------|----------|
| **Email** | `grc1@local` | Login email (lowercase) |
| **Password (plain)** | `grc1` | Plain text password (hash'lenecek) |
| **Display Name** | `GRC Admin User` | Görünen isim |
| **Roles** | `['admin', 'user']` | JSON array: admin + user rolleri |
| **is_active** | `true` | Aktif kullanıcı |
| **is_email_verified** | `true` | Email doğrulanmış |
| **failed_attempts** | `0` | Başarısız giriş sayacı |
| **locked_until** | `null` | Hesap kilitli değil |
| **mfa_enabled** | `false` | MFA kapalı |

**Kullanım:** Login smoke testleri bu kullanıcıyı kullanır.

### 2.2. GRC Regular User (grc2@local)

| Özellik | Değer | Açıklama |
|---------|-------|----------|
| **Email** | `grc2@local` | Login email (lowercase) |
| **Password (plain)** | `grc2` | Plain text password (hash'lenecek) |
| **Display Name** | `GRC Regular User` | Görünen isim |
| **Roles** | `['user']` | JSON array: sadece user rolü |
| **is_active** | `true` | Aktif kullanıcı |
| **is_email_verified** | `true` | Email doğrulanmış |
| **failed_attempts** | `0` | Başarısız giriş sayacı |
| **locked_until** | `null` | Hesap kilitli değil |
| **mfa_enabled** | `false` | MFA kapalı |

**Kullanım:** İleride role-based permission testleri için kullanılabilir.

---

## 3. Database Schema Gereksinimleri

### 3.1. Tenant Tablosu (`tenant.tenants`)

```sql
CREATE TABLE tenant.tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Demo Tenant Kaydı:**
```json
{
  "id": "217492b2-f814-4ba0-ae50-4e4f8ecf6216",
  "name": "Default Tenant",
  "slug": "default",
  "is_active": true
}
```

### 3.2. User Tablosu (`auth.users`)

```sql
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenant.tenants(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  is_email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret TEXT,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  roles JSON, -- JSON array: ['admin', 'user']
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Index'ler:**
- `idx_users_tenant_entity` on `tenant_id`
- `idx_users_locked_until` on `locked_until`
- Unique constraint on `(tenant_id, email)`

**Demo Kullanıcı Kayıtları:**

1. **grc1@local:**
```json
{
  "id": "<random UUID>",
  "tenant_id": "217492b2-f814-4ba0-ae50-4e4f8ecf6216",
  "email": "grc1@local",
  "password_hash": "<bcrypt hash of 'grc1'>",
  "display_name": "GRC Admin User",
  "is_email_verified": true,
  "is_active": true,
  "mfa_enabled": false,
  "failed_attempts": 0,
  "locked_until": null,
  "roles": ["admin", "user"]
}
```

2. **grc2@local:**
```json
{
  "id": "<random UUID>",
  "tenant_id": "217492b2-f814-4ba0-ae50-4e4f8ecf6216",
  "email": "grc2@local",
  "password_hash": "<bcrypt hash of 'grc2'>",
  "display_name": "GRC Regular User",
  "is_email_verified": true,
  "is_active": true,
  "mfa_enabled": false,
  "failed_attempts": 0,
  "locked_until": null,
  "roles": ["user"]
}
```

---

## 4. Password Hashing Spesifikasyonu

### 4.1. Hashing Algoritması

- **Library:** `bcrypt` (native, C++ binding)
- **Salt Rounds:** Environment variable `BCRYPT_SALT_ROUNDS` (default: `10`)
- **Method:** `bcrypt.hash(plainPassword, saltRounds)`

### 4.2. Verification

- **Method:** `bcrypt.compare(plainPassword, storedHash)`
- **Location:** `src/modules/auth/auth.service.ts`

### 4.3. Örnek Hash'ler

**grc1:**
```typescript
const hash = await bcrypt.hash('grc1', 10);
// Örnek: $2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRST
```

**grc2:**
```typescript
const hash = await bcrypt.hash('grc2', 10);
// Örnek: $2b$10$zyxwvutsrqponmlkjihgfedcba0987654321ZYXWVUTSRQPONMLKJIH
```

**Not:** Her hash benzersizdir (salt kullanıldığı için), ancak aynı plain password her zaman doğru şekilde verify edilir.

---

## 5. Role & Permission Gereksinimleri

### 5.1. Minimum Role Gereksinimleri

**grc1@local (Admin):**
- `admin` rolü: Tüm yetkilere sahip
- `user` rolü: Temel kullanıcı yetkileri

**grc2@local (Regular User):**
- `user` rolü: Temel kullanıcı yetkileri

### 5.2. Permission Kontrolü

**Not:** MVP'de roles JSON array olarak saklanıyor. İleride `auth.user_roles` ve `auth.role_permissions` tablolarına geçilebilir, ancak şu an için JSON array yeterli.

**Smoke Test Senaryoları:**
- Login smoke: Sadece login başarılı olması yeterli (role kontrolü yok)
- Diğer smoke testler: İleride role-based permission kontrolü gerekebilir

---

## 6. Idempotency Gereksinimleri

### 6.1. Seed Script Davranışı

**Tenant:**
- Eğer tenant zaten varsa → Güncelleme yapılmaz (sadece log)
- Eğer tenant yoksa → Oluşturulur

**Kullanıcı:**
- Eğer kullanıcı zaten varsa → **Güncellenir:**
  - `password_hash` güncellenir (her seferinde yeni hash)
  - `display_name` güncellenir
  - `roles` güncellenir
  - `is_active` = `true`
  - `is_email_verified` = `true`
  - `failed_attempts` = `0`
  - `locked_until` = `null`
- Eğer kullanıcı yoksa → Oluşturulur

**Sonuç:** Seed script kaç kez çalıştırılırsa çalıştırılsın, demo tenant ve kullanıcılar tutarlı kalır.

---

## 7. Environment Variables

### 7.1. Gerekli Environment Variables

| Variable | Default | Açıklama |
|----------|---------|----------|
| `DEFAULT_TENANT_ID` | `217492b2-f814-4ba0-ae50-4e4f8ecf6216` | Demo tenant ID |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing salt rounds |
| `SQLITE_FILE` | `data/grc.sqlite` | SQLite DB dosya yolu |

### 7.2. Smoke Test Environment Variables

| Variable | Default | Açıklama |
|----------|---------|----------|
| `SMOKE_USER` | `grc1@local` | Login smoke email |
| `SMOKE_PASS` | `grc1` | Login smoke password |
| `API_BASE` | `http://localhost:5002` | API base URL |

---

## 8. Smoke Test Beklentileri

### 8.1. Login Smoke Test

**Request:**
```http
POST /api/v2/auth/login
Content-Type: application/json
x-tenant-id: 217492b2-f814-4ba0-ae50-4e4f8ecf6216

{
  "email": "grc1@local",
  "password": "grc1"
}
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expiresIn": 900
}
```

**Status Code:** `200` veya `201`

### 8.2. Protected Endpoint Test

**Request:**
```http
GET /api/v2/protected/ping
Authorization: Bearer <access_token>
x-tenant-id: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
```

**Expected Response:**
```json
{
  "ok": true,
  "mod": "auth",
  "ts": "2024-12-19T..."
}
```

**Status Code:** `200`

---

## 9. Postgres Geçişi İçin Notlar

### 9.1. Schema Uyumluluğu

- Tenant ve User entity'leri hem SQLite hem Postgres için aynı şekilde çalışır
- JSON column type: SQLite'da `TEXT`, Postgres'te `JSONB` veya `JSON`
- UUID type: Her iki DB'de de destekleniyor

### 9.2. Seed Script Uyumluluğu

- Seed script'leri `DataSourceOptions` kullanarak hem SQLite hem Postgres'e bağlanabilir
- Password hashing: Her iki DB'de de aynı (bcrypt hash string olarak saklanıyor)

### 9.3. Migration Stratejisi

- Mevcut migration'lar hem SQLite hem Postgres için çalışıyor
- Seed script'leri migration'lardan sonra çalıştırılmalı

---

## 10. Özet

### 10.1. Kanonik Model

✅ **Tenant:** `217492b2-f814-4ba0-ae50-4e4f8ecf6216` (sabit GUID)  
✅ **User 1:** `grc1@local` / `grc1` (roles: `['admin', 'user']`)  
✅ **User 2:** `grc2@local` / `grc2` (roles: `['user']`)  
✅ **Password Hashing:** `bcrypt` (native), salt rounds: `10` (default)  
✅ **Idempotent:** Seed script'leri tekrar çalıştırılabilir

### 10.2. Uyumluluk

✅ **Seed Script:** `seed-dev-users.ts` bu modeli kullanıyor  
✅ **Login Smoke:** `grc1@local` / `grc1` ile test ediyor  
✅ **Tenant ID:** Tüm script'lerde aynı GUID kullanılıyor

---

**FAZ 1 Tamamlandı.** ✅

**Sıradaki Adım:** FAZ 2 – Seed & Reset Alignment (Kod Değişikliği)

