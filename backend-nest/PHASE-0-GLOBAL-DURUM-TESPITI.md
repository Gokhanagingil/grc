# PHASE 0 - Global Durum Tespiti Raporu

## Özet
Backend yapısı analiz edildi. Modüller, entity'ler ve DB konfigürasyonu haritalandırıldı.

## Modül Yapısı

### Ana Modüller

1. **Governance** (`src/modules/governance/`)
   - Controller: `governance.controller.ts`
   - Service: `governance.service.ts`
   - Entity: `PolicyEntity` (entities/app/policy.entity.ts)
   - DTO: `CreateGovernancePolicyDto`, `UpdateGovernancePolicyDto`, `QueryPolicyDto`
   - Endpoint: `/api/v2/governance/policies`

2. **Compliance** (`src/modules/compliance/`)
   - Controller: `comp.controller.ts`
   - Service: `comp.service.ts`
   - Entity: `RequirementEntity` (comp.entity.ts)
   - DTO: `CreateRequirementDto`, `UpdateRequirementDto`, `QueryRequirementDto`
   - Endpoint: `/api/v2/compliance/requirements`

3. **BCM** (`src/modules/bcm/`)
   - Controller: `bcm.controller.ts`
   - Service: `bcm.service.ts`
   - Entities:
     - `BIAProcessEntity` (entities/app/bia-process.entity.ts)
     - `BIAProcessDependencyEntity` (entities/app/bia-process-dependency.entity.ts)
     - `BCPPlanEntity` (entities/app/bcp-plan.entity.ts)
     - `BCPExerciseEntity` (entities/app/bcp-exercise.entity.ts)
   - DTO: `CreateBIAProcessDto`, `CreateBCPPlanDto`, `CreateBCPExerciseDto`
   - Endpoint: `/api/v2/bcm/*`

4. **Audit** (`src/modules/audit/`)
   - Controller: `audit.controller.ts`, `audit-lifecycle.controller.ts`
   - Service: `audit.service.ts`, `audit-lifecycle.service.ts`
   - Entities:
     - `AuditPlanEntity`
     - `AuditEngagementEntity`
     - `AuditTestEntity`
     - `AuditEvidenceEntity`
     - `AuditFindingEntity`
     - `CorrectiveActionEntity`
   - Endpoint: `/api/v2/audit/*`

5. **Risk** (`src/modules/risk/`)
   - Controller: `risk.controller.ts`, `risk-catalog.controller.ts`
   - Service: `risk.service.ts`
   - Entities:
     - `RiskCatalogEntity`
     - `RiskCategoryEntity`
     - `RiskInstanceEntity`
   - Endpoint: `/api/v2/risk/*`

6. **Data Foundation** (`src/modules/data-foundation/`)
   - Controller: `data-foundation.controller.ts`
   - Service: `data-foundation.service.ts`
   - Entities: `StandardEntity`, `StandardClauseEntity`, `ControlLibraryEntity`, etc.
   - Endpoint: `/api/v2/data-foundation/*`

7. **Entity Registry** (`src/modules/entity-registry/`)
   - Controller: `entity-registry.controller.ts`
   - Service: `entity.service.ts`, `entity-type.service.ts`
   - Entities: `EntityEntity`, `EntityTypeEntity`
   - Endpoint: `/api/v2/entity-registry/*`

8. **Auth** (`src/modules/auth/`)
   - Controller: `auth.controller.ts`
   - Service: `auth.service.ts`
   - Entity: `UserEntity`, `RefreshTokenEntity`
   - Endpoint: `/api/v2/auth/*`

9. **Users** (`src/modules/users/`)
   - Controller: `users.controller.ts`
   - Service: `users.service.ts`
   - Entity: `UserEntity`
   - Endpoint: `/api/v2/users/*`

### Cross-Cutting Modüller

- **Audit Log** (`entities/audit/audit-log.entity.ts`)
  - Global interceptor tarafından kullanılıyor
  - SQLite uyumluluğu için daha önce düzeltildi

- **Metrics** (`src/modules/metrics/`)
  - Metrics collection için

- **Realtime** (`src/modules/realtime/`)
  - WebSocket gateway (şu an AuditModule'den kaldırılmış)

- **Queue** (`src/modules/queue/`)
  - BullMQ queue management

## Entity Yapısı

### Ana Entity'ler (entities/app/)

1. **PolicyEntity** - Governance policies
2. **RequirementEntity** - Compliance requirements
3. **BIAProcessEntity** - BCM BIA processes
4. **BCPPlanEntity** - BCM BCP plans
5. **BCPExerciseEntity** - BCM BCP exercises
6. **RegulationEntity** - Regulations (yeni eklendi)
7. **RiskCatalogEntity** - Risk catalog
8. **RiskCategoryEntity** - Risk categories
9. **RiskInstanceEntity** - Risk instances
10. **StandardEntity** - Standards
11. **StandardClauseEntity** - Standard clauses
12. **ControlLibraryEntity** - Control library
13. **EntityEntity** - Data foundation entities
14. **EntityTypeEntity** - Entity types
15. **AuditPlanEntity** - Audit plans
16. **AuditEngagementEntity** - Audit engagements
17. **AuditTestEntity** - Audit tests
18. **AuditEvidenceEntity** - Audit evidence
19. **AuditFindingEntity** - Audit findings
20. **CorrectiveActionEntity** - Corrective actions

### Auth Entity'ler (entities/auth/)

1. **UserEntity** - Users
2. **RefreshTokenEntity** - Refresh tokens
3. **RoleEntity** - Roles
4. **PermissionEntity** - Permissions

### Audit Entity'ler (entities/audit/)

1. **AuditLogEntity** - Audit logs (global interceptor)

### Tenant Entity'ler (entities/tenant/)

1. **TenantEntity** - Tenants

### Queue Entity'ler (entities/queue/)

1. **EventRawEntity** - Raw events
2. **EventNormalizedEntity** - Normalized events

## DB Konfigürasyonu

### Dev Ortamı
- **DB Driver**: SQLite (default)
- **DB File**: `./data/grc.sqlite` (default)
- **Synchronize**: `DB_SYNCHRONIZE=true` (dev için)
- **Auto Load Entities**: `true`

### Konfigürasyon Dosyası
- `backend-nest/src/config/database.config.ts`
- `dbConfigFactory()` fonksiyonu:
  - SAFE_MODE veya DB_DRIVER=sqlite → SQLite
  - DB_DRIVER=postgres veya DATABASE_URL → PostgreSQL
  - SQLite için otomatik klasör oluşturma

## Kritik Notlar

1. **Policy Entity**: `PolicyEntity` (entities/app/policy.entity.ts) kullanılıyor
2. **Requirement Entity**: `RequirementEntity` (modules/compliance/comp.entity.ts) - modül içinde
3. **BCM Entities**: Tümü `entities/app/` altında
4. **Regulation Entity**: Yeni eklendi (`entities/app/regulation.entity.ts`)
5. **Audit Log**: SQLite uyumluluğu için daha önce düzeltildi (UUID varchar(36))

## Sonraki Adımlar

PHASE 1'de:
- SQLite şeması ile entity tanımlarını karşılaştırma
- Kritik uyumsuzlukları tespit etme
- Minimal düzeltmeler yapma

