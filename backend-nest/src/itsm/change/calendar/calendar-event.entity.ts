import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { ItsmChange } from '../change.entity';

export enum CalendarEventType {
  CHANGE = 'CHANGE',
  MAINTENANCE = 'MAINTENANCE',
  FREEZE = 'FREEZE',
  BLACKOUT = 'BLACKOUT',
  ADVISORY = 'ADVISORY',
}

export enum CalendarEventStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('itsm_change_calendar_event')
@Index(['tenantId', 'startAt'])
@Index(['tenantId', 'type'])
@Index(['tenantId', 'changeId'])
export class CalendarEvent extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'change_id', type: 'uuid', nullable: true })
  changeId: string | null;

  @ManyToOne(() => ItsmChange, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 50, default: CalendarEventType.CHANGE })
  type: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: CalendarEventStatus.SCHEDULED,
  })
  status: string;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;
}
