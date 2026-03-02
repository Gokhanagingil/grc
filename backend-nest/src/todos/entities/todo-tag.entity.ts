import {
  Entity,
  Column,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';

/**
 * TodoTag Entity
 *
 * Represents a reusable tag that can be applied to tasks.
 * Tags are tenant-scoped and have an optional color.
 */
@Entity('todo_tags')
@Index(['tenantId', 'name'], { unique: true, where: '"is_deleted" = false' })
export class TodoTag extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null; // hex color e.g. #FF5733
}
