import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmProblem } from './problem.entity';
import { ItsmIncident } from '../incident/incident.entity';
import { ProblemIncidentLinkType } from '../enums';

/**
 * Problem-Incident Link Entity
 *
 * Maps the many-to-many relationship between problems and incidents.
 * Includes a link type for categorizing the relationship.
 */
@Entity('itsm_problem_incident')
@Unique(['tenantId', 'problemId', 'incidentId'])
@Index(['tenantId', 'problemId'])
@Index(['tenantId', 'incidentId'])
@Index(['tenantId', 'createdAt'])
export class ItsmProblemIncident extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'problem_id', type: 'uuid' })
  problemId: string;

  @ManyToOne(() => ItsmProblem, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: ItsmProblem;

  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @ManyToOne(() => ItsmIncident, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: ItsmIncident;

  @Column({
    name: 'link_type',
    type: 'enum',
    enum: ProblemIncidentLinkType,
    enumName: 'itsm_problem_incident_link_type_enum',
    default: ProblemIncidentLinkType.RELATED,
  })
  linkType: ProblemIncidentLinkType;
}
