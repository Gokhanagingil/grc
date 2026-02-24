import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { MappingEntityBase } from '../../../common/entities';
import { ItsmChangeTask } from './change-task.entity';

@Entity('itsm_change_task_dependencies')
@Unique(['tenantId', 'predecessorTaskId', 'successorTaskId'])
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'successorTaskId'])
@Index(['tenantId', 'predecessorTaskId'])
export class ItsmChangeTaskDependency extends MappingEntityBase {
  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @Column({ name: 'predecessor_task_id', type: 'uuid' })
  predecessorTaskId: string;

  @ManyToOne(() => ItsmChangeTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'predecessor_task_id' })
  predecessorTask: ItsmChangeTask;

  @Column({ name: 'successor_task_id', type: 'uuid' })
  successorTaskId: string;

  @ManyToOne(() => ItsmChangeTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'successor_task_id' })
  successorTask: ItsmChangeTask;
}
