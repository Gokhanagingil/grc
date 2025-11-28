import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

/**
 * Adds tenant isolation filter to a TypeORM query builder
 * @param qb Query builder instance
 * @param tenantId Tenant ID to filter by
 * @returns Query builder with tenant filter applied
 */
export function withTenant<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  tenantId: string,
): SelectQueryBuilder<T> {
  // Check if tenant_id column exists in the main table
  const alias = qb.alias;
  const tenantColumn = `${alias}.tenant_id`;

  return qb.andWhere(`${tenantColumn} = :tenantId`, { tenantId });
}

/**
 * Creates a tenant-scoped WHERE condition object
 * @param tenantId Tenant ID
 * @returns Where condition object
 */
export function tenantWhere(tenantId: string): { tenant_id: string } {
  return { tenant_id: tenantId };
}
