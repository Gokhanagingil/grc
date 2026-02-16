import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';

@Entity('copilot_incident_index')
@Index(['tenantId', 'sysId'], { unique: true })
@Index(['tenantId', 'state'])
@Index(['tenantId', 'resolvedAt'])
export class CopilotIncidentIndex extends BaseEntity {
  @Column({ name: 'sys_id', type: 'varchar', length: 64 })
  sysId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  number: string | null;

  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  priority: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  category: string | null;

  @Column({
    name: 'assignment_group',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  assignmentGroup: string | null;

  @Column({ name: 'close_code', type: 'varchar', length: 100, nullable: true })
  closeCode: string | null;

  @Column({ name: 'close_notes', type: 'text', nullable: true })
  closeNotes: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'sn_created_at', type: 'timestamp', nullable: true })
  snCreatedAt: Date | null;

  @Column({ name: 'sn_updated_at', type: 'timestamp', nullable: true })
  snUpdatedAt: Date | null;

  @Column({ name: 'search_text', type: 'text', nullable: true })
  searchText: string | null;
}
