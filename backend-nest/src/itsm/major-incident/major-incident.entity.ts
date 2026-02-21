import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { MajorIncidentStatus, MajorIncidentSeverity } from './major-incident.enums';

/**
 * ITSM Major Incident Entity
 *
 * Represents a major incident coordination record.
 * Major incidents involve significant business impact and require
 * structured command-and-control response.
 *
 * Status flow:
 * DECLARED → INVESTIGATING → MITIGATING → MONITORING → RESOLVED → PIR_PENDING → CLOSED
 */
@Entity('itsm_major_incidents')
@Index(['tenantId', 'number'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'commanderId'])
export class ItsmMajorIncident extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: MajorIncidentStatus,
    enumName: 'itsm_major_incident_status_enum',
    default: MajorIncidentStatus.DECLARED,
  })
  status: MajorIncidentStatus;

  @Column({
    type: 'enum',
    enum: MajorIncidentSeverity,
    enumName: 'itsm_major_incident_severity_enum',
    default: MajorIncidentSeverity.SEV1,
  })
  severity: MajorIncidentSeverity;

  // === Role Assignments ===
  @Column({ name: 'commander_id', type: 'uuid', nullable: true })
  commanderId: string | null;

  @Column({ name: 'communications_lead_id', type: 'uuid', nullable: true })
  communicationsLeadId: string | null;

  @Column({ name: 'tech_lead_id', type: 'uuid', nullable: true })
  techLeadId: string | null;

  // === Bridge / War Room ===
  @Column({ name: 'bridge_url', type: 'varchar', length: 500, nullable: true })
  bridgeUrl: string | null;

  @Column({ name: 'bridge_channel', type: 'varchar', length: 255, nullable: true })
  bridgeChannel: string | null;

  @Column({ name: 'bridge_started_at', type: 'timestamptz', nullable: true })
  bridgeStartedAt: Date | null;

  @Column({ name: 'bridge_ended_at', type: 'timestamptz', nullable: true })
  bridgeEndedAt: Date | null;

  // === Impact Summary ===
  @Column({ name: 'customer_impact_summary', type: 'text', nullable: true })
  customerImpactSummary: string | null;

  @Column({ name: 'business_impact_summary', type: 'text', nullable: true })
  businessImpactSummary: string | null;

  // === Service / Offering References (primary affected) ===
  @Column({ name: 'primary_service_id', type: 'uuid', nullable: true })
  primaryServiceId: string | null;

  @Column({ name: 'primary_offering_id', type: 'uuid', nullable: true })
  primaryOfferingId: string | null;

  // === Lifecycle Timestamps ===
  @Column({ name: 'declared_at', type: 'timestamptz', nullable: true })
  declaredAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  // === Resolution ===
  @Column({ name: 'resolution_summary', type: 'text', nullable: true })
  resolutionSummary: string | null;

  @Column({ name: 'resolution_code', type: 'varchar', length: 100, nullable: true })
  resolutionCode: string | null;

  // === Source Reference ===
  @Column({ name: 'source_incident_id', type: 'uuid', nullable: true })
  sourceIncidentId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
