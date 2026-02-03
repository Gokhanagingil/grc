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
import { GrcRisk } from './grc-risk.entity';

/**
 * ITSM Change Risk Link Entity
 *
 * Join table linking ITSM changes to GRC risks.
 * Part of the GRC Bridge v1 implementation.
 */
@Entity('itsm_change_risks')
@Index(['tenantId', 'changeId', 'riskId'], { unique: true })
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'riskId'])
export class ItsmChangeRisk {
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
