import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GrcRequirement } from '../grc-requirement.entity';
import { RequirementStatus, RequirementType } from '../../enums';

/**
 * GRC Requirement History Entity
 *
 * Stores historical snapshots of requirement records for compliance and audit purposes.
 * Each record represents the state of a requirement at a specific point in time.
 */
@Entity('grc_requirement_history')
@Index(['requirementId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class GrcRequirementHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requirement_id', type: 'uuid' })
  @Index()
  requirementId: string;

  @ManyToOne(() => GrcRequirement, { nullable: false })
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: RequirementType,
    nullable: true,
  })
  type: RequirementType | null;

  @Column({
    type: 'enum',
    enum: RequirementStatus,
  })
  status: RequirementStatus;

  @Column({ name: 'framework_id', type: 'uuid', nullable: true })
  frameworkId: string | null;

  @Column({
    name: 'control_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  controlReference: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'assigned_to_user_id', type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
