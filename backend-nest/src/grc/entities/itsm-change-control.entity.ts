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
import { ItsmChange } from './itsm-change.entity';
import { GrcControl } from './grc-control.entity';

/**
 * ITSM Change Control Link Entity
 *
 * Join table linking ITSM changes to GRC controls.
 * Part of the GRC Bridge v1 implementation.
 */
@Entity('itsm_change_controls')
@Index(['tenantId', 'changeId', 'controlId'], { unique: true })
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'controlId'])
export class ItsmChangeControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @ManyToOne(() => ItsmChange, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange;

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
