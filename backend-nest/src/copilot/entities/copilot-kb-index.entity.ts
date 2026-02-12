import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';

@Entity('copilot_kb_index')
@Index(['tenantId', 'sysId'], { unique: true })
export class CopilotKbIndex extends BaseEntity {
  @Column({ name: 'sys_id', type: 'varchar', length: 64 })
  sysId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  number: string | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({
    name: 'workflow_state',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  workflowState: string | null;

  @Column({ name: 'sn_created_at', type: 'timestamp', nullable: true })
  snCreatedAt: Date | null;

  @Column({ name: 'sn_updated_at', type: 'timestamp', nullable: true })
  snUpdatedAt: Date | null;

  @Column({ name: 'search_text', type: 'text', nullable: true })
  searchText: string | null;
}
