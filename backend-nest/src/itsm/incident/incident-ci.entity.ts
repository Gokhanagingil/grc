import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmIncident } from './incident.entity';
import { CmdbCi } from '../cmdb/ci/ci.entity';

@Entity('itsm_incident_ci')
@Unique(['tenantId', 'incidentId', 'ciId', 'relationshipType'])
@Index(['tenantId', 'incidentId'])
@Index(['tenantId', 'ciId'])
@Index(['tenantId', 'createdAt'])
export class ItsmIncidentCi extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @ManyToOne(() => ItsmIncident, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: ItsmIncident;

  @Column({ name: 'ci_id', type: 'uuid' })
  ciId: string;

  @ManyToOne(() => CmdbCi, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ci_id' })
  ci: CmdbCi;

  @Column({ name: 'relationship_type', type: 'varchar', length: 50 })
  relationshipType: string;

  @Column({ name: 'impact_scope', type: 'varchar', length: 50, nullable: true })
  impactScope: string | null;
}
