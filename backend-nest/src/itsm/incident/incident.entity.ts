import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcRisk } from '../../grc/entities/grc-risk.entity';
import { GrcPolicy } from '../../grc/entities/grc-policy.entity';
import { CmdbService } from '../cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../cmdb/service-offering/cmdb-service-offering.entity';
import {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
  IncidentPriority,
  IncidentStatus,
  IncidentSource,
} from '../enums';

/**
 * ITSM Incident Entity
 *
 * Represents an IT service incident following ITIL best practices.
 * Incidents track service disruptions and their resolution lifecycle.
 * Extends BaseEntity for standard audit fields and soft delete.
 */
@Entity('itsm_incidents')
@Index(['tenantId', 'number'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'assignmentGroup'])
@Index(['tenantId', 'assignedTo'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'offeringId'])
export class ItsmIncident extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ name: 'short_description', type: 'varchar', length: 255 })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: IncidentCategory,
    default: IncidentCategory.OTHER,
  })
  category: IncidentCategory;

  @Column({
    type: 'enum',
    enum: IncidentImpact,
    default: IncidentImpact.MEDIUM,
  })
  impact: IncidentImpact;

  @Column({
    type: 'enum',
    enum: IncidentUrgency,
    default: IncidentUrgency.MEDIUM,
  })
  urgency: IncidentUrgency;

  @Column({
    type: 'enum',
    enum: IncidentPriority,
    default: IncidentPriority.P3,
  })
  priority: IncidentPriority;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.OPEN,
  })
  status: IncidentStatus;

  @Column({
    type: 'enum',
    enum: IncidentSource,
    default: IncidentSource.USER,
  })
  source: IncidentSource;

  @Column({
    name: 'assignment_group',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  assignmentGroup: string | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee: User | null;

  @Column({
    name: 'related_service',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  relatedService: string | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => CmdbService, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_id' })
  cmdbService: CmdbService | null;

  @Column({ name: 'offering_id', type: 'uuid', nullable: true })
  offeringId: string | null;

  @ManyToOne(() => CmdbServiceOffering, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'offering_id' })
  offering: CmdbServiceOffering | null;

  @Column({ name: 'related_risk_id', type: 'uuid', nullable: true })
  relatedRiskId: string | null;

  @ManyToOne(() => GrcRisk, { nullable: true })
  @JoinColumn({ name: 'related_risk_id' })
  relatedRisk: GrcRisk | null;

  @Column({ name: 'related_policy_id', type: 'uuid', nullable: true })
  relatedPolicyId: string | null;

  @ManyToOne(() => GrcPolicy, { nullable: true })
  @JoinColumn({ name: 'related_policy_id' })
  relatedPolicy: GrcPolicy | null;

  @Column({ name: 'first_response_at', type: 'timestamp', nullable: true })
  firstResponseAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
