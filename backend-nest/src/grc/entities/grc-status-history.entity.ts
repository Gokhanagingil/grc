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
import { User } from '../../users/user.entity';

/**
 * GRC Status History Entity
 *
 * Tracks all status transitions for auditable entities.
 * Provides a complete audit trail of workflow state changes.
 * Part of the Golden Flow: tracks Issue, CAPA, ControlTest, CAPATask transitions.
 */
@Entity('grc_status_history')
@Index(['tenantId', 'entityType', 'entityId'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'entityType', 'createdAt'])
export class GrcStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    name: 'entity_type',
    type: 'varchar',
    length: 50,
  })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({
    name: 'previous_status',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  previousStatus: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 50 })
  newStatus: string;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedBy: User | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
