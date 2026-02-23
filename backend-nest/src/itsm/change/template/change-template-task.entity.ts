import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { ItsmChangeTemplate } from './change-template.entity';
import { ChangeTaskType, ChangeTaskStatus, ChangeTaskPriority } from '../task/change-task.entity';

@Entity('itsm_change_template_tasks')
@Index(['tenantId', 'templateId'])
@Index(['tenantId', 'templateId', 'taskKey'], { unique: true })
export class ItsmChangeTemplateTask extends BaseEntity {
  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @ManyToOne(() => ItsmChangeTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ItsmChangeTemplate;

  @Column({ name: 'task_key', type: 'varchar', length: 100 })
  taskKey: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'task_type',
    type: 'varchar',
    length: 30,
    default: ChangeTaskType.OTHER,
  })
  taskType: ChangeTaskType;

  @Column({ name: 'default_assignment_group_id', type: 'uuid', nullable: true })
  defaultAssignmentGroupId: string | null;

  @Column({ name: 'default_assignee_id', type: 'uuid', nullable: true })
  defaultAssigneeId: string | null;

  @Column({
    name: 'default_status',
    type: 'varchar',
    length: 30,
    default: ChangeTaskStatus.OPEN,
  })
  defaultStatus: ChangeTaskStatus;

  @Column({
    name: 'default_priority',
    type: 'varchar',
    length: 20,
    default: ChangeTaskPriority.MEDIUM,
  })
  defaultPriority: ChangeTaskPriority;

  @Column({ name: 'estimated_duration_minutes', type: 'int', nullable: true })
  estimatedDurationMinutes: number | null;

  @Column({ name: 'sequence_order', type: 'int', nullable: true })
  sequenceOrder: number | null;

  @Column({ name: 'is_blocking', type: 'boolean', default: true })
  isBlocking: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'stage_label', type: 'varchar', length: 100, nullable: true })
  stageLabel: string | null;
}
