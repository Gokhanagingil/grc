import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { BcmBiaStatus, BcmCriticalityTier } from '../enums';
import { BcmService } from './bcm-service.entity';

/**
 * BCM BIA (Business Impact Analysis) Entity
 *
 * Represents a Business Impact Analysis for a BCM Service.
 * Contains RTO, RPO, MTPD, impact scores, and criticality assessment.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('bcm_bias')
@Index(['tenantId', 'serviceId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'criticalityTier'])
@Index(['tenantId', 'createdAt'])
export class BcmBia extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => BcmService, (service) => service.bias, { nullable: false })
  @JoinColumn({ name: 'service_id' })
  service: BcmService;

  @Column({ name: 'rto_minutes', type: 'int' })
  rtoMinutes: number;

  @Column({ name: 'rpo_minutes', type: 'int' })
  rpoMinutes: number;

  @Column({ name: 'mtpd_minutes', type: 'int', nullable: true })
  mtpdMinutes: number | null;

  @Column({ name: 'impact_operational', type: 'int', default: 0 })
  impactOperational: number;

  @Column({ name: 'impact_financial', type: 'int', default: 0 })
  impactFinancial: number;

  @Column({ name: 'impact_regulatory', type: 'int', default: 0 })
  impactRegulatory: number;

  @Column({ name: 'impact_reputational', type: 'int', default: 0 })
  impactReputational: number;

  @Column({ name: 'overall_impact_score', type: 'int', nullable: true })
  overallImpactScore: number | null;

  @Column({
    name: 'criticality_tier',
    type: 'enum',
    enum: BcmCriticalityTier,
    nullable: true,
  })
  criticalityTier: BcmCriticalityTier | null;

  @Column({ type: 'text', nullable: true })
  assumptions: string | null;

  @Column({ type: 'text', nullable: true })
  dependencies: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: BcmBiaStatus,
    default: BcmBiaStatus.DRAFT,
  })
  status: BcmBiaStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
