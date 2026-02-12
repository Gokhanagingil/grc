import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';

export enum LearningEventType {
  SUGGESTION_SHOWN = 'SUGGESTION_SHOWN',
  SUGGESTION_APPLIED = 'SUGGESTION_APPLIED',
  SUGGESTION_REJECTED = 'SUGGESTION_REJECTED',
}

@Entity('copilot_learning_events')
@Index(['tenantId', 'incidentSysId'])
@Index(['tenantId', 'eventType'])
@Index(['tenantId', 'createdAt'])
export class CopilotLearningEvent extends BaseEntity {
  @Column({ name: 'incident_sys_id', type: 'varchar', length: 64 })
  incidentSysId: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: LearningEventType,
  })
  eventType: LearningEventType;

  @Column({ name: 'action_type', type: 'varchar', length: 100 })
  actionType: string;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ name: 'evidence_ids', type: 'jsonb', nullable: true })
  evidenceIds: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;
}
