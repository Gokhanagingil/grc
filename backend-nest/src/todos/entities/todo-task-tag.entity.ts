import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { TodoTask } from './todo-task.entity';
import { TodoTag } from './todo-tag.entity';

/**
 * TodoTaskTag Entity
 *
 * Join table linking tasks to tags (many-to-many).
 * Tenant-scoped for isolation.
 */
@Entity('todo_task_tags')
@Index(['tenantId', 'taskId', 'tagId'], { unique: true })
export class TodoTaskTag extends MappingEntityBase {
  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @Column({ name: 'tag_id', type: 'uuid' })
  tagId: string;

  @ManyToOne(() => TodoTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: TodoTask;

  @ManyToOne(() => TodoTag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: TodoTag;
}
