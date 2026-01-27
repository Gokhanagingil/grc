import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { GrcSoaItem } from './grc-soa-item.entity';
import { GrcControl } from './grc-control.entity';

/**
 * GRC SOA Item Control Entity
 *
 * Many-to-many mapping between SOA Items and Controls.
 * Links controls to specific SOA items to show which controls
 * address each clause in the Statement of Applicability.
 *
 * Extends MappingEntityBase for minimal audit fields (id, tenantId, createdAt).
 */
@Entity('grc_soa_item_controls')
@Index(['tenantId', 'soaItemId', 'controlId'], { unique: true })
@Index(['tenantId', 'soaItemId'])
@Index(['tenantId', 'controlId'])
export class GrcSoaItemControl extends MappingEntityBase {
  @Column({ name: 'soa_item_id', type: 'uuid' })
  soaItemId: string;

  @ManyToOne(() => GrcSoaItem, (item) => item.soaItemControls, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'soa_item_id' })
  soaItem: GrcSoaItem;

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => GrcControl, { nullable: false })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;
}
