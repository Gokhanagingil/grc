import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum SlaMetric {
  RESPONSE_TIME = 'RESPONSE_TIME',
  RESOLUTION_TIME = 'RESOLUTION_TIME',
}

export enum SlaSchedule {
  TWENTY_FOUR_SEVEN = '24X7',
  BUSINESS_HOURS = 'BUSINESS_HOURS',
}

/**
 * SLA 2.0 — Applies-to record type.
 * Start with INCIDENT; extensible for CHANGE, PROBLEM, REQUEST, TASK later.
 */
export enum SlaRecordType {
  INCIDENT = 'INCIDENT',
  CHANGE = 'CHANGE',
  PROBLEM = 'PROBLEM',
  REQUEST = 'REQUEST',
  TASK = 'TASK',
  CHANGE_TASK = 'CHANGE_TASK',
}

/**
 * Objective types carried by an SLA instance.
 */
export enum SlaObjectiveType {
  RESPONSE = 'RESPONSE',
  RESOLUTION = 'RESOLUTION',
}

/**
 * Condition tree node types for the condition builder JSON schema.
 */
export interface SlaConditionGroup {
  operator: 'AND' | 'OR';
  children: (SlaConditionGroup | SlaConditionLeaf)[];
}

export interface SlaConditionLeaf {
  field: string;
  operator: string;
  value: unknown;
}

export type SlaConditionNode = SlaConditionGroup | SlaConditionLeaf;

/** Type guard: is this node a group (AND/OR)? */
export function isConditionGroup(
  node: SlaConditionNode,
): node is SlaConditionGroup {
  return (
    node !== null &&
    typeof node === 'object' &&
    'operator' in node &&
    'children' in node &&
    Array.isArray(node.children)
  );
}

@Entity('itsm_sla_definitions')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'isActive'])
export class SlaDefinition extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ── Legacy v1 fields (kept for backward compatibility) ───────────
  @Column({
    type: 'enum',
    enum: SlaMetric,
    default: SlaMetric.RESOLUTION_TIME,
  })
  metric: SlaMetric;

  @Column({ name: 'target_seconds', type: 'int' })
  targetSeconds: number;

  @Column({
    type: 'enum',
    enum: SlaSchedule,
    default: SlaSchedule.TWENTY_FOUR_SEVEN,
  })
  schedule: SlaSchedule;

  @Column({ name: 'business_start_hour', type: 'int', default: 9 })
  businessStartHour: number;

  @Column({ name: 'business_end_hour', type: 'int', default: 17 })
  businessEndHour: number;

  @Column({ name: 'business_days', type: 'jsonb', default: '[1,2,3,4,5]' })
  businessDays: number[];

  @Column({ name: 'priority_filter', type: 'jsonb', nullable: true })
  priorityFilter: string[] | null;

  @Column({ name: 'service_id_filter', type: 'uuid', nullable: true })
  serviceIdFilter: string | null;

  @Column({
    name: 'stop_on_states',
    type: 'jsonb',
    default: '["resolved","closed"]',
  })
  stopOnStates: string[];

  @Column({
    name: 'pause_on_states',
    type: 'jsonb',
    nullable: true,
  })
  pauseOnStates: string[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  // ── SLA 2.0 fields ──────────────────────────────────────────────

  /** Record type this policy applies to (INCIDENT, CHANGE, etc.) */
  @Column({
    name: 'applies_to_record_type',
    type: 'varchar',
    length: 50,
    default: 'INCIDENT',
  })
  appliesToRecordType: string;

  /** Condition builder JSON tree (AND/OR with leaf conditions) */
  @Column({ name: 'condition_tree', type: 'jsonb', nullable: true })
  conditionTree: SlaConditionNode | null;

  /** Response time target in seconds (separate from legacy targetSeconds) */
  @Column({ name: 'response_time_seconds', type: 'int', nullable: true })
  responseTimeSeconds: number | null;

  /** Resolution time target in seconds (separate from legacy targetSeconds) */
  @Column({ name: 'resolution_time_seconds', type: 'int', nullable: true })
  resolutionTimeSeconds: number | null;

  /** Precedence weight — higher = matched first (descending) */
  @Column({ name: 'priority_weight', type: 'int', default: 0 })
  priorityWeight: number;

  /** If true, stop evaluating further policies after this one matches */
  @Column({ name: 'stop_processing', type: 'boolean', default: false })
  stopProcessing: boolean;

  /** Optional effective date range */
  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  /** Schema version for future migrations */
  @Column({ type: 'int', default: 1 })
  version: number;
}
