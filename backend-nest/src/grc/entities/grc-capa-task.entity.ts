import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcCapa } from './grc-capa.entity';
import { CAPATaskStatus } from '../enums';

/**
 * GRC CAPA Task Entity
 *
 * Represents an individual task within a CAPA action plan.
 * CAPAs can have multiple tasks that need to be completed.
 * Part of the Golden Flow: Finding -> CAPA -> CAPATask -> Verification
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_capa_tasks')
@Index(['tenantId', 'capaId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'assigneeUserId'])
@Index(['tenantId', 'dueDate'])
@Index(['tenantId', 'status', 'createdAt'])
export class GrcCapaTask extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'capa_id', type: 'uuid' })
  capaId: string;

  @ManyToOne(() => GrcCapa, (capa) => capa.tasks, { nullable: false })
  @JoinColumn({ name: 'capa_id' })
  capa: GrcCapa;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: CAPATaskStatus,
    default: CAPATaskStatus.PENDING,
  })
  status: CAPATaskStatus;

  @Column({ name: 'assignee_user_id', type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignee_user_id' })
  assignee: User | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'completed_by_user_id', type: 'uuid', nullable: true })
  completedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by_user_id' })
  completedBy: User | null;

  @Column({ name: 'sequence_order', type: 'int', default: 0 })
  sequenceOrder: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
