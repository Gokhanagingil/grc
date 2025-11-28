# REDIS ROLL-OUT PLAN – GRC Platform

**Analysis Date:** 2025-01-28  
**Purpose:** Concrete, phased checklist for introducing Redis as a support layer for caching, rate limiting, and feature flags.

**Prerequisites:**
- Review `REDIS-BASELINE.md` for current Redis integration status
- Review `DB-DESIGN-NEXT.md` for Redis design principles
- Ensure Redis infrastructure is available (Docker or local installation)

---

## Phase 1 – Enable Redis & Verify Health

**Goal:** Get Redis connected and verify it's working

**Tasks:**
- [ ] **1.1** Configure Redis connection
  - [ ] Set `REDIS_URL` env var OR set `REDIS_HOST` + `REDIS_PORT` + `REDIS_PASSWORD`
  - [ ] Example: `REDIS_URL=redis://localhost:6379`
  - [ ] Or: `REDIS_HOST=localhost`, `REDIS_PORT=6379`

- [ ] **1.2** Start Redis instance
  - [ ] Docker: `docker run -d --name redis-grc -p 6379:6379 redis:7`
  - [ ] Or use existing Redis installation
  - [ ] Verify Redis is running: `redis-cli ping` (should return `PONG`)

- [ ] **1.3** Verify health check
  - [ ] Start backend: `npm run start:dev`
  - [ ] Check health endpoint: `GET /api/v2/health`
  - [ ] Verify response shows: `"redis": "ok"` (not `"disabled"` or `"down"`)
  - [ ] Check logs for: `"Redis cache connected"`

- [ ] **1.4** Test CacheService connection
  - [ ] Verify CacheService initializes without errors
  - [ ] Check logs for successful Redis connection
  - [ ] Verify graceful fallback if Redis unavailable (test by stopping Redis)

**Success Criteria:**
- ✅ Health check shows `redis: "ok"`
- ✅ CacheService logs show "Redis cache connected"
- ✅ No errors in application startup
- ✅ Graceful degradation works (system works without Redis)

**Estimated Time:** 1-2 hours

---

## Phase 2 – Add Caching to DictionaryService

**Goal:** Cache dictionary lookups (high-read, low-write)

**Tasks:**
- [ ] **2.1** Locate DictionaryService
  - [ ] Find service that handles dictionary queries
  - [ ] Review current implementation (likely in AdminService or similar)

- [ ] **2.2** Inject CacheService
  - [ ] Add `CacheService` to constructor
  - [ ] Import: `import { CacheService } from '../../common/services/cache.service';`

- [ ] **2.3** Implement cache-aside pattern for dictionary lookups
  - [ ] Add method: `async getDictionaryByDomain(tenantId: string, domain: string)`
  - [ ] Cache key: `dict:${tenantId}:${domain}`
  - [ ] TTL: 15 minutes (900 seconds)
  - [ ] Use `cacheService.getOrSet()` pattern:
    ```typescript
    return await this.cacheService.getOrSet(
      `dict:${tenantId}:${domain}`,
      async () => {
        // Fetch from database
        return await this.dictRepo.find({
          where: { tenant_id: tenantId, domain, is_active: true },
          order: { order: 'ASC' },
        });
      },
      900, // 15 minutes
    );
    ```

- [ ] **2.4** Add cache invalidation on dictionary updates
  - [ ] In `create()`, `update()`, `delete()` methods
  - [ ] Invalidate: `await this.cacheService.deletePattern(\`dict:${tenantId}:*\`);`
  - [ ] Or invalidate specific domain: `await this.cacheService.delete(\`dict:${tenantId}:${domain}\`);`

- [ ] **2.5** Test caching
  - [ ] First request: should hit database (cache miss)
  - [ ] Second request: should hit cache (cache hit)
  - [ ] After update: cache should be invalidated
  - [ ] Verify cache keys in Redis: `redis-cli KEYS "dict:*"`

**Success Criteria:**
- ✅ Dictionary lookups use cache
- ✅ Cache invalidation works on updates
- ✅ Performance improvement on repeated lookups
- ✅ No breaking changes to existing API

**Estimated Time:** 2-4 hours

---

## Phase 3 – Add Caching to RiskCatalogService & ControlLibraryService

**Goal:** Cache risk catalog and control library lookups

**Tasks:**
- [ ] **3.1** Add caching to RiskCatalogService
  - [ ] Locate: `DataFoundationService.findRiskCatalog()`
  - [ ] Inject `CacheService`
  - [ ] Cache individual catalog entries: `risk_catalog:${tenantId}:${catalogId}`
  - [ ] Cache list queries: `risk_catalog:${tenantId}:list:${hashOfQueryParams}`
  - [ ] TTL: 10 minutes (600 seconds)
  - [ ] Add cache invalidation on catalog create/update/delete

- [ ] **3.2** Add caching to ControlLibraryService
  - [ ] Locate: `DataFoundationService.findControls()` and `getOneControl()`
  - [ ] Inject `CacheService`
  - [ ] Cache individual controls: `control_library:${tenantId}:${controlId}`
  - [ ] Cache list queries: `control_library:${tenantId}:list:${hashOfQueryParams}`
  - [ ] TTL: 10 minutes (600 seconds)
  - [ ] Add cache invalidation on control create/update/delete

- [ ] **3.3** Test caching
  - [ ] Verify cache hits on repeated queries
  - [ ] Verify cache invalidation on updates
  - [ ] Check Redis memory usage: `redis-cli INFO memory`

**Success Criteria:**
- ✅ Risk catalog lookups use cache
- ✅ Control library lookups use cache
- ✅ Cache invalidation works correctly
- ✅ Performance improvement measurable

**Estimated Time:** 4-6 hours

---

## Phase 4 – Implement Feature Flag Cache for tenant_features

**Goal:** Fast feature flag lookups for licensing/feature model

**Prerequisites:**
- `tenant_features` table must exist (from DB-DESIGN-NEXT.md Phase 4)
- Feature flag service must be implemented

**Tasks:**
- [ ] **4.1** Create TenantFeatureService (if not exists)
  - [ ] Service: `TenantFeatureService`
  - [ ] Method: `async getTenantFeatures(tenantId: string): Promise<string[]>`
  - [ ] Query: `SELECT feature_code FROM tenant_features WHERE tenant_id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())`

- [ ] **4.2** Add Redis caching
  - [ ] Inject `CacheService`
  - [ ] Cache key: `features:${tenantId}`
  - [ ] TTL: 1 hour (3600 seconds)
  - [ ] Use `cacheService.getOrSet()`:
    ```typescript
    return await this.cacheService.getOrSet(
      `features:${tenantId}`,
      async () => {
        const features = await this.repo.find({
          where: {
            tenant_id: tenantId,
            status: 'ACTIVE',
            // expires_at check via query builder
          },
        });
        return features.map(f => f.feature_code);
      },
      3600, // 1 hour
    );
    ```

- [ ] **4.3** Add cache invalidation
  - [ ] On feature grant: `await this.cacheService.delete(\`features:${tenantId}\`);`
  - [ ] On feature revoke: `await this.cacheService.delete(\`features:${tenantId}\`);`
  - [ ] On license update: `await this.cacheService.delete(\`features:${tenantId}\`);`

- [ ] **4.4** Create feature guard/decorator
  - [ ] Guard: `@RequireFeature('AUDIT_MODULE')`
  - [ ] Implementation: Check `TenantFeatureService.hasFeature(tenantId, featureCode)`
  - [ ] Throw `ForbiddenException` if feature not available

- [ ] **4.5** Test feature flags
  - [ ] Verify feature checks use cache
  - [ ] Verify cache invalidation on license changes
  - [ ] Test feature guard on controllers

**Success Criteria:**
- ✅ Feature flags cached in Redis
- ✅ Feature guard works correctly
- ✅ Cache invalidation on license updates
- ✅ Fast feature checks (< 10ms)

**Estimated Time:** 6-8 hours (includes feature flag service implementation)

---

## Phase 5 – Enable Redis-Backed Throttling and Locks

**Goal:** Distributed rate limiting and concurrency control

**Tasks:**
- [ ] **5.1** Switch ThrottlerModule to Redis storage
  - [ ] Install: `npm install @nestjs/throttler-storage-redis`
  - [ ] Update `app.module.ts`:
    ```typescript
    import { ThrottlerStorageRedis } from '@nestjs/throttler-storage-redis';
    
    ThrottlerModule.forRoot({
      storage: new ThrottlerStorageRedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        // ... other Redis options
      }),
      ttl: 60000,
      limit: throttleLimit,
    }),
    ```
  - [ ] Test rate limiting across multiple backend instances

- [ ] **5.2** Create LockService
  - [ ] Service: `LockService`
  - [ ] Method: `async acquire(key: string, ttlSeconds: number): Promise<boolean>`
  - [ ] Implementation: Redis `SET key value NX EX ttl`
  - [ ] Method: `async release(key: string): Promise<void>`
  - [ ] Implementation: Redis `DEL key`

- [ ] **5.3** Add locks to critical operations
  - [ ] Risk instance updates: `lock:risk_instance:${tenantId}:${riskId}:update`
  - [ ] Audit plan creation: `lock:audit_plan:${tenantId}:${period}:create`
  - [ ] Policy updates: `lock:policy:${tenantId}:${policyId}:update`
  - [ ] TTL: 30-60 seconds (auto-release on timeout)

- [ ] **5.4** Test distributed locks
  - [ ] Test concurrent updates (should block second request)
  - [ ] Test lock timeout (should auto-release)
  - [ ] Test across multiple backend instances

**Success Criteria:**
- ✅ Rate limiting works across multiple instances
- ✅ Distributed locks prevent concurrent updates
- ✅ Lock timeout works correctly
- ✅ No deadlocks or race conditions

**Estimated Time:** 4-6 hours

---

## Phase 6 – Monitoring & Optimization

**Goal:** Monitor Redis usage and optimize performance

**Tasks:**
- [ ] **6.1** Add Redis metrics
  - [ ] Cache hit rate: `cache_hits / (cache_hits + cache_misses)`
  - [ ] Memory usage: `redis-cli INFO memory`
  - [ ] Key count: `redis-cli DBSIZE`
  - [ ] Connection status: Track in health check

- [ ] **6.2** Optimize TTL values
  - [ ] Monitor cache hit rates per cache type
  - [ ] Adjust TTL based on usage patterns
  - [ ] Document TTL values in `REDIS-BASELINE.md`

- [ ] **6.3** Add cache warming (optional)
  - [ ] Warm frequently accessed data on startup
  - [ ] Example: Load all active tenant features
  - [ ] Example: Load all dictionary domains

- [ ] **6.4** Set up Redis monitoring
  - [ ] Configure Redis max memory: `maxmemory 1gb`
  - [ ] Configure eviction policy: `maxmemory-policy allkeys-lru`
  - [ ] Set up alerts for Redis downtime
  - [ ] Set up alerts for high memory usage

**Success Criteria:**
- ✅ Redis metrics available
- ✅ Cache hit rates > 70% for cached data
- ✅ Memory usage within limits
- ✅ Monitoring alerts configured

**Estimated Time:** 4-6 hours

---

## Phase 7 – Documentation & Cleanup

**Goal:** Document Redis usage and clean up

**Tasks:**
- [ ] **7.1** Update documentation
  - [ ] Update `REDIS-BASELINE.md` with actual usage patterns
  - [ ] Document cache key naming conventions
  - [ ] Document TTL values and rationale
  - [ ] Add troubleshooting guide

- [ ] **7.2** Code cleanup
  - [ ] Remove unused Redis code (if any)
  - [ ] Standardize cache key patterns
  - [ ] Add JSDoc comments to cache methods
  - [ ] Add unit tests for cache invalidation

- [ ] **7.3** Performance testing
  - [ ] Load test with Redis enabled
  - [ ] Compare performance with/without Redis
  - [ ] Document performance improvements

**Success Criteria:**
- ✅ Documentation complete
- ✅ Code standardized
- ✅ Performance improvements documented

**Estimated Time:** 2-4 hours

---

## Rollback Plan

**If Redis causes issues:**

1. **Immediate Rollback:**
   - Set `REDIS_ENABLED=false` env var
   - System will fall back to in-memory cache
   - No code changes needed (graceful degradation)

2. **Partial Rollback:**
   - Disable specific cache layers (comment out cache calls)
   - Keep Redis for rate limiting only
   - Re-enable caching incrementally

3. **Full Rollback:**
   - Remove Redis connection config
   - System works without Redis (already implemented)

---

## Success Metrics

**Before Redis:**
- Dictionary lookups: ~50ms (database query)
- Risk catalog lookups: ~100ms (database query)
- Feature flag checks: ~30ms (database query)

**After Redis (Target):**
- Dictionary lookups: ~5ms (cache hit)
- Risk catalog lookups: ~10ms (cache hit)
- Feature flag checks: ~2ms (cache hit)

**Cache Hit Rate Target:**
- Dictionary: > 80%
- Risk catalog: > 70%
- Control library: > 70%
- Feature flags: > 90%

---

## Dependencies

**External:**
- Redis 7+ (Docker or local installation)
- `ioredis` package (already installed)
- `@nestjs/throttler-storage-redis` (for Phase 5)

**Internal:**
- `CacheService` (already implemented)
- `QueueModule` (already implemented, just needs Redis connection)
- `TenantFeatureService` (needs to be created in Phase 4)

---

## Risk Assessment

**Low Risk:**
- Phase 1 (Enable Redis) - Graceful degradation already implemented
- Phase 2 (Dictionary caching) - Isolated, low impact

**Medium Risk:**
- Phase 3 (Risk/Control caching) - Higher impact, needs careful testing
- Phase 5 (Throttling/Locks) - Affects request handling

**High Risk:**
- Phase 4 (Feature flags) - Requires database changes first
- Phase 6 (Optimization) - May require production tuning

**Mitigation:**
- All phases have graceful degradation
- Can rollback by disabling Redis
- Test in staging before production
- Monitor cache hit rates and performance

---

## Timeline Estimate

**Total Estimated Time:** 20-30 hours

**Phased Approach:**
- Week 1: Phases 1-2 (Enable Redis, Dictionary caching)
- Week 2: Phase 3 (Risk/Control caching)
- Week 3: Phase 4 (Feature flags) - depends on DB changes
- Week 4: Phase 5 (Throttling/Locks)
- Week 5: Phases 6-7 (Monitoring, Documentation)

**Can be done in parallel:**
- Phase 2 and Phase 3 (different services)
- Phase 5 (independent of caching)

---

**End of Redis Roll-Out Plan Documentation**

