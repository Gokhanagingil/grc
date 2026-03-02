import {
  Entity,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { TodoBoardColumn } from './todo-board-column.entity';

/**
 * TodoBoard Entity
 *
 * Represents a Kanban-style task board.
 * Each board belongs to a tenant and has configurable columns.
 */
@Entity('todo_boards')
@Index(['tenantId', 'name'])
export class TodoBoard extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'TEAM',
  })
  visibility: string; // PRIVATE | TEAM | TENANT

  @OneToMany(() => TodoBoardColumn, (col) => col.board, { cascade: true })
  columns: TodoBoardColumn[];
}
