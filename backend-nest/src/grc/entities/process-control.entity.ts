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
import {
  ProcessControlMethod,
  ProcessControlFrequency,
  ControlResultType,
} from '../enums';
import { Process } from './process.entity';
import { ControlResult } from './control-result.entity';
import { ProcessControlRisk } from './process-control-risk.entity';

/**
 * ProcessControl Entity
 *
 * Represents a control point attached to a Process.
 * Controls can be manual or automated, and have expected result types.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_process_controls')
@Index(['tenantId', 'processId'])
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'frequency'])
export class ProcessControl extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'process_id', type: 'uuid' })
  processId: string;

  @ManyToOne(() => Process, (process) => process.controls, { nullable: false })
  @JoinColumn({ name: 'process_id' })
  process: Process;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_automated', type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({
    type: 'enum',
    enum: ProcessControlMethod,
    nullable: true,
  })
  method: ProcessControlMethod | null;

  @Column({
    type: 'enum',
    enum: ProcessControlFrequency,
    nullable: true,
  })
  frequency: ProcessControlFrequency | null;

  @Column({
    name: 'expected_result_type',
    type: 'enum',
    enum: ControlResultType,
    default: ControlResultType.BOOLEAN,
  })
  expectedResultType: ControlResultType;

  @Column({ type: 'jsonb', nullable: true })
  parameters: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @OneToMany(() => ControlResult, (result) => result.control)
  results: ControlResult[];

  @OneToMany(() => ProcessControlRisk, (pcr) => pcr.control)
  controlRisks: ProcessControlRisk[];
}
