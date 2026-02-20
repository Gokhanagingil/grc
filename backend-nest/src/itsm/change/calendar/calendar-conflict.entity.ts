import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { ItsmChange } from '../change.entity';
import { CalendarEvent } from './calendar-event.entity';
import { FreezeWindow } from './freeze-window.entity';

export enum ConflictType {
  OVERLAP = 'OVERLAP',
  FREEZE_WINDOW = 'FREEZE_WINDOW',
  ADJACENCY = 'ADJACENCY',
}

export enum ConflictSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('itsm_calendar_conflict')
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'conflictType'])
export class CalendarConflict extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @ManyToOne(() => ItsmChange, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange;

  @Column({ name: 'conflict_type', type: 'varchar', length: 50 })
  conflictType: string;

  @Column({ name: 'conflicting_event_id', type: 'uuid', nullable: true })
  conflictingEventId: string | null;

  @ManyToOne(() => CalendarEvent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conflicting_event_id' })
  conflictingEvent: CalendarEvent | null;

  @Column({ name: 'conflicting_freeze_id', type: 'uuid', nullable: true })
  conflictingFreezeId: string | null;

  @ManyToOne(() => FreezeWindow, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'conflicting_freeze_id' })
  conflictingFreeze: FreezeWindow | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ConflictSeverity.MEDIUM,
  })
  severity: string;

  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  details: Record<string, unknown>;
}
