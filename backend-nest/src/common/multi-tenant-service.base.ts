import {
  Repository,
  FindOptionsWhere,
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
} from 'typeorm';

/**
 * Interface for entities that support multi-tenancy
 *
 * The tenantId can be:
 * - string: entity belongs to a specific tenant
 * - null: entity is system-wide (no tenant)
 * - undefined: entity's tenant is not yet assigned
 */
export interface TenantAwareEntity {
  id: string;
  tenantId?: string | null;
}

/**
 * Multi-Tenant Service Base
 *
 * A base service class that provides tenant-aware CRUD operations.
 * Uses service composition pattern to wrap a TypeORM repository.
 *
 * All query methods automatically filter by tenantId to ensure
 * tenant isolation. Create/update methods automatically set the tenantId.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class RisksService extends MultiTenantServiceBase<Risk> {
 *   constructor(
 *     @InjectRepository(Risk)
 *     repository: Repository<Risk>,
 *   ) {
 *     super(repository);
 *   }
 *
 *   // Add custom methods as needed
 *   async findHighRisks(tenantId: string): Promise<Risk[]> {
 *     return this.findAllForTenant(tenantId, {
 *       where: { riskScore: MoreThan(50) },
 *     });
 *   }
 * }
 * ```
 */
export abstract class MultiTenantServiceBase<T extends TenantAwareEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  /**
   * Find all entities for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param options - Additional find options (where, order, relations, etc.)
   * @returns Array of entities belonging to the tenant
   */
  async findAllForTenant(
    tenantId: string,
    options?: Omit<FindManyOptions<T>, 'where'> & {
      where?: FindOptionsWhere<T>;
    },
  ): Promise<T[]> {
    const where = {
      ...((options?.where || {}) as FindOptionsWhere<T>),
      tenantId,
    } as FindOptionsWhere<T>;

    return this.repository.find({
      ...options,
      where,
    });
  }

  /**
   * Find one entity by ID for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param id - The entity ID
   * @param options - Additional find options (relations, etc.)
   * @returns The entity if found and belongs to tenant, null otherwise
   */
  async findOneForTenant(
    tenantId: string,
    id: string,
    options?: Omit<FindOneOptions<T>, 'where'>,
  ): Promise<T | null> {
    const where = {
      id,
      tenantId,
    } as FindOptionsWhere<T>;

    return this.repository.findOne({
      ...options,
      where,
    });
  }

  /**
   * Find one entity by custom criteria for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param where - Additional where conditions
   * @param options - Additional find options (relations, etc.)
   * @returns The entity if found and belongs to tenant, null otherwise
   */
  async findOneByForTenant(
    tenantId: string,
    where: FindOptionsWhere<T>,
    options?: Omit<FindOneOptions<T>, 'where'>,
  ): Promise<T | null> {
    const combinedWhere = {
      ...where,
      tenantId,
    } as FindOptionsWhere<T>;

    return this.repository.findOne({
      ...options,
      where: combinedWhere,
    });
  }

  /**
   * Create a new entity for a specific tenant
   *
   * @param tenantId - The tenant ID to assign
   * @param data - The entity data (without tenantId)
   * @returns The created entity
   */
  async createForTenant(
    tenantId: string,
    data: Omit<DeepPartial<T>, 'tenantId'>,
  ): Promise<T> {
    const entity = this.repository.create({
      ...data,
      tenantId,
    } as DeepPartial<T>);

    return this.repository.save(entity);
  }

  /**
   * Update an entity for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param id - The entity ID
   * @param data - The update data
   * @returns The updated entity if found and belongs to tenant, null otherwise
   */
  async updateForTenant(
    tenantId: string,
    id: string,
    data: Partial<Omit<T, 'id' | 'tenantId'>>,
  ): Promise<T | null> {
    // First verify the entity belongs to the tenant
    const existing = await this.findOneForTenant(tenantId, id);
    if (!existing) {
      return null;
    }

    // Merge and save
    const updated = this.repository.merge(existing, data as DeepPartial<T>);
    return this.repository.save(updated);
  }

  /**
   * Delete an entity for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param id - The entity ID
   * @returns True if deleted, false if not found or doesn't belong to tenant
   */
  async deleteForTenant(tenantId: string, id: string): Promise<boolean> {
    // First verify the entity belongs to the tenant
    const existing = await this.findOneForTenant(tenantId, id);
    if (!existing) {
      return false;
    }

    await this.repository.remove(existing);
    return true;
  }

  /**
   * Count entities for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param where - Additional where conditions
   * @returns The count of entities
   */
  async countForTenant(
    tenantId: string,
    where?: FindOptionsWhere<T>,
  ): Promise<number> {
    const combinedWhere = {
      ...(where || {}),
      tenantId,
    } as FindOptionsWhere<T>;

    return this.repository.count({ where: combinedWhere });
  }

  /**
   * Check if an entity exists for a specific tenant
   *
   * @param tenantId - The tenant ID to filter by
   * @param id - The entity ID
   * @returns True if exists and belongs to tenant
   */
  async existsForTenant(tenantId: string, id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, tenantId } as FindOptionsWhere<T>,
    });
    return count > 0;
  }
}
