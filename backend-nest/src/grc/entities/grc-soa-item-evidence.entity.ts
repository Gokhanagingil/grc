import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { GrcSoaItem } from './grc-soa-item.entity';
import { GrcEvidence } from './grc-evidence.entity';

/**
 * GRC SOA Item Evidence Entity
 *
 * Many-to-many mapping between SOA Items and Evidence.
 * Links evidence to specific SOA items to document proof of
 * implementation for each clause in the Statement of Applicability.
 *
 * Extends MappingEntityBase for minimal audit fields (id, tenantId, createdAt).
 */
@Entity('grc_soa_item_evidence')
@Index(['tenantId', 'soaItemId', 'evidenceId'], { unique: true })
@Index(['tenantId', 'soaItemId'])
@Index(['tenantId', 'evidenceId'])
export class GrcSoaItemEvidence extends MappingEntityBase {
  @Column({ name: 'soa_item_id', type: 'uuid' })
  soaItemId: string;

  @ManyToOne(() => GrcSoaItem, (item) => item.soaItemEvidence, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'soa_item_id' })
  soaItem: GrcSoaItem;

  @Column({ name: 'evidence_id', type: 'uuid' })
  evidenceId: string;

  @ManyToOne(() => GrcEvidence, { nullable: false })
  @JoinColumn({ name: 'evidence_id' })
  evidence: GrcEvidence;
}
