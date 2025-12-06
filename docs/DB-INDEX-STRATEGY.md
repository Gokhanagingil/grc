# Database Index Strategy

This document outlines the indexing strategy for the GRC Platform database to ensure optimal query performance across all modules.

## Index Design Principles

### Multi-Tenant Optimization

All queries in the GRC Platform are tenant-scoped. Therefore, `tenantId` is included as the leading column in most composite indexes to ensure efficient tenant isolation and query performance.

### Index Types Used

1. **Single-Column Indexes**: For frequently filtered columns
2. **Composite Indexes**: For common query patterns combining multiple columns
3. **Unique Indexes**: For enforcing uniqueness constraints on mapping tables

## Entity Index Definitions

### GRC Risk (`grc_risks`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_risks_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_risks_created_at` | `created_at` | Time-based queries |
| `IDX_grc_risks_updated_at` | `updated_at` | Recent changes |
| `IDX_grc_risks_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_risks_tenant_status` | `tenant_id, status` | Status filtering per tenant |
| `IDX_grc_risks_tenant_severity` | `tenant_id, severity` | Severity filtering per tenant |
| `IDX_grc_risks_tenant_owner` | `tenant_id, owner_user_id` | Owner-based queries |
| `IDX_grc_risks_tenant_status_created` | `tenant_id, status, created_at` | Dashboard queries |

### GRC Policy (`grc_policies`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_policies_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_policies_created_at` | `created_at` | Time-based queries |
| `IDX_grc_policies_updated_at` | `updated_at` | Recent changes |
| `IDX_grc_policies_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_policies_tenant_status` | `tenant_id, status` | Status filtering per tenant |
| `IDX_grc_policies_tenant_owner` | `tenant_id, owner_user_id` | Owner-based queries |
| `IDX_grc_policies_tenant_status_created` | `tenant_id, status, created_at` | Dashboard queries |

### GRC Requirement (`grc_requirements`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_requirements_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_requirements_created_at` | `created_at` | Time-based queries |
| `IDX_grc_requirements_updated_at` | `updated_at` | Recent changes |
| `IDX_grc_requirements_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_requirements_tenant_status` | `tenant_id, status` | Status filtering per tenant |
| `IDX_grc_requirements_tenant_framework` | `tenant_id, framework_id` | Framework-based queries |
| `IDX_grc_requirements_tenant_status_created` | `tenant_id, status, created_at` | Dashboard queries |

### GRC Control (`grc_controls`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_controls_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_controls_created_at` | `created_at` | Time-based queries |
| `IDX_grc_controls_updated_at` | `updated_at` | Recent changes |
| `IDX_grc_controls_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_controls_tenant_status` | `tenant_id, status` | Status filtering per tenant |
| `IDX_grc_controls_tenant_owner` | `tenant_id, owner_user_id` | Owner-based queries |
| `IDX_grc_controls_tenant_status_created` | `tenant_id, status, created_at` | Dashboard queries |

### GRC Issue (`grc_issues`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_issues_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_issues_created_at` | `created_at` | Time-based queries |
| `IDX_grc_issues_updated_at` | `updated_at` | Recent changes |
| `IDX_grc_issues_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_issues_tenant_status` | `tenant_id, status` | Status filtering per tenant |
| `IDX_grc_issues_tenant_severity` | `tenant_id, severity` | Severity filtering per tenant |
| `IDX_grc_issues_tenant_risk` | `tenant_id, risk_id` | Risk-linked issues |
| `IDX_grc_issues_tenant_control` | `tenant_id, control_id` | Control-linked issues |
| `IDX_grc_issues_tenant_status_created` | `tenant_id, status, created_at` | Dashboard queries |

### GRC CAPA (`grc_capas`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_capas_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_capas_created_at` | `created_at` | Time-based queries |
| `IDX_grc_capas_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_capas_tenant_status` | `tenant_id, status` | Status filtering per tenant |
| `IDX_grc_capas_tenant_issue` | `tenant_id, issue_id` | Issue-linked CAPAs |
| `IDX_grc_capas_tenant_status_created` | `tenant_id, status, created_at` | Dashboard queries |

### GRC Evidence (`grc_evidence`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_evidence_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_evidence_created_at` | `created_at` | Time-based queries |
| `IDX_grc_evidence_is_deleted` | `is_deleted` | Soft delete filtering |
| `IDX_grc_evidence_tenant_type` | `tenant_id, type` | Type filtering per tenant |
| `IDX_grc_evidence_tenant_collected` | `tenant_id, collected_at` | Collection date queries |

### Mapping Tables

#### Risk-Control (`grc_risk_controls`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_risk_controls_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_risk_controls_risk_id` | `risk_id` | Risk lookups |
| `IDX_grc_risk_controls_control_id` | `control_id` | Control lookups |
| `UQ_grc_risk_controls_tenant_risk_control` | `tenant_id, risk_id, control_id` | Unique constraint |

#### Policy-Control (`grc_policy_controls`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_policy_controls_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_policy_controls_policy_id` | `policy_id` | Policy lookups |
| `IDX_grc_policy_controls_control_id` | `control_id` | Control lookups |
| `UQ_grc_policy_controls_tenant_policy_control` | `tenant_id, policy_id, control_id` | Unique constraint |

#### Requirement-Control (`grc_requirement_controls`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_requirement_controls_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_requirement_controls_requirement_id` | `requirement_id` | Requirement lookups |
| `IDX_grc_requirement_controls_control_id` | `control_id` | Control lookups |
| `UQ_grc_requirement_controls_tenant_req_control` | `tenant_id, requirement_id, control_id` | Unique constraint |

#### Issue-Evidence (`grc_issue_evidence`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_grc_issue_evidence_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_grc_issue_evidence_issue_id` | `issue_id` | Issue lookups |
| `IDX_grc_issue_evidence_evidence_id` | `evidence_id` | Evidence lookups |
| `UQ_grc_issue_evidence_tenant_issue_evidence` | `tenant_id, issue_id, evidence_id` | Unique constraint |

### Audit Log (`nest_audit_logs`)

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `IDX_audit_logs_tenant_id` | `tenant_id` | Tenant isolation |
| `IDX_audit_logs_user_id` | `user_id` | User activity queries |
| `IDX_audit_logs_correlation_id` | `correlation_id` | Request tracing |
| `IDX_audit_logs_tenant_created` | `tenant_id, created_at` | Time-based tenant queries |
| `IDX_audit_logs_user_created` | `user_id, created_at` | Time-based user queries |
| `IDX_audit_logs_action_created` | `action, created_at` | Action-based queries |

## Query Optimization Guidelines

### Common Query Patterns

1. **List entities for a tenant with status filter**
   ```sql
   SELECT * FROM grc_risks 
   WHERE tenant_id = ? AND status = ? AND is_deleted = false
   ORDER BY created_at DESC
   ```
   Uses: `IDX_grc_risks_tenant_status` + `IDX_grc_risks_is_deleted`

2. **Dashboard aggregations**
   ```sql
   SELECT status, COUNT(*) FROM grc_risks 
   WHERE tenant_id = ? AND is_deleted = false
   GROUP BY status
   ```
   Uses: `IDX_grc_risks_tenant_status`

3. **Recent activity queries**
   ```sql
   SELECT * FROM grc_risks 
   WHERE tenant_id = ? AND updated_at > ?
   ORDER BY updated_at DESC
   ```
   Uses: `IDX_grc_risks_tenant_id` + `IDX_grc_risks_updated_at`

4. **Owner workload queries**
   ```sql
   SELECT * FROM grc_risks 
   WHERE tenant_id = ? AND owner_user_id = ? AND status != 'closed'
   ```
   Uses: `IDX_grc_risks_tenant_owner`

### Performance Considerations

1. **Index Selectivity**: The `tenant_id` column provides high selectivity in multi-tenant environments, making it an effective leading column for composite indexes.

2. **Covering Indexes**: For frequently accessed queries, consider adding covering indexes that include all required columns to avoid table lookups.

3. **Index Maintenance**: Regularly monitor index usage and remove unused indexes to reduce write overhead.

4. **Partial Indexes**: Consider partial indexes for soft-deleted records:
   ```sql
   CREATE INDEX idx_active_risks ON grc_risks (tenant_id, status) 
   WHERE is_deleted = false;
   ```

## Migration Strategy

All indexes are defined using TypeORM decorators on entity classes:

```typescript
@Entity('grc_risks')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'ownerUserId'])
@Index(['tenantId', 'status', 'createdAt'])
export class GrcRisk extends BaseEntity {
  // ...
}
```

TypeORM will automatically generate migrations to create these indexes when running:

```bash
npm run migration:generate -- -n AddIndexes
npm run migration:run
```

## Monitoring and Maintenance

### Index Usage Analysis

Periodically review index usage with PostgreSQL:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Identifying Missing Indexes

Use PostgreSQL's query planner to identify slow queries:

```sql
SELECT 
  query,
  calls,
  mean_time,
  total_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;
```

### Index Bloat Detection

Monitor index bloat and schedule reindexing as needed:

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```
