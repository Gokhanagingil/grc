import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmIncident } from './itsm-incident.entity';
import { GrcRisk } from './grc-risk.entity';

/**
 * ITSM Incident Risk Link Entity
 *
 * Join table linking ITSM incidents to GRC risks.
 * Part of the GRC Bridge v1 implementation.
 */
@Entity('itsm_incident_risks')
@Index(['tenantId', 'incidentId', 'riskId'], { unique: true })
@Index(['tenantId', 'incidentId'])
@Index(['tenantId', 'riskId'])
export class ItsmIncidentRisk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @ManyToOne(() => ItsmIncident, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: ItsmIncident;

  @Column({ name: 'risk_id', type: 'uuid' })
  riskId: string;

  @ManyToOne(() => GrcRisk, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
