import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { GrcControl } from './grc-control.entity';
import { GrcEvidence } from './grc-evidence.entity';
import { ControlEvidenceType } from '../enums';

/**
 * GRC Control Evidence Entity (Join Table)
 *
 * Links Evidence artifacts to Controls with additional context.
 * Supports different evidence types: baseline, test, periodic.
 * Part of the Golden Flow: Control -> Evidence relationship.
 * Extends MappingEntityBase for lightweight join table fields.
 */
@Entity('grc_control_evidence')
@Index(['tenantId', 'controlId', 'evidenceId'], { unique: true })
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'evidenceId'])
export class GrcControlEvidence extends MappingEntityBase {
  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => GrcControl, { nullable: false })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @Column({ name: 'evidence_id', type: 'uuid' })
  evidenceId: string;

  @ManyToOne(() => GrcEvidence, { nullable: false })
  @JoinColumn({ name: 'evidence_id' })
  evidence: GrcEvidence;

  @Column({
    name: 'evidence_type',
    type: 'enum',
    enum: ControlEvidenceType,
    nullable: true,
  })
  evidenceType: ControlEvidenceType | null;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
