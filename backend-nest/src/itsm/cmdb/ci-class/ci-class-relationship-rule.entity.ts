/**
 * CMDB CI Class Relationship Rule Entity
 *
 * Defines which relationship types a CI class can initiate or receive.
 * These rules form an "allow-list" that governs valid relationship patterns
 * at the class level. Rules are inheritance-aware: a child class inherits
 * all rules from its ancestors, and can add or override them.
 *
 * Effective rules for a class = union(ancestor rules + local rules),
 * with local rules taking precedence on (sourceClassId, relationshipTypeId, targetClassId) collision.
 */
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

/**
 * Propagation policy override at the class-rule level.
 * Allows a class to override the default propagation from the relationship type.
 */
export enum PropagationPolicy {
  NONE = 'NONE',
  UPSTREAM_ONLY = 'UPSTREAM_ONLY',
  DOWNSTREAM_ONLY = 'DOWNSTREAM_ONLY',
  BOTH = 'BOTH',
}

/**
 * Propagation weight hint for risk/impact scoring.
 */
export enum PropagationWeight {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/**
 * Direction of the rule from the perspective of the owning class.
 */
export enum RuleDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
}

@Entity('cmdb_ci_class_relationship_rule')
@Index(['tenantId', 'sourceClassId', 'relationshipTypeId', 'targetClassId'], {
  unique: true,
})
@Index(['tenantId', 'sourceClassId'])
@Index(['tenantId', 'targetClassId'])
@Index(['tenantId', 'relationshipTypeId'])
@Index(['tenantId', 'isActive'])
export class CmdbCiClassRelationshipRule extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /** The class that owns this rule (the "source" perspective class) */
  @Column({ name: 'source_class_id', type: 'uuid' })
  sourceClassId: string;

  /** The relationship type this rule governs */
  @Column({ name: 'relationship_type_id', type: 'uuid' })
  relationshipTypeId: string;

  /** The target class allowed by this rule (specific target) */
  @Column({ name: 'target_class_id', type: 'uuid' })
  targetClassId: string;

  /** Direction: OUTBOUND means sourceClass initiates, INBOUND means sourceClass receives */
  @Column({
    type: 'varchar',
    length: 20,
    default: RuleDirection.OUTBOUND,
  })
  direction: RuleDirection;

  /**
   * Optional propagation policy override.
   * If null, the relationship type's default propagation is used.
   */
  @Column({
    name: 'propagation_override',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  propagationOverride: PropagationPolicy | null;

  /**
   * Optional propagation weight hint for risk scoring.
   */
  @Column({
    name: 'propagation_weight',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  propagationWeight: PropagationWeight | null;

  /** Whether this rule is active */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this is a system-defined rule (baseline content pack managed) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
