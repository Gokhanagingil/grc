# REDIS BASELINE – GRC Platform

**Analysis Date:** 2025-01-28  
**Purpose:** Document current Redis integration status and potential usage patterns before introducing Redis as a support layer for caching, rate limiting, and feature flags.

---

## 1. Current Redis Integration

### 1.1 Presence in Code

Redis is **present but currently disabled** in the codebase. The health check shows:
```json
{
  "status": "ok",
  "deps": {
    "db": "ok",
    "redis": "disabled"
  }
}
```

### 1.2 Redis Dependencies

**Package:** `ioredis` (v5.8.2)  
**Location:** `package.json`

- `ioredis`: ^5.8.2
- `@types/ioredis`: ^4.28.10

**Note:** No `@nestjs/redis` or `@nestjs/bullmq` packages found, but `@nestjs/bullmq` is likely used for queue management (see QueueModule).

### 1.3 Redis Usage Locations

#### 1.3.1 Cache Service

**File:** `src/common/services/cache.service.ts`  
**Purpose:** Generic caching layer with Redis backend and in-memory fallback

**Features:**
- Redis connection with lazy connect (non-blocking)
- Automatic fallback to in-memory cache if Redis unavailable
- Graceful degradation (never crashes on Redis errors)
- Auto-reconnect support (optional, via `REDIS_AUTO_RECONNECT=true`)
- Error debouncing (prevents log spam)
- TTL support (default: 300 seconds / 5 minutes)
- Pattern-based key deletion
- `getOrSet` helper for cache-aside pattern

**Configuration:**
- `REDIS_ENABLED` (default: true, unless `SAFE_MODE=true`)
- `REDIS_URL` or `REDIS_HOST` + `REDIS_PORT` + `REDIS_PASSWORD`
- `REDIS_AUTO_RECONNECT` (optional, default: false)

**Connection Options:**
- `lazyConnect: true` - defer connection until first use
- `enableReadyCheck: false` - don't wait for ready state
- `enableOfflineQueue: false` - don't queue commands when offline
- `maxRetriesPerRequest: 0` - never retry (non-fatal)
- Custom retry strategy (non-blocking)

**Status:** ✅ Implemented, but disabled by default (no Redis connection configured)

#### 1.3.2 Queue Module

**File:** `src/modules/queue/queue.module.ts`  
**Purpose:** Event queue system using BullMQ (requires Redis)

**Features:**
- BullMQ integration for job queues
- Multiple queues: `events.raw`, `events.normalize`, `events.incident`, `events.dlq`
- Processors: `EventRawProcessor`, `EventNormalizeProcessor`, `EventIncidentProcessor`
- Conditional registration (only if Redis available)

**Configuration:**
- Checks `REDIS_URL` or `REDIS_HOST` env vars
- Disabled if `SAFE_MODE=true`
- Same connection options as CacheService (non-fatal, graceful degradation)

**Status:** ✅ Implemented, but disabled by default (no Redis connection configured)

#### 1.3.3 Health Check

**File:** `src/health/health.controller.ts`  
**Purpose:** Health endpoint that checks Redis availability

**Implementation:**
- Checks for `REDIS_URL` or `REDIS_HOST` env vars
- If configured, attempts Redis ping (non-blocking)
- Returns `redis: "ok"`, `"down"`, or `"disabled"`
- Timeout: 2 seconds for ping

**Status:** ✅ Implemented, currently returns `"disabled"`

### 1.4 Configuration

**Environment Variables:**
- `REDIS_URL` - Full Redis connection URL (e.g., `redis://localhost:6379`)
- `REDIS_HOST` - Redis hostname (default: `localhost`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_ENABLED` - Enable/disable Redis (default: true, unless `SAFE_MODE=true`)
- `REDIS_AUTO_RECONNECT` - Enable auto-reconnect (default: false)

**Validation:**
- Env vars defined in `src/config/env.validation.ts` (all optional)
- No validation errors if Redis vars are missing

### 1.5 Current Health Status

**Health Endpoint Response:**
```json
{
  "status": "ok",
  "time": "2025-01-28T10:30:48.205Z",
  "deps": {
    "db": "ok",
    "redis": "disabled"
  }
}
```

**Reason:** No Redis connection configured (no `REDIS_URL` or `REDIS_HOST` set, or `SAFE_MODE=true`)

---

## 2. Intended Usage (High-Level Proposal – No Implementation Yet)

> **NOTE:** This is a proposal document only. No code changes in this run.

### 2.1 Candidate Use Cases

#### 2.1.1 Rate Limiting / Login Protection

**Current State:**
- NestJS `@nestjs/throttler` is used (in-memory by default)
- ThrottleGuard configured in `app.module.ts`
- Limits: Test mode (600 RPM), Dev (300 RPM), Prod (10 RPM)

**Proposed Redis Usage:**
- Use Redis-backed throttling for distributed rate limiting
- Store rate limit counters in Redis (key: `rate_limit:{user_id}:{endpoint}`)
- TTL-based sliding window or fixed window
- Benefits: Works across multiple backend instances, survives restarts

**Implementation Notes:**
- `@nestjs/throttler` supports Redis storage via `ThrottlerStorageRedis`
- Can be added without breaking existing in-memory throttling

#### 2.1.2 Caching Lookup Tables

**Candidate Tables:**
- `dictionaries` - Status values, categories, dropdowns (high read, low write)
- `risk_catalog` - Risk definitions (read-heavy, changes infrequently)
- `control_library` - Control definitions (read-heavy)
- `entity_types` - Entity type definitions (rarely changes)
- `standard` / `standard_clause` - Standards and clauses (read-heavy)
- `permissions` - Permission definitions (global, rarely changes)

**Proposed Redis Usage:**
- Cache dictionary entries by domain: `dict:{tenant_id}:{domain}`
- Cache risk catalogs: `risk_catalog:{tenant_id}:{catalog_id}`
- Cache control libraries: `control_library:{tenant_id}:{control_id}`
- TTL: 5-15 minutes (configurable)
- Cache invalidation on updates (via hooks or events)

**Benefits:**
- Reduce database load for frequently accessed reference data
- Faster API responses for dropdowns and lookups
- Tenant-aware cache keys ensure data isolation

#### 2.1.3 Feature Flags / Licensing Cache

**Proposed Tables (Future):**
- `tenant_features` or `tenant_license` - Feature flags per tenant
- Example features: `AUDIT_MODULE`, `RISK_MODULE`, `BCM_MODULE`, `CONTRACT_MODULE`

**Proposed Redis Usage:**
- Cache tenant feature flags: `features:{tenant_id}`
- TTL: 1 hour (or until license change)
- Invalidate on license/contract updates
- Fast lookup for feature gate checks in controllers/services

**Benefits:**
- Fast feature flag checks without DB query
- Centralized feature management
- Easy to update flags without code changes

#### 2.1.4 Distributed Locks

**Use Cases:**
- Prevent concurrent risk updates (e.g., two users updating same risk instance)
- Prevent duplicate event processing (idempotency)
- Prevent concurrent audit plan creation for same period

**Proposed Redis Usage:**
- Redis SET with NX (set if not exists) for locks
- Key pattern: `lock:{entity_type}:{entity_id}:{operation}`
- TTL: 30-60 seconds (auto-release if process crashes)
- Example: `lock:risk_instance:{risk_id}:update`

**Benefits:**
- Prevents race conditions in multi-instance deployments
- Ensures data consistency
- Automatic lock release on timeout

#### 2.1.5 Session Storage (Optional)

**Current State:**
- JWT-based authentication (stateless)
- Refresh tokens stored in database (`refresh_tokens` table)

**Proposed Redis Usage (Optional):**
- Store active sessions: `session:{user_id}:{jti}`
- Store refresh tokens in Redis instead of DB (faster revocation)
- TTL: matches JWT expiration
- Benefits: Faster token validation, easier session management

**Note:** Current JWT approach is stateless and works well. Redis sessions are optional enhancement.

#### 2.1.6 Background Job Queue (Already Implemented)

**Current State:**
- BullMQ queue system implemented in `QueueModule`
- Queues: `events.raw`, `events.normalize`, `events.incident`, `events.dlq`
- Processors: EventRawProcessor, EventNormalizeProcessor, EventIncidentProcessor

**Status:** ✅ Already implemented, just needs Redis connection

**Usage:**
- Event ingestion pipeline
- Event normalization
- Incident detection
- Dead letter queue for failed jobs

### 2.2 Key Design Principles

#### 2.2.1 PostgreSQL as Source of Truth

- **Rule:** PostgreSQL remains the authoritative data store
- **Redis Role:** Cache, rate limiting, locks, queues (support layer only)
- **Data Loss Tolerance:** Redis data loss is acceptable (can rebuild from PostgreSQL)
- **Consistency:** Eventual consistency is acceptable for cached data

#### 2.2.2 Redis is Optional

- **Rule:** System must work without Redis (graceful degradation)
- **Current Implementation:** ✅ Already follows this (CacheService, QueueModule)
- **Fallback:** In-memory cache, in-memory throttling, direct DB queries
- **Health Check:** Redis status reported but doesn't block startup

#### 2.2.3 Tenant-Aware Cache Keys

- **Pattern:** `{prefix}:{tenant_id}:{resource_id}` or `{prefix}:{tenant_id}:{domain}`
- **Examples:**
  - `dict:tenant-123:POLICY_STATUS`
  - `risk_catalog:tenant-123:catalog-456`
  - `features:tenant-123`
- **Benefits:** Prevents cross-tenant data leakage, easy cache invalidation per tenant

#### 2.2.4 Cache Invalidation Strategy

**Proposed Patterns:**
- **TTL-based:** Let cache expire naturally (simple, eventual consistency)
- **Event-based:** Invalidate on entity updates (via TypeORM hooks or events)
- **Pattern-based:** Invalidate all keys matching pattern (e.g., `dict:tenant-123:*`)
- **Manual:** Service methods to invalidate specific keys

**Implementation Notes:**
- Use CacheService `delete()` and `deletePattern()` methods
- Hook into TypeORM `@AfterUpdate` / `@AfterInsert` / `@AfterRemove` hooks
- Or use NestJS event emitters for decoupled invalidation

#### 2.2.5 Error Handling

**Current Implementation:**
- ✅ Non-fatal errors (never crash on Redis failure)
- ✅ Error debouncing (prevents log spam)
- ✅ Automatic fallback to in-memory or direct DB
- ✅ Silent failures (log once, then suppress)

**Proposed Enhancement:**
- Add metrics for cache hit/miss rates
- Add metrics for Redis connection status
- Optional: Alert on Redis downtime (if critical for production)

### 2.3 Redis Key Naming Conventions (Proposed)

**Format:** `{module}:{tenant_id}:{resource}:{identifier}`

**Examples:**
- `dict:tenant-123:POLICY_STATUS` - Dictionary entries
- `risk_catalog:tenant-123:catalog-456` - Risk catalog
- `control_library:tenant-123:control-789` - Control library
- `features:tenant-123` - Tenant feature flags
- `lock:risk_instance:tenant-123:risk-456:update` - Distributed lock
- `rate_limit:user-789:POST:/api/v2/risks` - Rate limit counter
- `session:user-789:jti-abc` - User session
- `queue:events.raw:job-123` - Queue job (managed by BullMQ)

**Global Keys (No Tenant):**
- `permissions:all` - Global permissions list
- `system:health` - System health cache

### 2.4 TTL Recommendations (Proposed)

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
| Sessions | JWT expiration | Match token lifetime |

### 2.5 Redis Memory Management (Proposed)

**Strategies:**
- **Max Memory Policy:** `allkeys-lru` (evict least recently used keys)
- **Memory Limit:** Configure based on available RAM (e.g., 512MB-2GB)
- **Key Expiration:** Always set TTL (prevent key accumulation)
- **Monitoring:** Track memory usage, key count, hit rate

**Redis Configuration:**
```redis
maxmemory 1gb
maxmemory-policy allkeys-lru
```

---

## 3. Implementation Roadmap (Proposed, Not Implemented)

### Phase 1: Enable Redis Connection
1. Configure Redis connection (env vars or Docker)
2. Verify health check shows `redis: "ok"`
3. Test CacheService connection
4. Test QueueModule connection

### Phase 2: Caching Lookup Tables
1. Add caching to DictionaryService (dictionary lookups)
2. Add caching to RiskCatalogService (catalog reads)
3. Add caching to ControlLibraryService (control reads)
4. Add cache invalidation hooks (on entity updates)

### Phase 3: Rate Limiting
1. Switch ThrottlerModule to Redis storage
2. Configure distributed rate limiting
3. Test rate limits across multiple instances

### Phase 4: Feature Flags
1. Create tenant_features table (PostgreSQL)
2. Implement FeatureFlagService with Redis cache
3. Add feature gate checks to controllers
4. Add feature flag management UI (future)

### Phase 5: Distributed Locks
1. Create LockService wrapper around Redis SET NX
2. Add locks to critical update operations (risk, audit, policy)
3. Test concurrent update scenarios

### Phase 6: Monitoring & Optimization
1. Add Redis metrics (hit rate, memory usage, connection status)
2. Optimize TTL values based on usage patterns
3. Add cache warming for frequently accessed data

---

## 4. Current Code References

### 4.1 CacheService

**Location:** `src/common/services/cache.service.ts`

**Key Methods:**
- `get<T>(key: string): Promise<T | null>`
- `set(key: string, value: any, ttlSec?: number): Promise<boolean>`
- `delete(key: string): Promise<boolean>`
- `deletePattern(pattern: string): Promise<number>`
- `getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T>`
- `isEnabled(): boolean`

**Usage Example:**
```typescript
const cached = await this.cacheService.get<RiskCatalog>('risk_catalog:tenant-123:catalog-456');
if (!cached) {
  const catalog = await this.riskCatalogRepo.findOne(...);
  await this.cacheService.set('risk_catalog:tenant-123:catalog-456', catalog, 600);
  return catalog;
}
return cached;
```

### 4.2 QueueModule

**Location:** `src/modules/queue/queue.module.ts`

**Queues:**
- `events.raw` - Raw event ingestion
- `events.normalize` - Event normalization
- `events.incident` - Incident detection
- `events.dlq` - Dead letter queue

**Usage:** Via `QueueService` (injected in services)

### 4.3 Health Check

**Location:** `src/health/health.controller.ts`

**Endpoint:** `GET /api/v2/health`

**Redis Check:**
- Checks `REDIS_URL` or `REDIS_HOST`
- Attempts Redis ping (2s timeout)
- Returns `"ok"`, `"down"`, or `"disabled"`

---

## 5. Testing Redis Integration

### 5.1 Local Redis Setup

**Docker:**
```bash
docker run -d --name redis-grc -p 6379:6379 redis:7
```

**Environment:**
```env
REDIS_URL=redis://localhost:6379
# OR
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 5.2 Verification Steps

1. **Health Check:**
   ```bash
   curl http://localhost:5002/api/v2/health
   # Should show: "redis": "ok"
   ```

2. **Cache Service:**
   - Check logs for "Redis cache connected"
   - Test cache get/set operations
   - Verify fallback if Redis unavailable

3. **Queue Service:**
   - Check logs for BullMQ connection
   - Test event queue operations
   - Verify graceful degradation if Redis unavailable

---

## 6. Observations

### 6.1 Current State

- ✅ Redis infrastructure code is present and well-designed
- ✅ Graceful degradation implemented (never crashes on Redis failure)
- ✅ Non-blocking connection (lazy connect)
- ❌ Redis is not configured/connected (disabled by default)
- ❌ No active caching usage (CacheService exists but not used in services)
- ✅ Queue system ready (just needs Redis connection)

### 6.2 Strengths

- **Resilient:** System works without Redis
- **Non-blocking:** Lazy connection, no startup delays
- **Error handling:** Debouncing, silent failures, automatic fallback
- **Tenant-aware:** Cache key patterns support multi-tenancy

### 6.3 Gaps

- **No active usage:** CacheService exists but services don't use it yet
- **No cache invalidation:** No hooks or events for cache invalidation
- **No metrics:** No Redis metrics (hit rate, memory, etc.)
- **No documentation:** Limited docs on Redis usage patterns

### 6.4 Recommendations

1. **Enable Redis connection** (configure env vars or Docker)
2. **Add caching to high-read services** (dictionaries, risk catalog, controls)
3. **Implement cache invalidation** (TypeORM hooks or events)
4. **Add Redis metrics** (hit rate, memory usage, connection status)
5. **Document cache key patterns** (naming conventions, TTL values)

---

**End of Redis Baseline Documentation**

