import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import {
  ItsmIncidentState,
  ItsmIncidentImpact,
  ItsmIncidentUrgency,
  ItsmIncidentPriority,
} from '../enums';
import { ItsmService } from './itsm-service.entity';

/**
 * ITSM Incident Entity
 *
 * Represents an IT incident in the ITSM module (ITIL v5 aligned).
 * Incidents track unplanned interruptions or reductions in quality of IT services.
 *
 * Key ITIL v5 principles:
 * - Value-focused: Links to services to understand business impact
 * - Risk-aware: riskReviewRequired flag for GRC bridge integration
 * - Measurable: State transitions with timestamps for SLA tracking
 * - Audit trail ready: Extends BaseEntity for full audit history
 */
@Entity('itsm_incidents')
@Index(['tenantId', 'state'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'assigneeId'])
@Index(['tenantId', 'riskReviewRequired'])
@Index(['tenantId', 'number'], { unique: true })
export class ItsmIncident extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Column({ name: 'short_description', type: 'varchar', length: 255 })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ItsmIncidentState,
    default: ItsmIncidentState.NEW,
  })
  state: ItsmIncidentState;

  @Column({
    type: 'enum',
    enum: ItsmIncidentImpact,
    default: ItsmIncidentImpact.MEDIUM,
  })
  impact: ItsmIncidentImpact;

  @Column({
    type: 'enum',
    enum: ItsmIncidentUrgency,
    default: ItsmIncidentUrgency.MEDIUM,
  })
  urgency: ItsmIncidentUrgency;

  @Column({
    type: 'enum',
    enum: ItsmIncidentPriority,
    default: ItsmIncidentPriority.P3,
  })
  priority: ItsmIncidentPriority;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'requester_id', type: 'uuid', nullable: true })
  requesterId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requester_id' })
  requester: User | null;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  @Column({ name: 'assignment_group_id', type: 'uuid', nullable: true })
  assignmentGroupId: string | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => ItsmService, { nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: ItsmService | null;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  /**
   * GRC Bridge: Risk Review Required flag
   * Set to true when:
   * - Priority is P1 and linked service is CRITICAL
   * - Repeated incidents on same service within threshold period
   */
  @Column({
    name: 'risk_review_required',
    type: 'boolean',
    default: false,
  })
  riskReviewRequired: boolean;

  @Column({ name: 'customer_company_id', type: 'uuid', nullable: true })
  customerCompanyId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // GRC Bridge relationships will be added via join tables
  // itsm_incident_risks, itsm_incident_controls
}
