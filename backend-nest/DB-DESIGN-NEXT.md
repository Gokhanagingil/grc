# DB DESIGN – NEXT PHASE

**Analysis Date:** 2025-01-28  
**Purpose:** Forward-looking design proposals for multi-tenant DB model, Contract Management, and licensing/feature model. This is a design document only - no implementation in this run.

---

## 1. Multi-Tenant DB Model

### 1.1 Current Pattern

**Architecture:** Single database, shared schema, tenant_id on each business table

**PostgreSQL Schemas:**
- `tenant` - Tenant root table
- `auth` - Users, roles, permissions (tenant-scoped where applicable)
- `app` (public) - All business entities (policies, risks, audits, BCM, etc.)
- `audit` - Audit logs (system-wide, optional tenant_id)
- `queue` - Event queue (tenant-aware)

**Tenant Isolation:**
- ✅ All business entities have `tenant_id` column
- ✅ Unique constraints are tenant-aware: `(code, tenant_id)`
- ✅ Foreign keys maintain tenant context (via parent entities)
- ✅ Indexes include `tenant_id` for efficient filtering

**Strengths:**
- Simple to implement and maintain
- Efficient queries (single DB, indexed tenant_id)
- Easy cross-tenant analytics (if needed)
- Cost-effective (single database instance)

**Limitations:**
- All tenants share same database (potential performance issues at scale)
- No physical data isolation (regulatory concerns)
- Tenant data in same tables (requires careful query filtering)

### 1.2 Proposed Pattern (No Changes Required)

**Recommendation:** Keep current pattern (single DB, shared schema, tenant_id)

**Rationale:**
- Current pattern is well-implemented
- All business entities already have `tenant_id`
- Unique constraints are tenant-aware
- Indexes support efficient tenant filtering
- Sufficient for current scale and requirements

**Future Considerations:**
- If scale requires, consider schema-per-tenant (PostgreSQL) or database-per-tenant
- For regulatory isolation, consider database-per-tenant or row-level security (RLS)

### 1.3 Tables Missing tenant_id (By Design)

**Global/System Tables (No tenant_id):**
- ✅ `permissions` - Global permissions (shared across tenants)
- ✅ `role_permissions` - Inherits tenant via `role_id`
- ✅ `user_roles` - Inherits tenant via `user_id` or `role_id`
- ✅ `refresh_tokens` - Inherits tenant via `user_id`

**Optional tenant_id (Nullable):**
- ⚠️ `audit_logs` - System-level logs may not have tenant (e.g., tenant creation)
- ⚠️ `events_raw` - Events may arrive before tenant is identified

**Recommendation:** Keep as-is. These are intentional design decisions.

### 1.4 Tables Missing tenant_id (Needs Fix)

**None identified.** All business entities have `tenant_id`.

### 1.5 Unique Constraints - Gaps

**Missing tenant-aware unique constraints:**
- ⚠️ `policies.code` - **NO unique constraint** (should be `UNIQUE(code, tenant_id)`)

**Recommendation:**
- Add migration to create unique constraint: `UNIQUE(code, tenant_id)` on `policies` table
- Verify no duplicate codes exist before adding constraint
- Add index if not exists: `CREATE UNIQUE INDEX idx_policies_code_tenant ON policies(code, tenant_id)`

**All other entities:** ✅ Have tenant-aware unique constraints

### 1.6 Proposed Consistent Pattern

**Rules:**
1. **All business tables MUST have `tenant_id`** (UUID, NOT NULL, FK to `tenant.tenants`)
2. **All unique constraints MUST include `tenant_id`** (e.g., `UNIQUE(code, tenant_id)`)
3. **All indexes SHOULD include `tenant_id`** for efficient filtering
4. **Junction tables inherit tenant via parent FK** (no explicit tenant_id needed)
5. **Global/system tables explicitly document why they lack tenant_id**

**Current Compliance:** ✅ 95% compliant (only `policies.code` needs unique constraint)

---

## 2. Contract / Licensing Anchor Points (DB-Level Only)

### 2.1 High-Level Proposal

**Purpose:** Support licensing/feature model where tenants can license specific modules (e.g., Audit-only tenants should not see Risk/BCM links).

**Approach:** Add contract and licensing tables to PostgreSQL. Keep as design proposal only (no migrations yet).

### 2.2 Proposed Tables

#### 2.2.1 Contract Header

**Table:** `contracts` (or `contract_header`)

**Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK to `tenant.tenants`)
- `contract_number` (varchar(100), unique per tenant)
- `contract_type` (enum: 'SUBSCRIPTION', 'PERPETUAL', 'TRIAL')
- `status` (enum: 'DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED')
- `start_date` (date)
- `end_date` (date, nullable)
- `renewal_date` (date, nullable)
- `billing_cycle` (enum: 'MONTHLY', 'QUARTERLY', 'ANNUAL')
- `total_value` (decimal, nullable)
- `currency` (varchar(3), nullable)
- `notes` (text, nullable)
- `created_at`, `updated_at` (timestamps)
- `created_by`, `updated_by` (UUID, nullable)

**Unique:** `(contract_number, tenant_id)`

**Purpose:** Track contract agreements between platform and tenants.

#### 2.2.2 Contract Party

**Table:** `contract_parties`

**Fields:**
- `id` (UUID, PK)
- `contract_id` (UUID, FK to `contracts.id`)
- `party_type` (enum: 'CUSTOMER', 'VENDOR', 'PARTNER')
- `party_name` (text)
- `party_email` (text, nullable)
- `party_contact` (text, nullable)
- `role` (text, nullable) - e.g., 'PRIMARY', 'BILLING', 'TECHNICAL'
- `created_at`, `updated_at` (timestamps)

**Purpose:** Track parties involved in contracts (customer, vendor, partners).

#### 2.2.3 Contract Clause

**Table:** `contract_clauses`

**Fields:**
- `id` (UUID, PK)
- `contract_id` (UUID, FK to `contracts.id`)
- `clause_number` (varchar(50))
- `title` (text)
- `content` (text)
- `clause_type` (enum: 'TERM', 'CONDITION', 'SLA', 'LICENSE', 'OTHER')
- `effective_date` (date, nullable)
- `expiry_date` (date, nullable)
- `order` (integer, default: 0)
- `created_at`, `updated_at` (timestamps)
- `created_by`, `updated_by` (UUID, nullable)

**Unique:** `(contract_id, clause_number)`

**Purpose:** Store contract terms, conditions, SLAs, and license clauses.

#### 2.2.4 Tenant Feature / License

**Table:** `tenant_features` (or `tenant_licenses`)

**Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK to `tenant.tenants`)
- `feature_code` (varchar(100)) - e.g., 'AUDIT_MODULE', 'RISK_MODULE', 'BCM_MODULE', 'CONTRACT_MODULE'
- `feature_name` (text)
- `status` (enum: 'ACTIVE', 'INACTIVE', 'SUSPENDED')
- `license_type` (enum: 'FULL', 'LIMITED', 'TRIAL', 'DEMO')
- `max_users` (integer, nullable) - user limit for this feature
- `max_entities` (integer, nullable) - entity limit (e.g., max risk instances)
- `contract_id` (UUID, FK to `contracts.id`, nullable)
- `granted_at` (timestamp)
- `expires_at` (timestamp, nullable)
- `revoked_at` (timestamp, nullable)
- `metadata` (JSON, nullable) - flexible attributes
- `created_at`, `updated_at` (timestamps)
- `created_by`, `updated_by` (UUID, nullable)

**Unique:** `(tenant_id, feature_code)`

**Indexes:**
- `idx_tenant_features_tenant` (tenant_id)
- `idx_tenant_features_code` (feature_code)
- `idx_tenant_features_status` (status)
- `idx_tenant_features_expires` (expires_at)

**Purpose:** Track which features/modules each tenant is licensed to use.

**Feature Codes (Proposed):**
- `AUDIT_MODULE` - Audit management
- `RISK_MODULE` - Risk management
- `BCM_MODULE` - Business continuity management
- `POLICY_MODULE` - Policy management
- `COMPLIANCE_MODULE` - Compliance management
- `CONTRACT_MODULE` - Contract management
- `ENTITY_REGISTRY` - Entity registry
- `CALENDAR` - Calendar/events
- `DASHBOARD` - Dashboards
- `REPORTING` - Reporting/analytics
- `API_ACCESS` - API access
- `ADVANCED_RISK_SCORING` - Advanced risk scoring
- `CUSTOM_WORKFLOWS` - Custom workflows

#### 2.2.5 Contract-Entity Link Tables

**Purpose:** Link contracts to business entities (risks, audits, policies, etc.)

**Option 1: Generic Link Table**

**Table:** `contract_entity_links`

**Fields:**
- `id` (UUID, PK)
- `contract_id` (UUID, FK to `contracts.id`)
- `entity_type` (varchar(100)) - e.g., 'RISK', 'AUDIT', 'POLICY', 'BCP'
- `entity_id` (UUID) - polymorphic reference
- `link_type` (enum: 'COVERED_BY', 'GOVERNED_BY', 'RELATED_TO')
- `created_at`, `updated_at` (timestamps)

**Unique:** `(contract_id, entity_type, entity_id)`

**Option 2: Specific Link Tables**

- `contract_risks` - Links contracts to risk instances
- `contract_audits` - Links contracts to audit engagements
- `contract_policies` - Links contracts to policies
- `contract_bcp_plans` - Links contracts to BCP plans

**Recommendation:** Start with Option 1 (generic), add specific tables if needed for complex relationships.

### 2.3 Data Model Relationships

```
tenant (1) ──→ (N) contracts
contract (1) ──→ (N) contract_parties
contract (1) ──→ (N) contract_clauses
contract (1) ──→ (N) tenant_features (via contract_id)
tenant (1) ──→ (N) tenant_features (direct)
tenant_features (N) ──→ (1) contract (optional)
contract (1) ──→ (N) contract_entity_links
```

### 2.4 Feature Flag Implementation Strategy

**Approach:** Use `tenant_features` table + Redis cache

**Flow:**
1. Check Redis cache: `features:{tenant_id}`
2. If cache miss, query `tenant_features` table
3. Filter by `status='ACTIVE'` and `expires_at IS NULL OR expires_at > NOW()`
4. Cache result in Redis (TTL: 1 hour)
5. Invalidate cache on feature updates

**Service Method:**
```typescript
async hasFeature(tenantId: string, featureCode: string): Promise<boolean> {
  const features = await this.getTenantFeatures(tenantId);
  return features.includes(featureCode);
}
```

**Guard/Decorator:**
```typescript
@RequireFeature('AUDIT_MODULE')
@Controller('audit')
export class AuditController { ... }
```

### 2.5 Migration Strategy (Future)

**Phase 1: Add Tables**
1. Create `contracts` table
2. Create `contract_parties` table
3. Create `contract_clauses` table
4. Create `tenant_features` table
5. Create `contract_entity_links` table (optional)

**Phase 2: Seed Default Features**
1. Insert default feature codes (AUDIT_MODULE, RISK_MODULE, etc.)
2. Grant all features to existing tenants (backward compatibility)
3. Add feature flags to new tenants only

**Phase 3: Add Feature Gates**
1. Add `@RequireFeature()` decorator
2. Add feature checks to controllers/services
3. Add feature flag management UI

**Phase 4: Contract Management**
1. Add contract CRUD APIs
2. Link contracts to features
3. Add contract expiration checks
4. Add contract renewal workflows

---

## 3. Where Redis Fits Into This Picture

### 3.1 Read-Heavy Areas (Caching Candidates)

#### 3.1.1 Dictionary Lookups

**Current:** Direct DB queries for dropdowns, status values, categories

**Redis Cache:**
- Key: `dict:{tenant_id}:{domain}`
- TTL: 15 minutes
- Invalidate: On dictionary updates

**Impact:** High - dictionaries are queried on every form load

#### 3.1.2 Risk Catalog

**Current:** Direct DB queries for risk catalog entries

**Redis Cache:**
- Key: `risk_catalog:{tenant_id}:{catalog_id}`
- TTL: 10 minutes
- Invalidate: On catalog updates

**Impact:** Medium - catalogs are read frequently but updated rarely

#### 3.1.3 Control Library

**Current:** Direct DB queries for control definitions

**Redis Cache:**
- Key: `control_library:{tenant_id}:{control_id}`
- TTL: 10 minutes
- Invalidate: On control updates

**Impact:** Medium - controls are read frequently but updated rarely

#### 3.1.4 Entity Types

**Current:** Direct DB queries for entity type definitions

**Redis Cache:**
- Key: `entity_types:{tenant_id}`
- TTL: 30 minutes
- Invalidate: On entity type updates

**Impact:** Low - entity types rarely change

#### 3.1.5 Standards & Clauses

**Current:** Direct DB queries for standards and clauses

**Redis Cache:**
- Key: `standard:{tenant_id}:{standard_id}`
- Key: `standard_clause:{tenant_id}:{clause_id}`
- TTL: 30 minutes
- Invalidate: On standard/clause updates

**Impact:** Low - standards rarely change

#### 3.1.6 Feature Flags (Future)

**Current:** Will query `tenant_features` table

**Redis Cache:**
- Key: `features:{tenant_id}`
- TTL: 1 hour (or until license change)
- Invalidate: On feature grant/revoke

**Impact:** High - feature checks happen on every request

### 3.2 Cross-Cutting Concerns

#### 3.2.1 Rate Limiting

**Current:** In-memory throttling (per instance)

**Redis Usage:**
- Key: `rate_limit:{user_id}:{endpoint}:{window}`
- TTL: Sliding window (60 seconds)
- Increment counter, check limit

**Impact:** High - enables distributed rate limiting across multiple backend instances

**Implementation:**
- Switch `@nestjs/throttler` to `ThrottlerStorageRedis`
- Configure Redis-backed storage
- Test across multiple instances

#### 3.2.2 Feature Flags (Cross-Cutting)

**Current:** N/A (not implemented)

**Redis Usage:**
- Cache tenant features: `features:{tenant_id}`
- Fast lookup for feature gate checks
- Invalidate on license updates

**Impact:** High - feature checks on every request, must be fast

#### 3.2.3 Distributed Locks

**Use Cases:**
- Prevent concurrent risk updates
- Prevent duplicate event processing
- Prevent concurrent audit plan creation

**Redis Usage:**
- Key: `lock:{entity_type}:{tenant_id}:{entity_id}:{operation}`
- TTL: 30-60 seconds (auto-release)
- SET NX (set if not exists) for lock acquisition

**Impact:** Medium - prevents race conditions in multi-instance deployments

**Example:**
```typescript
async updateRiskInstance(riskId: string, data: UpdateRiskDto) {
  const lockKey = `lock:risk_instance:${tenantId}:${riskId}:update`;
  const locked = await this.lockService.acquire(lockKey, 60);
  if (!locked) {
    throw new ConflictException('Risk instance is being updated by another user');
  }
  try {
    // Update risk instance
  } finally {
    await this.lockService.release(lockKey);
  }
}
```

#### 3.2.4 Background Job Queue

**Current:** Implemented but disabled (needs Redis)

**Redis Usage:**
- BullMQ queues: `events.raw`, `events.normalize`, `events.incident`, `events.dlq`
- Job storage, retry logic, dead letter queue

**Impact:** High - event processing pipeline requires queue system

**Status:** ✅ Already implemented, just needs Redis connection

### 3.3 Cache Invalidation Strategy

#### 3.3.1 TTL-Based (Simple)

**Approach:** Let cache expire naturally

**Pros:**
- Simple to implement
- No invalidation logic needed
- Eventual consistency acceptable

**Cons:**
- Stale data until TTL expires
- May serve outdated data after updates

**Use Cases:**
- Dictionary entries (rarely change)
- Entity types (rarely change)
- Standards/clauses (rarely change)

#### 3.3.2 Event-Based (Recommended)

**Approach:** Invalidate cache on entity updates

**Implementation Options:**
1. **TypeORM Hooks:**
   ```typescript
   @AfterUpdate()
   async afterUpdate() {
     await this.cacheService.delete(`risk_catalog:${this.tenant_id}:${this.id}`);
   }
   ```

2. **NestJS Event Emitters:**
   ```typescript
   @OnEvent('risk.catalog.updated')
   async handleRiskCatalogUpdated(event: RiskCatalogUpdatedEvent) {
     await this.cacheService.delete(`risk_catalog:${event.tenantId}:${event.catalogId}`);
   }
   ```

3. **Service Methods:**
   ```typescript
   async updateRiskCatalog(id: string, data: UpdateRiskCatalogDto) {
     const catalog = await this.repo.update(id, data);
     await this.cacheService.delete(`risk_catalog:${tenantId}:${id}`);
     return catalog;
   }
   ```

**Use Cases:**
- Risk catalog (changes occasionally)
- Control library (changes occasionally)
- Feature flags (must be immediate)

#### 3.3.3 Pattern-Based

**Approach:** Invalidate all keys matching pattern

**Example:**
```typescript
// Invalidate all dictionary entries for a tenant
await this.cacheService.deletePattern(`dict:${tenantId}:*`);
```

**Use Cases:**
- Bulk updates (e.g., update all dictionaries)
- Tenant-level changes (e.g., feature flag changes)

### 3.4 Redis Key Naming Conventions

**Format:** `{module}:{tenant_id}:{resource}:{identifier}`

**Examples:**
- `dict:tenant-123:POLICY_STATUS` - Dictionary entries
- `risk_catalog:tenant-123:catalog-456` - Risk catalog
- `control_library:tenant-123:control-789` - Control library
- `features:tenant-123` - Tenant feature flags
- `lock:risk_instance:tenant-123:risk-456:update` - Distributed lock
- `rate_limit:user-789:POST:/api/v2/risks` - Rate limit counter

**Global Keys (No Tenant):**
- `permissions:all` - Global permissions list
- `system:health` - System health cache

### 3.5 TTL Recommendations

| Cache Type | TTL | Reason |
|------------|-----|--------|
| Dictionary entries | 15 minutes | Rarely changes, high read |
| Risk catalog | 10 minutes | Changes occasionally |
| Control library | 10 minutes | Changes occasionally |
| Entity types | 30 minutes | Rarely changes |
| Standards/clauses | 30 minutes | Rarely changes |
| Feature flags | 1 hour | Changes on license updates |
| Rate limit counters | 60 seconds | Sliding window |
| Distributed locks | 30-60 seconds | Auto-release on timeout |

---

## 4. Implementation Priorities

### 4.1 Phase 1: Enable Redis (Immediate)

**Tasks:**
1. Configure Redis connection (env vars or Docker)
2. Verify health check shows `redis: "ok"`
3. Test CacheService connection
4. Test QueueModule connection

**Effort:** Low (1-2 hours)

### 4.2 Phase 2: Fix DB Gaps (Immediate)

**Tasks:**
1. Add unique constraint to `policies.code`: `UNIQUE(code, tenant_id)`
2. Verify no duplicate codes exist
3. Add migration

**Effort:** Low (1-2 hours)

### 4.3 Phase 3: Add Caching (Short-term)

**Tasks:**
1. Add caching to DictionaryService
2. Add caching to RiskCatalogService
3. Add caching to ControlLibraryService
4. Add cache invalidation hooks

**Effort:** Medium (1-2 days)

### 4.4 Phase 4: Contract Management Tables (Medium-term)

**Tasks:**
1. Create migration for contract tables
2. Create entities for contracts, parties, clauses
3. Create services for contract CRUD
4. Seed default features for existing tenants

**Effort:** Medium (3-5 days)

### 4.5 Phase 5: Feature Flags (Medium-term)

**Tasks:**
1. Create TenantFeatureService with Redis cache
2. Add `@RequireFeature()` decorator/guard
3. Add feature checks to controllers
4. Add feature flag management APIs

**Effort:** Medium (3-5 days)

### 4.6 Phase 6: Distributed Locks (Long-term)

**Tasks:**
1. Create LockService wrapper
2. Add locks to critical update operations
3. Test concurrent scenarios

**Effort:** Low (1-2 days)

### 4.7 Phase 7: Rate Limiting (Long-term)

**Tasks:**
1. Switch ThrottlerModule to Redis storage
2. Configure distributed rate limiting
3. Test across multiple instances

**Effort:** Low (1-2 days)

---

## 5. Design Principles Summary

### 5.1 Multi-Tenancy

- ✅ All business tables have `tenant_id`
- ✅ All unique constraints include `tenant_id`
- ✅ All indexes include `tenant_id` for filtering
- ✅ Junction tables inherit tenant via parent FK

### 5.2 Redis Integration

- ✅ PostgreSQL is source of truth
- ✅ Redis is optional (graceful degradation)
- ✅ Tenant-aware cache keys
- ✅ TTL-based expiration with event-based invalidation
- ✅ Non-fatal errors (never crash on Redis failure)

### 5.3 Contract Management

- ✅ Contract tables track agreements
- ✅ Feature flags control module access
- ✅ Redis cache for fast feature checks
- ✅ Backward compatible (grant all features to existing tenants)

### 5.4 Data Consistency

- ✅ Eventual consistency acceptable for cached data
- ✅ Immediate consistency for critical operations (use distributed locks)
- ✅ Cache invalidation on updates (event-based or TTL)

---

## 6. Open Questions

### 6.1 Contract Management

- **Q:** Should contracts be tenant-scoped or platform-wide?
  - **A:** Tenant-scoped (each tenant has their own contracts)

- **Q:** Should contract clauses be versioned?
  - **A:** Consider adding `version` field to `contract_clauses` if needed

- **Q:** How to handle contract renewals?
  - **A:** Update `end_date` and `renewal_date` fields, trigger feature flag refresh

### 6.2 Feature Flags

- **Q:** Should feature flags be hierarchical (e.g., RISK_MODULE includes RISK_CATALOG)?
  - **A:** Start flat, add hierarchy if needed

- **Q:** How to handle feature flag changes mid-session?
  - **A:** Short TTL (1 hour) + cache invalidation on updates

- **Q:** Should feature flags support usage limits (e.g., max 100 risk instances)?
  - **A:** Yes, via `max_entities` field in `tenant_features`

### 6.3 Redis

- **Q:** Should Redis be required for production?
  - **A:** No, but recommended for performance. System must work without it.

- **Q:** How to handle Redis failover?
  - **A:** Current implementation already handles this (graceful degradation)

- **Q:** Should we use Redis Cluster for high availability?
  - **A:** Consider for production at scale, but start with single instance

---

**End of DB Design Next Phase Documentation**

