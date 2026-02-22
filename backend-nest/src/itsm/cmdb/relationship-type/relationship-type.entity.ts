import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';

/**
 * Directionality of a relationship type.
 */
export enum RelationshipDirectionality {
  UNIDIRECTIONAL = 'unidirectional',
  BIDIRECTIONAL = 'bidirectional',
}

/**
 * Risk propagation hint for topology / change risk analysis.
 */
export enum RiskPropagationHint {
  /** Risk flows from source to target (e.g. depends_on) */
  FORWARD = 'forward',
  /** Risk flows from target to source (e.g. hosts) */
  REVERSE = 'reverse',
  /** Risk flows both ways */
  BOTH = 'both',
  /** No risk propagation */
  NONE = 'none',
}

/**
 * Relationship Type Semantics Catalog.
 *
 * Defines the semantic meaning of relationship types used in CMDB CI relationships.
 * Provides governance over what relationships are allowed, their directionality,
 * and how risk propagates through the topology.
 *
 * Examples:
 * - depends_on: Service A depends_on Service B (unidirectional, forward risk)
 * - hosts: Server hosts Application (unidirectional, reverse risk)
 * - connects_to: Network device connects_to another (bidirectional, both risk)
 */
@Entity('cmdb_relationship_type')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
export class CmdbRelationshipType extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /** Machine-readable name (e.g. depends_on, hosts, runs_on) */
  @Column({ type: 'varchar', length: 50 })
  name: string;

  /** Human-readable label (e.g. "Depends On", "Hosts") */
  @Column({ type: 'varchar', length: 100 })
  label: string;

  /** Description of what this relationship means */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Directionality: unidirectional or bidirectional */
  @Column({
    type: 'varchar',
    length: 20,
    default: RelationshipDirectionality.UNIDIRECTIONAL,
  })
  directionality: RelationshipDirectionality;

  /** Inverse relationship label (e.g. "Depends On" -> "Depended On By") */
  @Column({
    name: 'inverse_label',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  inverseLabel: string | null;

  /** Risk propagation hint for topology analysis */
  @Column({
    name: 'risk_propagation',
    type: 'varchar',
    length: 20,
    default: RiskPropagationHint.FORWARD,
  })
  riskPropagation: RiskPropagationHint;

  /**
   * Optional allowed source class names (if empty, any class is allowed).
   * Stored as JSONB array of class names.
   */
  @Column({
    name: 'allowed_source_classes',
    type: 'jsonb',
    nullable: true,
  })
  allowedSourceClasses: string[] | null;

  /**
   * Optional allowed target class names (if empty, any class is allowed).
   * Stored as JSONB array of class names.
   */
  @Column({
    name: 'allowed_target_classes',
    type: 'jsonb',
    nullable: true,
  })
  allowedTargetClasses: string[] | null;

  /** Whether self-loops (source=target) are allowed for this type */
  @Column({
    name: 'allow_self_loop',
    type: 'boolean',
    default: false,
  })
  allowSelfLoop: boolean;

  /** Whether cycles are allowed when this relationship type is used */
  @Column({
    name: 'allow_cycles',
    type: 'boolean',
    default: true,
  })
  allowCycles: boolean;

  /** Sort order for UI listing */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Whether this is a system-defined type (not user-deletable) */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Additional metadata */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
