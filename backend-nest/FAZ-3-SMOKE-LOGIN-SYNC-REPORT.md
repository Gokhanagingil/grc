# FAZ 3 – Smoke Login Senkronizasyonu Raporu

**Tarih:** 2024-12-19  
**Amaç:** Login smoke script'lerini kanonik demo model ile senkronize etmek

---

## 1. Yapılan Değişiklikler

### 1.1. `scripts/login-smoke.js` (Root Scripts)

**Değişiklikler:**
1. ✅ **Dokümantasyon eklendi:** Script başına canonical model açıklaması
2. ✅ **Loglama iyileştirildi:**
   - Daha açıklayıcı başlık ve format
   - Hata durumlarında troubleshooting ipuçları
   - Başarı durumlarında net mesajlar

**Kanonik Değerler (Değişmedi):**
- **Email:** `grc1@local` (env: `SMOKE_USER`)
- **Password:** `grc1` (env: `SMOKE_PASS`)
- **Tenant ID:** `217492b2-f814-4ba0-ae50-4e4f8ecf6216` (env: `DEFAULT_TENANT_ID`)

**Log Çıktısı Örneği:**
```
=== Login Smoke Test ===

[SMOKE] Login request details:
  Email: grc1@local
  Tenant ID: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
  URL: http://localhost:5002/api/v2/auth/login

✅ PASS LOGIN
[SMOKE][DEBUG] Token payload:
  sub: <user-id>
  email: grc1@local
  ...
✅ PASS PROTECTED

=== Login Smoke Test: PASSED ===
```

**Hata Durumunda:**
```
❌ FAIL LOGIN
   Status: 401
   Response: { message: "Invalid credentials" }

💡 Troubleshooting:
   1. Ensure server is running: npm run start:dev
   2. Ensure database is seeded: npm run seed:dev-users
   3. Verify tenant ID matches: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
   4. Verify user exists: grc1@local / grc1
```

---

## 2. Uyumluluk Kontrolü

### 2.1. Seed Script ile Uyumluluk

| Özellik | Login Smoke | Seed Script | Durum |
|---------|-------------|-------------|-------|
| Tenant ID | `217492b2-f814-4ba0-ae50-4e4f8ecf6216` | `217492b2-f814-4ba0-ae50-4e4f8ecf6216` | ✅ |
| Email | `grc1@local` | `grc1@local` | ✅ |
| Password | `grc1` | `grc1` | ✅ |

**Sonuç:** Tam uyumlu ✅

### 2.2. Diğer Smoke Script'ler

**Not:** `backend-nest/scripts/login-smoke.ps1` ve `.sh` script'leri zaten doğru değerleri kullanıyor ve değiştirilmedi (PowerShell/Bash wrapper'lar).

---

## 3. Test Senaryoları

### 3.1. Başarılı Senaryo

1. `npm run db:reset:dev` → Database reset + seed
2. `npm run start:dev` → Server başlat
3. `npm run smoke:login` → Login smoke test

**Beklenen:** `✅ PASS LOGIN` + `✅ PASS PROTECTED`

### 3.2. Hata Senaryoları

**401 Invalid credentials:**
- Kullanıcı yoksa veya password hash uyumsuzsa
- Troubleshooting ipuçları gösterilir

**400 Tenant context required:**
- Tenant ID header eksik veya yanlışsa
- Troubleshooting ipuçları gösterilir

---

## 4. Sonuç

✅ **Login smoke script'i kanonik demo model ile senkronize edildi.**  
✅ **Loglama iyileştirildi ve troubleshooting ipuçları eklendi.**  
✅ **Seed script ile tam uyumlu.**

---

**FAZ 3 Tamamlandı.** ✅

**Sıradaki Adım:** FAZ 4 – Reset + Smoke End-to-End Doğrulama

