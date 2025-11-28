import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { enumColumnOptions, timestampColumnType } from '../../common/database/column-types';

export enum CalendarEventType {
  AUDIT_ENGAGEMENT = 'AUDIT_ENGAGEMENT',
  BCP_EXERCISE = 'BCP_EXERCISE',
  BCP_PLAN_REVIEW = 'BCP_PLAN_REVIEW',
  RISK_REVIEW = 'RISK_REVIEW',
  CONTROL_TEST = 'CONTROL_TEST',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

export enum CalendarEventStatus {
  PLANNED = 'PLANNED',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'calendar_events' })
@Index('idx_calendar_events_tenant', ['tenant_id'])
@Index('idx_calendar_events_type', ['event_type'])
@Index('idx_calendar_events_status', ['status'])
@Index('idx_calendar_events_start_at', ['start_at'])
@Index('idx_calendar_events_source', ['source_module', 'source_entity', 'source_id'])
@Index('idx_calendar_events_owner', ['owner_user_id'])
export class CalendarEventEntity {
  @PrimaryColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  @Column({ type: 'text' }) title!: string;

  @Column({ type: 'text', nullable: true }) description?: string;

  @Column({
    ...enumColumnOptions(CalendarEventType, CalendarEventType.OTHER),
  })
  event_type!: CalendarEventType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source_module?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_entity?: string;

  @Column('uuid', { nullable: true })
  source_id?: string;

  @Column({ type: timestampColumnType })
  start_at!: Date;

  @Column({ type: timestampColumnType, nullable: true })
  end_at?: Date;

  @Column({
    ...enumColumnOptions(CalendarEventStatus, CalendarEventStatus.PLANNED),
  })
  status!: CalendarEventStatus;

  @Column({ type: 'text', nullable: true })
  location?: string;

  @Column('uuid', { nullable: true })
  owner_user_id?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color_hint?: string;

  @Column('uuid', { nullable: true })
  created_by?: string;

  @Column('uuid', { nullable: true })
  updated_by?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

