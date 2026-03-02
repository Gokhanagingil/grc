import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { TodoBoard } from './todo-board.entity';

/**
 * TodoTask Entity
 *
 * Represents a task/work item in the To-Do system.
 * Each task belongs to a board and has a status that maps to a board column key.
 */
@Entity('todo_tasks')
@Index(['tenantId', 'boardId', 'status'])
@Index(['tenantId', 'assigneeUserId'])
@Index(['tenantId', 'dueDate'])
@Index(['tenantId', 'priority'])
@Index(['tenantId', 'boardId', 'status', 'sortOrder'])
export class TodoTask extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, default: 'todo' })
  status: string; // maps to board column key

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string; // low | medium | high | urgent

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'assignee_user_id', type: 'uuid', nullable: true })
  assigneeUserId: string | null;

  @Column({ name: 'owner_group_id', type: 'uuid', nullable: true })
  ownerGroupId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ name: 'sort_order', type: 'float', default: 0 })
  sortOrder: number;

  @Column({ name: 'board_id', type: 'uuid', nullable: true })
  boardId: string | null;

  @ManyToOne(() => TodoBoard, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'board_id' })
  board: TodoBoard | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
