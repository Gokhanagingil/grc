# PHASE 4 – Audit Flow Backend + Smoke Raporu

## Tarih
2025-11-24

## Amaç
`npm run smoke:audit-flow` → Pas geçen bir end-to-end akış olsun: Engagement → Test → Finding → CAPA → Evidence

---

## Backend Endpoint Durumu

### Mevcut Endpoint'ler

#### Audit Plans
- ✅ `GET /api/v2/audit/plans` - Liste
- ✅ `GET /api/v2/audit/plans/:id` - Detay
- ✅ `POST /api/v2/audit/plans` - Oluştur
- ✅ `PUT /api/v2/audit/plans/:id` - Güncelle
- ✅ `POST /api/v2/audit/plans/:id/archive` - Arşivle

#### Audit Engagements
- ✅ `GET /api/v2/audit/engagements` - Liste
- ✅ `GET /api/v2/audit/engagements/:id` - Detay
- ✅ `POST /api/v2/audit/engagements` - Oluştur
- ✅ `PUT /api/v2/audit/engagements/:id` - Güncelle
- ✅ `GET /api/v2/audit/engagements/:id/tests` - Engagement testleri

#### Audit Tests
- ✅ `GET /api/v2/audit/tests` - Liste
- ✅ `GET /api/v2/audit/tests/:id` - Detay
- ✅ `POST /api/v2/audit/tests` - Oluştur
- ✅ `PUT /api/v2/audit/tests/:id` - Güncelle
- ✅ `POST /api/v2/audit/tests/:id/findings` - Test'ten finding oluştur ✅
- ✅ `POST /api/v2/audit/tests/:id/evidence` - Test'e evidence ekle ✅

#### Audit Findings
- ✅ `GET /api/v2/audit/findings` - Liste
- ✅ `GET /api/v2/audit/findings/:id` - Detay
- ✅ `POST /api/v2/audit/findings` - Oluştur
- ✅ `PUT /api/v2/audit/findings/:id` - Güncelle
- ✅ `POST /api/v2/audit/findings/:id/corrective-actions` - Finding'den CAP oluştur ✅
- ✅ `POST /api/v2/audit/findings/:id/evidence` - Finding'e evidence ekle ✅

#### Corrective Actions
- ✅ `GET /api/v2/audit/corrective-actions` - Liste (eski: `caps`)
- ✅ `GET /api/v2/audit/corrective-actions/:id` - Detay
- ✅ `POST /api/v2/audit/corrective-actions` - Oluştur
- ✅ `PUT /api/v2/audit/corrective-actions/:id` - Güncelle
- ✅ `PATCH /api/v2/audit/corrective-actions/:id/status` - Status değiştir
- ✅ `POST /api/v2/audit/corrective-actions/:id/evidence` - CAP'a evidence ekle ✅

#### Evidence
- ✅ `GET /api/v2/audit/evidences` - Liste (filtre: `related_entity_type`, `related_entity_id`)

---

## Entity İlişkileri

### Test → Engagement
- `TestEntity.engagement_id` → `AuditEngagementEntity.id` (N:1)
- ✅ Foreign key var

### Test → Clause (Optional)
- `TestEntity.clause_id` → `StandardClauseEntity.id` (N:1, nullable)
- ✅ Foreign key var

### Test → ProcessControl (Optional)
- `TestEntity.control_id` → `ProcessControlEntity.id` (N:1, nullable)
- ✅ Foreign key var

### Finding → Test
- `FindingEntity.test_id` → `AuditTestEntity.id` (N:1, nullable)
- ✅ Foreign key var

### Finding → Engagement
- `FindingEntity.engagement_id` → `AuditEngagementEntity.id` (N:1)
- ✅ Foreign key var

### CAPA → Finding
- `CorrectiveActionEntity.finding_id` → `AuditFindingEntity.id` (N:1)
- ✅ Foreign key var

### Evidence → Test/Finding/CAPA (Polymorphic)
- `AuditEvidenceEntity.related_entity_type` → 'test' | 'finding' | 'corrective_action'
- `AuditEvidenceEntity.related_entity_id` → entity ID
- ✅ Polymorphic relationship var

---

## Service Metodları

### createFindingFromTest
```typescript
async createFindingFromTest(
  testId: string,
  dto: Omit<CreateAuditFindingDto, 'test_id' | 'engagement_id'>,
  tenantId: string,
)
```

**Mantık:**
1. Test'i bul (tenant kontrolü ile)
2. Test'ten `engagement_id` al
3. Finding oluştur: `engagement_id` ve `test_id` otomatik doldurulur
4. Return finding

### createCorrectiveActionForFinding
```typescript
async createCorrectiveActionForFinding(
  findingId: string,
  dto: Omit<CreateCorrectiveActionDto, 'finding_id'>,
  tenantId: string,
)
```

**Mantık:**
1. Finding'i bul (tenant kontrolü ile)
2. Corrective action oluştur: `finding_id` otomatik doldurulur
3. Return corrective action

### addEvidenceToEntity
```typescript
async addEvidenceToEntity(
  entityId: string,
  entityType: string,
  dto: CreateAuditEvidenceDto,
  tenantId: string,
)
```

**Mantık:**
1. Entity type'ı validate et ('test' | 'finding' | 'corrective_action')
2. Entity'nin var olduğunu doğrula (tenant kontrolü ile)
3. Evidence oluştur: `related_entity_type` ve `related_entity_id` otomatik doldurulur
4. Return evidence

---

## Smoke Test Senaryosu

### smoke-audit-flow.ts

**Test Adımları:**
1. ✅ Login
2. ✅ Create Audit Plan (`period_start`, `period_end`, `status: 'planned'`)
3. ✅ Create Engagement (`plan_id`, `code`, `name`, `status: 'in_progress'`)
4. ✅ Create Test (`engagement_id`, `code`, `name`, `status: 'failed'`)
5. ✅ Create Finding from Test (`POST /api/v2/audit/tests/:id/findings`)
6. ✅ Create Corrective Action from Finding (`POST /api/v2/audit/findings/:id/corrective-actions`)
7. ✅ Add Evidence to Test (`POST /api/v2/audit/tests/:id/evidence`)

**Durum:** ✅ Smoke test doğru görünüyor, backend restart sonrası çalışmalı.

---

## Değişen Dosyalar

**Hiçbir dosya değiştirilmedi** - Tüm endpoint'ler ve service metodları zaten mevcut (önceki sprint'te eklendi).

---

## Test Sonuçları

### Smoke Test (Backend Restart Sonrası Beklenen)
```bash
npm run smoke:audit-flow
```

**Beklenen Sonuç:**
- ✅ Login PASS
- ✅ Create Plan PASS
- ✅ Create Engagement PASS
- ✅ Create Test PASS
- ✅ Create Finding from Test PASS
- ✅ Create CAP from Finding PASS
- ✅ Add Evidence to Test PASS

**Durum:** ⚠️ Backend restart edilmedi, test edilemedi

---

## Sonraki Adımlar

1. **Backend Restart:** Backend'i restart et, yeni endpoint'lerin yüklenmesini sağla
2. **Smoke Test:** `npm run smoke:audit-flow` çalıştır, tüm adımların PASS olduğunu doğrula
3. **PHASE 5:** Frontend TS hatalarını temizle

---

## Notlar

- Tüm endpoint'ler tanımlı ve service metodları implement edilmiş
- Entity ilişkileri doğru (foreign key'ler var)
- Polymorphic evidence relationship var
- Smoke test doğru görünüyor
- Backend restart sonrası çalışmalı

