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
import { GrcControl } from './grc-control.entity';

/**
 * ITSM Incident Control Link Entity
 *
 * Join table linking ITSM incidents to GRC controls.
 * Part of the GRC Bridge v1 implementation.
 */
@Entity('itsm_incident_controls')
@Index(['tenantId', 'incidentId', 'controlId'], { unique: true })
@Index(['tenantId', 'incidentId'])
@Index(['tenantId', 'controlId'])
export class ItsmIncidentControl {
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

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => GrcControl, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
