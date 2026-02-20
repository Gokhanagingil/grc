import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcAuditRequirement } from './grc-audit-requirement.entity';

/**
 * Audit Status Enum
 */
export enum AuditStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

/**
 * Audit Type Enum
 */
export enum AuditType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  REGULATORY = 'regulatory',
  COMPLIANCE = 'compliance',
}

/**
 * Audit Risk Level Enum
 */
export enum AuditRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * GRC Audit Entity
 *
 * Represents an audit in the organization's audit management system.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_audits')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'auditType'])
@Index(['tenantId', 'department'])
@Index(['tenantId', 'code'], { unique: true, where: 'code IS NOT NULL' })
@Index(['tenantId', 'status', 'createdAt'])
export class GrcAudit extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: AuditType,
    default: AuditType.INTERNAL,
    name: 'audit_type',
  })
  auditType: AuditType;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.PLANNED,
  })
  status: AuditStatus;

  @Column({
    type: 'enum',
    enum: AuditRiskLevel,
    default: AuditRiskLevel.MEDIUM,
    name: 'risk_level',
  })
  riskLevel: AuditRiskLevel;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'lead_auditor_id', type: 'uuid', nullable: true })
  leadAuditorId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_auditor_id' })
  leadAuditor: User | null;

  @Column({ name: 'planned_start_date', type: 'date', nullable: true })
  plannedStartDate: Date | null;

  @Column({ name: 'planned_end_date', type: 'date', nullable: true })
  plannedEndDate: Date | null;

  @Column({ name: 'actual_start_date', type: 'date', nullable: true })
  actualStartDate: Date | null;

  @Column({ name: 'actual_end_date', type: 'date', nullable: true })
  actualEndDate: Date | null;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ type: 'text', nullable: true })
  objectives: string | null;

  @Column({ type: 'text', nullable: true })
  methodology: string | null;

  @Column({ name: 'findings_summary', type: 'text', nullable: true })
  findingsSummary: string | null;

  @Column({ type: 'text', nullable: true })
  recommendations: string | null;

  @Column({ type: 'text', nullable: true })
  conclusion: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcAuditRequirement, (ar) => ar.audit)
  auditRequirements: GrcAuditRequirement[];
}
