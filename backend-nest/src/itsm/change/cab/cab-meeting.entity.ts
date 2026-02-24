import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities';
import { Tenant } from '../../../tenants/tenant.entity';
import { User } from '../../../users/user.entity';

export enum CabMeetingStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('itsm_cab_meeting')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'meetingAt'])
@Index(['tenantId', 'code'], { unique: true })
export class CabMeeting extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'meeting_at', type: 'timestamptz' })
  meetingAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: CabMeetingStatus.DRAFT,
  })
  status: string;

  @Column({ name: 'chairperson_id', type: 'uuid', nullable: true })
  chairpersonId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'chairperson_id' })
  chairperson: User | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;
}
