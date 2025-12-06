import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Base Entity
 *
 * Abstract base class that provides common fields for all domain entities.
 * All entities should extend this class to ensure consistent schema.
 *
 * Fields provided:
 * - id: UUID primary key
 * - tenantId: Multi-tenant isolation
 * - createdAt: Record creation timestamp
 * - updatedAt: Record last update timestamp
 * - createdBy: User who created the record
 * - updatedBy: User who last updated the record
 * - isDeleted: Soft delete flag
 *
 * Naming conventions:
 * - snake_case for all column names
 * - Foreign keys end with _id
 * - Timestamps end with _at
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Index()
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  @Index()
  isDeleted: boolean;
}

/**
 * Base Entity Without Tenant
 *
 * For entities that don't require tenant isolation (e.g., Tenant itself).
 * Provides all common fields except tenantId.
 */
export abstract class BaseEntityWithoutTenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Index()
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  @Index()
  isDeleted: boolean;
}

/**
 * Mapping Entity Base
 *
 * For many-to-many mapping entities that don't need full audit fields.
 * Provides: id, tenantId, createdAt only.
 */
export abstract class MappingEntityBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
