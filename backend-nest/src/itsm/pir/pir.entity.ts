import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { PirStatus } from './pir.enums';

/**
 * ITSM Post-Incident Review (PIR) Entity
 *
 * Represents a structured post-incident review linked to a major incident.
 * Contains required sections for comprehensive incident analysis.
 *
 * Status flow: DRAFT → IN_REVIEW → APPROVED → CLOSED
 */
@Entity('itsm_pirs')
@Index(['tenantId', 'majorIncidentId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'createdAt'])
export class ItsmPir extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'major_incident_id', type: 'uuid' })
  majorIncidentId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({
    type: 'enum',
    enum: PirStatus,
    enumName: 'pir_status_enum',
    default: PirStatus.DRAFT,
  })
  status: PirStatus;

  // === Required Sections ===
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'what_happened', type: 'text', nullable: true })
  whatHappened: string | null;

  @Column({ name: 'timeline_highlights', type: 'text', nullable: true })
  timelineHighlights: string | null;

  @Column({ name: 'root_causes', type: 'text', nullable: true })
  rootCauses: string | null;

  @Column({ name: 'what_worked_well', type: 'text', nullable: true })
  whatWorkedWell: string | null;

  @Column({ name: 'what_did_not_work', type: 'text', nullable: true })
  whatDidNotWork: string | null;

  @Column({ name: 'customer_impact', type: 'text', nullable: true })
  customerImpact: string | null;

  @Column({ name: 'detection_effectiveness', type: 'text', nullable: true })
  detectionEffectiveness: string | null;

  @Column({ name: 'response_effectiveness', type: 'text', nullable: true })
  responseEffectiveness: string | null;

  @Column({ name: 'preventive_actions', type: 'text', nullable: true })
  preventiveActions: string | null;

  @Column({ name: 'corrective_actions', type: 'text', nullable: true })
  correctiveActions: string | null;

  // === Approval ===
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
