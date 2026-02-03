import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { ItsmServiceCriticality, ItsmServiceStatus } from '../enums';

/**
 * ITSM Service Entity
 *
 * Represents an IT service in the ITSM module.
 * Services can be linked to incidents and changes for impact analysis.
 * Criticality level is used for risk signal calculations.
 */
@Entity('itsm_services')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'criticality'])
@Index(['tenantId', 'name'], { unique: true })
export class ItsmService extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ItsmServiceCriticality,
    default: ItsmServiceCriticality.MEDIUM,
  })
  criticality: ItsmServiceCriticality;

  @Column({
    type: 'enum',
    enum: ItsmServiceStatus,
    default: ItsmServiceStatus.ACTIVE,
  })
  status: ItsmServiceStatus;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // Relationships will be added when ItsmIncident and ItsmChange are created
  // @OneToMany(() => ItsmIncident, (incident) => incident.service)
  // incidents: ItsmIncident[];

  // @OneToMany(() => ItsmChange, (change) => change.service)
  // changes: ItsmChange[];
}
