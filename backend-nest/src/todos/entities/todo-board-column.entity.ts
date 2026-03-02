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
 * TodoBoardColumn Entity
 *
 * Represents a column (status lane) on a Kanban board.
 * Each column has a key that maps to task status values.
 */
@Entity('todo_board_columns')
@Index(['tenantId', 'boardId', 'orderIndex'])
export class TodoBoardColumn extends BaseEntity {
  @Column({ name: 'board_id', type: 'uuid' })
  boardId: string;

  @ManyToOne(() => TodoBoard, (board) => board.columns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board: TodoBoard;

  @Column({ type: 'varchar', length: 50 })
  key: string; // e.g. "todo", "doing", "done"

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({ name: 'wip_limit', type: 'int', nullable: true })
  wipLimit: number | null;

  @Column({ name: 'is_done_column', type: 'boolean', default: false })
  isDoneColumn: boolean;
}
