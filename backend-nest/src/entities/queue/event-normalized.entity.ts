import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  isPostgres,
  jsonColumnType,
  timestampColumnType,
} from '../../common/database/column-types';

export type EventSeverity = 'info' | 'warning' | 'minor' | 'major' | 'critical';

@Entity({ name: 'event_normalized' })
@Index('idx_event_normalized_tenant_time', ['tenant_id', 'event_time'])
@Index('idx_event_normalized_severity', ['severity'])
@Index('idx_event_normalized_category', ['category'])
export class EventNormalizedEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  @Column(timestampColumnType) event_time!: Date;

  @Column(
    isPostgres
      ? {
          type: 'enum',
          enum: ['info', 'warning', 'minor', 'major', 'critical'],
          default: 'info',
        }
      : {
          type: 'text',
          default: 'info',
        },
  )
  severity!: EventSeverity;

  @Column({ type: 'varchar', length: 100 }) category!: string;

  @Column({ type: 'varchar', length: 255 }) resource!: string;

  @Column({ type: 'text' }) message!: string;

  @Column({ type: jsonColumnType, nullable: true })
  labels?: Record<string, any>;

  @Column('uuid') raw_id!: string;

  @CreateDateColumn() created_at!: Date;
}
