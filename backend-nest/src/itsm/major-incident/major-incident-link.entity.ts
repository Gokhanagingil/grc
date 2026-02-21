import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmMajorIncident } from './major-incident.entity';
import { MajorIncidentLinkType } from './major-incident.enums';

/**
 * Major Incident Link Entity
 *
 * Maps the relationship between a major incident and other records
 * (incidents, changes, problems, CMDB services/offerings/CIs).
 */
@Entity('itsm_major_incident_links')
@Unique(['tenantId', 'majorIncidentId', 'linkType', 'linkedRecordId'])
@Index(['tenantId', 'majorIncidentId'])
@Index(['tenantId', 'linkedRecordId'])
export class ItsmMajorIncidentLink extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'major_incident_id', type: 'uuid' })
  majorIncidentId: string;

  @ManyToOne(() => ItsmMajorIncident, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'major_incident_id' })
  majorIncident: ItsmMajorIncident;

  @Column({
    name: 'link_type',
    type: 'enum',
    enum: MajorIncidentLinkType,
    enumName: 'itsm_mi_link_type_enum',
  })
  linkType: MajorIncidentLinkType;

  @Column({ name: 'linked_record_id', type: 'uuid' })
  linkedRecordId: string;

  @Column({ name: 'linked_record_label', type: 'varchar', length: 255, nullable: true })
  linkedRecordLabel: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
