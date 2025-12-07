# GRC Domain Performance and Indexing Strategy

This document describes the database indexing strategy and performance considerations for the GRC (Governance, Risk, Compliance) domain.

## Overview

The GRC domain consists of three main entities: Risk, Policy, and Requirement. All entities support multi-tenancy via `tenantId` and soft delete via `isDeleted` flag. This document outlines the indexing strategy to ensure efficient queries while maintaining tenant isolation.

## Entity Index Summary

### GrcRisk Entity (`grc_risks` table)

| Index | Columns | Type | Purpose |
|-------|---------|------|---------|
| Primary | `id` | Unique | Primary key lookup |
| Tenant + Status | `tenantId`, `status` | Composite | Filter risks by status within tenant |
| Tenant + Severity | `tenantId`, `severity` | Composite | Filter risks by severity within tenant |
| Tenant + Owner | `tenantId`, `ownerUserId` | Composite | Filter risks by owner within tenant |
| Tenant + Status + CreatedAt | `tenantId`, `status`, `createdAt` | Composite | Paginated listing with status filter |

**Inherited from BaseEntity:**
- `tenantId` (single column index)
- `createdAt` (single column index)
- `updatedAt` (single column index)
- `isDeleted` (single column index)

### GrcPolicy Entity (`grc_policies` table)

| Index | Columns | Type | Purpose |
|-------|---------|------|---------|
| Primary | `id` | Unique | Primary key lookup |
| Tenant + Status | `tenantId`, `status` | Composite | Filter policies by status within tenant |
| Tenant + Category | `tenantId`, `category` | Composite | Filter policies by category within tenant |
| Tenant + Code | `tenantId`, `code` | Unique (partial) | Unique policy code per tenant (where code IS NOT NULL) |
| Tenant + Status + CreatedAt | `tenantId`, `status`, `createdAt` | Composite | Paginated listing with status filter |

**Inherited from BaseEntity:**
- `tenantId` (single column index)
- `createdAt` (single column index)
- `updatedAt` (single column index)
- `isDeleted` (single column index)

### GrcRequirement Entity (`grc_requirements` table)

| Index | Columns | Type | Purpose |
|-------|---------|------|---------|
| Primary | `id` | Unique | Primary key lookup |
| Tenant + Framework | `tenantId`, `framework` | Composite | Filter requirements by framework within tenant |
| Tenant + Status | `tenantId`, `status` | Composite | Filter requirements by status within tenant |
| Tenant + Framework + RefCode | `tenantId`, `framework`, `referenceCode` | Unique | Unique reference code per framework per tenant |
| Tenant + Status + CreatedAt | `tenantId`, `status`, `createdAt` | Composite | Paginated listing with status filter |

**Inherited from BaseEntity:**
- `tenantId` (single column index)
- `createdAt` (single column index)
- `updatedAt` (single column index)
- `isDeleted` (single column index)

## Query Patterns and Index Usage

### Common Query Patterns

All GRC queries follow these patterns to ensure tenant isolation:

```sql
-- Base filter (always applied)
WHERE tenantId = :tenantId AND isDeleted = false

-- List with status filter
WHERE tenantId = :tenantId AND isDeleted = false AND status = :status
ORDER BY createdAt DESC
LIMIT :pageSize OFFSET :offset

-- Single entity lookup
WHERE id = :id AND tenantId = :tenantId AND isDeleted = false
```

### Index Utilization

The composite indexes are designed to support the most common query patterns:

1. **Tenant + Status indexes** - Used for filtered listings (e.g., "show all identified risks")
2. **Tenant + Status + CreatedAt indexes** - Used for paginated listings with sorting
3. **Tenant + Category/Framework indexes** - Used for category/framework-based filtering
4. **Unique indexes** - Enforce business rules (unique policy codes, unique requirement reference codes)

## N+1 Query Analysis

### Current Implementation

The GRC services use the following query patterns:

| Method | Query Pattern | N+1 Risk |
|--------|---------------|----------|
| `findWithFilters` | QueryBuilder without joins | No N+1 risk |
| `findOneActiveForTenant` | Single entity lookup | No N+1 risk |
| `findAllActiveForTenant` | Bulk fetch with optional relations | Low risk (relations loaded eagerly if specified) |
| `getStatistics` | Bulk fetch then in-memory aggregation | No N+1 risk |
| `findWithControls` | Single entity with relations | Low risk (single query with join) |

### Recommendations

1. **Statistics queries**: Consider using SQL `GROUP BY` for large datasets instead of in-memory aggregation
2. **List endpoints**: Pagination is implemented via `LIMIT/OFFSET` - consider cursor-based pagination for very large datasets
3. **Relations**: Use `leftJoinAndSelect` sparingly and only when relations are needed

## Performance Best Practices

### Tenant Isolation

All queries MUST include `tenantId` in the WHERE clause. This is enforced at the service level through:

1. `MultiTenantServiceBase` - Base class that automatically adds tenant filter
2. `TenantGuard` - Validates tenant access at the controller level
3. Composite indexes - Ensure tenant-scoped queries are efficient

### Soft Delete

All queries MUST include `isDeleted = false` filter. This is handled by:

1. Service methods like `findOneActiveForTenant` and `findAllActiveForTenant`
2. Custom query builders that explicitly add the filter

### Pagination

All list endpoints support pagination with:

- `page` - Page number (1-indexed)
- `pageSize` - Items per page (default: 20, max: 100)
- `sortBy` - Field to sort by
- `sortOrder` - ASC or DESC

## Future Improvements

### Short-term

1. **Query optimization**: Add `EXPLAIN ANALYZE` logging for slow queries
2. **Connection pooling**: Ensure TypeORM connection pool is properly configured
3. **Query caching**: Consider Redis caching for frequently accessed read-only data

### Medium-term

1. **Cursor-based pagination**: Replace OFFSET pagination for large datasets
2. **Read replicas**: Route read queries to replicas for high-traffic scenarios
3. **Materialized views**: Pre-compute statistics for dashboard queries

### Long-term

1. **Sharding**: Consider tenant-based sharding for very large deployments
2. **Event sourcing**: Track all changes for audit and analytics
3. **CQRS**: Separate read and write models for complex reporting needs

## Monitoring Recommendations

1. **Query performance**: Monitor slow queries (> 100ms)
2. **Index usage**: Periodically review index usage statistics
3. **Connection pool**: Monitor pool utilization and wait times
4. **Table sizes**: Track table growth and plan for scaling

## Conclusion

The current indexing strategy provides good coverage for the most common query patterns. The composite indexes on `tenantId` combined with frequently filtered columns ensure efficient tenant-scoped queries. The soft delete pattern is consistently applied across all entities.

Key strengths:
- Comprehensive composite indexes for common query patterns
- Unique constraints for business rules
- Consistent tenant isolation at all levels

Areas for future optimization:
- Statistics queries could use SQL aggregation for large datasets
- Consider cursor-based pagination for very large result sets
- Add query performance monitoring
