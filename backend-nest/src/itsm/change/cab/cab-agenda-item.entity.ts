import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { User } from '../../../users/user.entity';
import { CabMeeting } from './cab-meeting.entity';
import { ItsmChange } from '../change.entity';

export enum CabDecisionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DEFERRED = 'DEFERRED',
  CONDITIONAL = 'CONDITIONAL',
}

@Entity('itsm_cab_agenda_item')
@Unique('UQ_cab_agenda_meeting_change', ['cabMeetingId', 'changeId'])
@Index(['tenantId', 'cabMeetingId'])
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'decisionStatus'])
export class CabAgendaItem extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'cab_meeting_id', type: 'uuid' })
  cabMeetingId: string;

  @ManyToOne(() => CabMeeting, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cab_meeting_id' })
  cabMeeting: CabMeeting;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @ManyToOne(() => ItsmChange, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({
    name: 'decision_status',
    type: 'varchar',
    length: 50,
    default: CabDecisionStatus.PENDING,
  })
  decisionStatus: string;

  @Column({ name: 'decision_at', type: 'timestamptz', nullable: true })
  decisionAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ type: 'text', nullable: true })
  conditions: string | null;

  @Column({ name: 'decision_by_id', type: 'uuid', nullable: true })
  decisionById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'decision_by_id' })
  decisionBy: User | null;
}
