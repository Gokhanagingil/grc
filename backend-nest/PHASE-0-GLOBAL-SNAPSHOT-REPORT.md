# PHASE 0 – Global Snapshot Report

## Tarih
2025-11-24

## Amaç
Mevcut durumu analiz etmek, uyumsuzlukları tespit etmek, ancak hiçbir değişiklik yapmamak.

---

## 1. Policy Create 500 Hatası Analizi

### Entity ↔ DB Şeması ↔ DTO ↔ Smoke Script Uyumsuzlukları

#### PolicyEntity (backend-nest/src/entities/app/policy.entity.ts)
- **Kolonlar:**
  - `id` (uuid, NOT NULL)
  - `tenant_id` (uuid, NOT NULL)
  - `code` (text, NOT NULL)
  - `title` (text, NOT NULL) ✅
  - `status` (text, NOT NULL)
  - `owner_first_name` (text, nullable)
  - `owner_last_name` (text, nullable)
  - `effective_date` (date, nullable)
  - `review_date` (date, nullable)
  - `content` (text, nullable)
  - `created_by` (uuid, nullable)
  - `updated_by` (uuid, nullable)
  - `created_at` (datetime, NOT NULL)
  - `updated_at` (datetime, NOT NULL)

#### Gerçek SQLite Şeması (check:policy-schema çıktısı)
- **Entity'de olan ama DB'de olmayan:** (yok)
- **DB'de olan ama Entity'de olmayan:**
  - `name` (varchar(160), NOT NULL) ❌ **KRİTİK**
  - `description` (TEXT, nullable)
  - `owner` (varchar(80), nullable)
  - `version` (varchar(32), nullable)
  - `effectiveDate` (date, nullable) - camelCase
  - `reviewDate` (date, nullable) - camelCase
  - `tags` (TEXT, nullable)
  - `createdAt` (datetime, NOT NULL) - camelCase
  - `updatedAt` (datetime, NOT NULL) - camelCase
  - `deletedAt` (datetime, nullable) - camelCase

**Kritik Bulgu:** DB'de `name` kolonu NOT NULL olarak mevcut, ama Entity'de yok. Entity `title` kullanıyor. Service `dto.title` kullanıyor, bu yüzden insert sırasında `name` kolonu NULL kalmaya çalışıyor ve NOT NULL constraint hatası veriyor.

#### CreateGovernancePolicyDto (backend-nest/src/modules/governance/dto/create-policy.dto.ts)
- ✅ `code` (string, required)
- ✅ `title` (string, required)
- ✅ `status` (optional, default: 'draft')
- ✅ `owner_first_name` (optional)
- ✅ `owner_last_name` (optional)
- ✅ `effective_date` (optional, string dd/MM/yyyy)
- ✅ `review_date` (optional, string dd/MM/yyyy)
- ✅ `content` (optional)

**Uyumluluk:** DTO Entity ile uyumlu, `title` kullanıyor.

#### GovernanceService.create() (backend-nest/src/modules/governance/governance.service.ts)
- ✅ `dto.title` → `policy.title` mapping doğru
- ✅ `dto.status || 'draft'` default değer var
- ✅ Tarih parsing (`parseTrDateToIso`) kullanılıyor

**Uyumluluk:** Service doğru çalışıyor, Entity ile uyumlu.

#### smoke-policies.ts
- ✅ Payload: `{ code, title, status: 'draft' }` - doğru
- ✅ Endpoint: `POST /api/v2/governance/policies` - doğru

**Kök Sebep:**
1. DB'de eski şema var (`name` NOT NULL, camelCase kolonlar)
2. Entity yeni şemayı kullanıyor (`title`, snake_case)
3. Service Entity'ye göre çalışıyor, DB'ye insert ederken `name` kolonu NULL kalıyor
4. NOT NULL constraint hatası: `SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name`

**Çözüm Stratejisi:**
- `fix-policy-schema.ts` script'i legacy kolonları tespit ediyor ama tabloyu drop ediyor
- Daha güvenli yaklaşım: geçici tablo oluştur, veriyi taşı, eski tabloyu drop et, yenisini rename et
- İkinci kez çalıştırıldığında idempotent olmalı (legacy kolonlar yoksa hiçbir şey yapmamalı)

---

## 2. BCM "Validation failed" Analizi

### DTO'lar ve Validation

#### PaginationDto (backend-nest/src/common/search/pagination.dto.ts)
- ✅ `page?: number` - `@Min(0)`, `@Type(() => Number)`, `@IsInt()`
- ✅ `pageSize?: number` - `@Min(1)`, `@Max(1000)`, `@Type(() => Number)`, `@IsInt()`
- ✅ `parsePagination` fonksiyonu `page=0` durumunu handle ediyor (`Math.max(pageNum, 1)`)

**Durum:** PaginationDto zaten güncellenmiş, `@Min(0)` var.

#### QueryBIAProcessDto (backend-nest/src/modules/bcm/dto/query-bcm.dto.ts)
- ✅ `extends PaginationDto` - PaginationDto'dan `page` ve `pageSize` alıyor
- ✅ `@Type(() => Number)` decorator'ları var

**Durum:** DTO doğru görünüyor.

#### NormalizationPipe (backend-nest/src/common/pipes/normalization/normalization.pipe.ts)
- ✅ Empty string → undefined normalizasyonu var
- ✅ Numeric alanlar için özel bir normalizasyon yok (sadece empty string → undefined)
- ⚠️ Query parametreleri için `@Type(() => Number)` gerekli (zaten var)

**Tahmini Root Cause:**
- Frontend `page=0&pageSize=20` gönderiyor
- NormalizationPipe query parametrelerini normalize ediyor mu? (Kontrol edilmeli)
- ValidationPipe `@Type(() => Number)` ile string'i number'a çeviriyor mu? (Kontrol edilmeli)
- Eğer `page=0` string olarak kalırsa ve `@Min(0)` number bekliyorsa validation fail olabilir

**Çözüm Stratejisi:**
- NormalizationPipe query parametrelerini de normalize etmeli (string "0" → number 0)
- Veya DTO'da `@Type(() => Number)` zaten var, ValidationPipe transform etmeli
- `smoke-bcm-processes.ts` ile test edilmeli

---

## 3. Standards Seed UNIQUE Constraint Hatası

### Entity Unique Index

#### StandardClauseEntity (backend-nest/src/entities/app/standard-clause.entity.ts)
```typescript
@Index('idx_standard_clause_code_tenant', ['standard_id', 'clause_code', 'tenant_id'], {
  unique: true,
})
```

**Durum:** ✅ Unique index doğru - `(standard_id, clause_code, tenant_id)` kombinasyonu unique.

### Seed Script (backend-nest/scripts/seed-standards.ts)

#### Mevcut Mantık:
```typescript
let clause = await clauseRepo.findOne({
  where: {
    clause_code: clauseData.clause_code,
    tenant_id: tenantId,
    standard_id: standard.id,  // ✅ standard_id kontrolü var
  },
});
```

**Durum:** ✅ Seed script'te `standard_id` kontrolü var, bu doğru.

#### Sorun:
- ISO27001 ve ISO20000'de aynı `clause_code` değerleri var (örn: `5.1`)
- Unique index `(standard_id, clause_code, tenant_id)` olduğu için bu sorun değil
- Ama seed script ikinci kez çalıştırıldığında UNIQUE constraint hatası veriyor

**Tahmini Root Cause:**
- Seed script'te `findOne` kontrolü var ama yeterli değil
- Belki transaction içinde çalışmıyor, race condition olabilir
- Veya `findOne` sonucu `null` döndüğünde insert yapıyor ama aynı anda iki kez çalıştırılırsa duplicate insert olabilir

**Çözüm Stratejisi:**
- Seed script'i idempotent yap: `findOne` → varsa `update`, yoksa `insert`
- Veya `save` kullan (upsert gibi davranır)
- Transaction kullan (race condition'ı önler)

---

## 4. Audit / CAPA / Evidence Durumu

### Backend Endpoint'leri

#### AuditLifecycleController (backend-nest/src/modules/audit/audit-lifecycle.controller.ts)

**Mevcut Endpoint'ler:**
- ✅ `GET /api/v2/audit/plans` - Liste
- ✅ `GET /api/v2/audit/plans/:id` - Detay
- ✅ `POST /api/v2/audit/plans` - Oluştur
- ✅ `PUT /api/v2/audit/plans/:id` - Güncelle
- ✅ `POST /api/v2/audit/plans/:id/archive` - Arşivle
- ✅ `GET /api/v2/audit/engagements` - Liste
- ✅ `GET /api/v2/audit/engagements/:id` - Detay
- ✅ `POST /api/v2/audit/engagements` - Oluştur
- ✅ `PUT /api/v2/audit/engagements/:id` - Güncelle
- ✅ `GET /api/v2/audit/engagements/:id/tests` - Engagement testleri
- ✅ `GET /api/v2/audit/tests` - Liste
- ✅ `GET /api/v2/audit/tests/:id` - Detay
- ✅ `POST /api/v2/audit/tests` - Oluştur
- ✅ `PUT /api/v2/audit/tests/:id` - Güncelle
- ✅ `POST /api/v2/audit/tests/:id/findings` - Test'ten finding oluştur ✅
- ✅ `POST /api/v2/audit/tests/:id/evidence` - Test'e evidence ekle ✅
- ✅ `GET /api/v2/audit/findings` - Liste
- ✅ `GET /api/v2/audit/findings/:id` - Detay
- ✅ `POST /api/v2/audit/findings` - Oluştur
- ✅ `PUT /api/v2/audit/findings/:id` - Güncelle
- ✅ `POST /api/v2/audit/findings/:id/corrective-actions` - Finding'den CAP oluştur ✅
- ✅ `POST /api/v2/audit/findings/:id/evidence` - Finding'e evidence ekle ✅
- ✅ `GET /api/v2/audit/corrective-actions` - Liste (eski: `caps`)
- ✅ `GET /api/v2/audit/corrective-actions/:id` - Detay
- ✅ `POST /api/v2/audit/corrective-actions` - Oluştur
- ✅ `PUT /api/v2/audit/corrective-actions/:id` - Güncelle
- ✅ `PATCH /api/v2/audit/corrective-actions/:id/status` - Status değiştir
- ✅ `POST /api/v2/audit/corrective-actions/:id/evidence` - CAP'a evidence ekle ✅
- ✅ `GET /api/v2/audit/evidences` - Liste (filtre: `related_entity_type`, `related_entity_id`)

**Durum:** ✅ Tüm endpoint'ler tanımlı.

#### AuditLifecycleService
- ✅ Tüm metodlar implement edilmiş
- ✅ `createFindingFromTest`, `addEvidenceToEntity`, `createCorrectiveActionForFinding` metodları var

#### smoke-audit-flow.ts
- ✅ Test senaryosu: Plan → Engagement → Test → Finding → CAP → Evidence
- ⚠️ Son çalıştırmada 404 hatası aldı (`POST /api/v2/audit/tests/:id/findings`)
- **Tahmini Sebep:** Backend restart edilmedi, yeni endpoint'ler yüklenmemiş olabilir

**Durum:** Backend tarafı hazır, backend restart sonrası çalışmalı.

---

## 5. Frontend TypeScript Hataları

### Standards.tsx (frontend/src/pages/Standards.tsx)
- ❌ `Paper` import edilmiş ama kullanılmamış (satır 25'te yok, kontrol edilmeli)
- ❌ `DescriptionIcon` import edilmiş ama kullanılmamış (satır 29'ta yok, kontrol edilmeli)

**Durum:** Import'lar var ama kullanılmamış, TS6133 hatası verebilir.

### PolicyCreateForm.tsx (frontend/src/components/PolicyCreateForm.tsx)
- ⚠️ Satır 84: `sorted[0]!.code` - non-null assertion kullanılmış ama `sorted.length > 0` kontrolü var, bu yeterli
- ⚠️ Satır 89-117: Fallback status options'da `tenantId: ''` var ama `AdminDictionary` tipinde `tenantId: string | null` olabilir
- ⚠️ `sorted[0]` için null check yok (ama non-null assertion var, bu riskli)

**Durum:** 
- `sorted[0]!.code` kullanımı riskli, `sorted.length > 0` kontrolü var ama TypeScript bunu görmüyor olabilir
- Fallback options'da `tenantId: ''` yerine `tenantId: null` olmalı

---

## Özet

### Policy Create 500
- **Kök Sebep:** DB'de `name` kolonu NOT NULL, Entity'de yok, Service `title` kullanıyor
- **Çözüm:** `fix-policy-schema.ts` script'ini idempotent hale getir, geçici tablo yaklaşımı kullan

### BCM Validation Failed
- **Kök Sebep:** Query parametreleri normalization/transformation sorunu olabilir
- **Çözüm:** NormalizationPipe query parametrelerini normalize etmeli, smoke test ile doğrula

### Standards Seed UNIQUE
- **Kök Sebep:** Seed script idempotent değil, race condition olabilir
- **Çözüm:** `save` kullan (upsert), transaction kullan

### Audit Flow
- **Durum:** Backend hazır, frontend hazır, backend restart gerekli

### Frontend TS Hataları
- **Standards.tsx:** Kullanılmayan import'lar kaldırılmalı
- **PolicyCreateForm.tsx:** `sorted[0]` için güvenli guard, fallback options'da `tenantId: null`

---

## Sonraki Adımlar

1. **PHASE 1:** Policy create 500 fix - DB şemasını hizala
2. **PHASE 2:** BCM validation failed fix - DTO ve normalization kontrolü
3. **PHASE 3:** Standards seed idempotent hale getir
4. **PHASE 4:** Audit flow backend + smoke test
5. **PHASE 5:** Frontend TS hatalarını temizle
6. **PHASE 6:** Remote demo & API unreachable
7. **PHASE 7:** Global bootstrap & smoke

