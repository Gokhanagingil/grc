import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { ProcessControl } from './process-control.entity';
import { GrcControlProcess } from './grc-control-process.entity';

/**
 * Process Entity
 *
 * Represents a business or IT process in the organization.
 * Processes contain control points (ProcessControls) that are executed
 * to ensure compliance.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_processes')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'code'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'isActive'])
export class Process extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => ProcessControl, (control) => control.process)
  controls: ProcessControl[];

  // GRC Control-Process links (for unified control library)
  @OneToMany(() => GrcControlProcess, (cp) => cp.process)
  controlProcesses: GrcControlProcess[];
}
