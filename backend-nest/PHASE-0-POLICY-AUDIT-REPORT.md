# PHASE 0: Policy & Audit Durum Fotoğrafı

## Policy Entity vs DB Schema Analizi

### Entity Tanımı (PolicyEntity)
- **Tablo adı**: `policies`
- **Kolonlar**:
  - `id` (uuid, NOT NULL, PK)
  - `tenant_id` (uuid, NOT NULL)
  - `code` (text, NOT NULL)
  - `title` (text, NOT NULL) ⚠️ **Entity'de title var**
  - `status` (text, NOT NULL)
  - `owner_first_name` (text, nullable)
  - `owner_last_name` (text, nullable)
  - `effective_date` (date, nullable)
  - `review_date` (date, nullable)
  - `content` (text, nullable)
  - `created_by` (uuid, nullable)
  - `updated_by` (uuid, nullable)
  - `created_at` (datetime, NOT NULL, auto)
  - `updated_at` (datetime, NOT NULL, auto)

### DB Tablosu (Gerçek Şema)
- **Mevcut kolonlar**:
  - ✅ Yeni kolonlar: `id`, `tenant_id`, `code`, `title`, `status`, `owner_first_name`, `owner_last_name`, `effective_date`, `review_date`, `content`, `created_by`, `updated_by`, `created_at`, `updated_at`
  - ❌ **Eski kolonlar (Entity'de yok)**: `name` (varchar(160), NOT NULL), `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`

### Problem: NOT NULL Constraint Hatası

**Root Cause:**
- DB'de `name` kolonu var ve **NOT NULL**
- Entity'de `name` kolonu yok, sadece `title` var
- Service `title` gönderiyor ama DB `name` bekliyor
- Insert sırasında: `SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name`

**Çözüm Yaklaşımı:**
- Entity'de `title` kullanılıyor (modern, doğru)
- DB'deki eski `name` kolonunu kaldırmak gerekiyor
- Eski kolonları (`name`, `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`) tamamen temizlemek gerekiyor

### DTO vs Entity Uyumu

**CreateGovernancePolicyDto:**
- ✅ `code` (required)
- ✅ `title` (required)
- ✅ `status` (optional, default: 'draft')
- ✅ `owner_first_name` (optional)
- ✅ `owner_last_name` (optional)
- ✅ `effective_date` (optional, string, dd/MM/yyyy format)
- ✅ `review_date` (optional, string, dd/MM/yyyy format)
- ✅ `content` (optional)

**Service Mapping:**
- ✅ DTO → Entity mapping doğru
- ✅ Date parsing (`parseTrDateToIso`) kullanılıyor
- ✅ Status default: 'draft'
- ⚠️ `created_by` ve `updated_by` set edilmiyor (nullable olduğu için sorun değil)

---

## Audit / CAPA / Evidence Envanter

### Entity'ler

#### 1. AuditEngagementEntity
- **Tablo**: `audit_engagements`
- **Alanlar**: `id`, `tenant_id`, `plan_id`, `code`, `name`, `auditee`, `lead_auditor_id`, `status` (enum: planned/in_progress/completed/cancelled)
- **İlişkiler**: 
  - N:1 → AuditPlanEntity
  - 1:N → AuditTestEntity
  - 1:N → AuditFindingEntity

#### 2. AuditTestEntity
- **Tablo**: `audit_tests`
- **Alanlar**: `id`, `tenant_id`, `engagement_id`, `code`, `name`, `objective`, `population_ref`, `clause_id` (optional), `control_id` (optional), `status` (enum: planned/in_progress/passed/failed/skipped)
- **İlişkiler**:
  - N:1 → AuditEngagementEntity
  - N:1 → StandardClauseEntity (optional, `clause_id`)
  - N:1 → ProcessControlEntity (optional, `control_id`)
  - 1:N → AuditEvidenceEntity

#### 3. AuditFindingEntity
- **Tablo**: `audit_findings`
- **Alanlar**: `id`, `tenant_id`, `engagement_id`, `test_id` (optional), `severity` (enum: low/medium/high/critical), `title`, `description`, `details`, `root_cause`, `status` (enum: open/in_progress/closed), `due_date`
- **GRC Links** (optional): `policy_id`, `clause_id`, `control_id`, `risk_instance_id`, `bia_process_id`
- **İlişkiler**:
  - N:1 → AuditEngagementEntity
  - N:1 → AuditTestEntity (optional)
  - 1:N → CorrectiveActionEntity

#### 4. CorrectiveActionEntity
- **Tablo**: `corrective_actions`
- **Alanlar**: `id`, `tenant_id`, `finding_id`, `code`, `title`, `description`, `assignee_user_id`, `due_date`, `status` (enum: open/in_progress/done/cancelled), `closed_at`
- **İlişkiler**:
  - N:1 → AuditFindingEntity

#### 5. AuditEvidenceEntity
- **Tablo**: `audit_evidences`
- **Alanlar**: `id`, `tenant_id`, `test_id`, `type` (enum: document/screenshot/link/note), `related_entity_type`, `related_entity_id`, `file_name`, `file_url`, `uri_or_text`, `note`, `collected_at`, `collected_by`
- **İlişkiler**:
  - N:1 → AuditTestEntity

#### 6. ProcessEntity & ProcessControlEntity
- **Tablo**: `processes`, `process_controls`
- **İlişkiler**: Process 1:N ProcessControl
- **Kullanım**: AuditTestEntity'de `control_id` ile bağlanıyor

### Mevcut Endpoint'ler (AuditLifecycleController)

#### Plans
- ✅ `GET /api/v2/audit/plans` (list)
- ✅ `GET /api/v2/audit/plans/:id` (detail)
- ✅ `POST /api/v2/audit/plans` (create)
- ✅ `PUT /api/v2/audit/plans/:id` (update)
- ✅ `POST /api/v2/audit/plans/:id/archive` (archive)

#### Engagements
- ✅ `GET /api/v2/audit/engagements` (list)
- ✅ `GET /api/v2/audit/engagements/:id` (detail)
- ✅ `POST /api/v2/audit/engagements` (create)
- ✅ `PUT /api/v2/audit/engagements/:id` (update)
- ✅ `GET /api/v2/audit/engagements/:id/summary` (summary)

#### Tests
- ✅ `GET /api/v2/audit/tests` (list)
- ✅ `GET /api/v2/audit/tests/:id` (detail)
- ✅ `POST /api/v2/audit/tests` (create)
- ✅ `PUT /api/v2/audit/tests/:id` (update)
- ❌ **Eksik**: `GET /api/v2/audit/engagements/:id/tests` (engagement'e özel test listesi)

#### Findings
- ✅ `GET /api/v2/audit/findings` (list)
- ✅ `GET /api/v2/audit/findings/:id` (detail)
- ✅ `POST /api/v2/audit/findings` (create)
- ✅ `PUT /api/v2/audit/findings/:id` (update)
- ✅ Link endpoints: policy, clause, control, risk, bia-process
- ❌ **Eksik**: `POST /api/v2/audit/tests/:id/findings` (test'ten finding türetme)

#### Corrective Actions (CAPs)
- ✅ `GET /api/v2/audit/caps` (list)
- ✅ `GET /api/v2/audit/caps/:id` (detail)
- ✅ `POST /api/v2/audit/caps` (create)
- ✅ `PUT /api/v2/audit/caps/:id` (update)
- ✅ `PATCH /api/v2/audit/caps/:id/status` (status transition)
- ❌ **Eksik**: `POST /api/v2/audit/findings/:id/corrective-actions` (finding'ten CAPA türetme)

#### Evidence
- ✅ `GET /api/v2/audit/evidences?test_id=...` (list, test_id filter)
- ✅ `POST /api/v2/audit/evidences` (create)
- ✅ `DELETE /api/v2/audit/evidences/:id` (delete)
- ❌ **Eksik**: `POST /api/v2/audit/tests/:id/evidence` (test'e evidence ekleme)
- ❌ **Eksik**: `POST /api/v2/audit/findings/:id/evidence` (finding'e evidence ekleme)
- ❌ **Eksik**: `POST /api/v2/audit/caps/:id/evidence` (CAPA'ya evidence ekleme)

### Entity İlişki Şeması

```
AuditPlanEntity
  └─ 1:N → AuditEngagementEntity
      ├─ 1:N → AuditTestEntity
      │   └─ 1:N → AuditEvidenceEntity
      └─ 1:N → AuditFindingEntity
          └─ 1:N → CorrectiveActionEntity

AuditTestEntity
  ├─ N:1 → StandardClauseEntity (optional, clause_id)
  └─ N:1 → ProcessControlEntity (optional, control_id)

AuditFindingEntity
  ├─ N:1 → PolicyEntity (optional, policy_id)
  ├─ N:1 → StandardClauseEntity (optional, clause_id)
  ├─ N:1 → ProcessControlEntity (optional, control_id)
  ├─ N:1 → RiskInstanceEntity (optional, risk_instance_id)
  └─ N:1 → BIAProcessEntity (optional, bia_process_id)
```

### Modül Organizasyonu

- **AuditModule**: `src/modules/audit/`
  - `AuditLifecycleController` (tüm endpoint'ler)
  - `AuditLifecycleService` (tüm business logic)
  - Entity'ler: `AuditPlanEntity`, `AuditEngagementEntity`, `AuditTestEntity`, `AuditFindingEntity`, `CorrectiveActionEntity`, `AuditEvidenceEntity`, `ProcessEntity`, `ProcessControlEntity`

---

## Sonuç ve Öneriler

### Policy Create 500
- **Kök sebep**: DB'de `name` kolonu NOT NULL, entity'de yok
- **Çözüm**: Eski kolonları temizlemek, tabloyu yeniden oluşturmak

### Audit / CAPA / Evidence
- **Durum**: Entity'ler ve temel endpoint'ler mevcut
- **Eksikler**: 
  - Test'ten finding türetme endpoint'i
  - Finding'ten CAPA türetme endpoint'i
  - Test/Finding/CAPA'ya evidence ekleme endpoint'leri
  - Engagement'e özel test listesi endpoint'i
- **Frontend**: Henüz yok, oluşturulması gerekiyor

