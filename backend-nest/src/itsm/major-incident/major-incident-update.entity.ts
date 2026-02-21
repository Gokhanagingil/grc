import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmMajorIncident } from './major-incident.entity';
import {
  MajorIncidentUpdateType,
  MajorIncidentUpdateVisibility,
} from './major-incident.enums';

/**
 * Major Incident Timeline Update Entity
 *
 * Represents a chronological update entry in the major incident timeline.
 * Supports both internal (team-only) and external (stakeholder) visibility.
 */
@Entity('itsm_major_incident_updates')
@Index(['tenantId', 'majorIncidentId', 'createdAt'])
@Index(['tenantId', 'majorIncidentId', 'updateType'])
export class ItsmMajorIncidentUpdate extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'major_incident_id', type: 'uuid' })
  majorIncidentId: string;

  @ManyToOne(() => ItsmMajorIncident, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'major_incident_id' })
  majorIncident: ItsmMajorIncident;

  @Column({ type: 'text' })
  message: string;

  @Column({
    name: 'update_type',
    type: 'enum',
    enum: MajorIncidentUpdateType,
    enumName: 'itsm_mi_update_type_enum',
    default: MajorIncidentUpdateType.TECHNICAL_UPDATE,
  })
  updateType: MajorIncidentUpdateType;

  @Column({
    type: 'enum',
    enum: MajorIncidentUpdateVisibility,
    enumName: 'itsm_mi_update_visibility_enum',
    default: MajorIncidentUpdateVisibility.INTERNAL,
  })
  visibility: MajorIncidentUpdateVisibility;

  @Column({ name: 'previous_status', type: 'varchar', length: 50, nullable: true })
  previousStatus: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 50, nullable: true })
  newStatus: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
