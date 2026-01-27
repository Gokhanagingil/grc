import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { GrcSoaProfile } from './grc-soa-profile.entity';
import { StandardClause } from './standard-clause.entity';
import { GrcSoaItemControl } from './grc-soa-item-control.entity';
import { GrcSoaItemEvidence } from './grc-soa-item-evidence.entity';
import { SoaApplicability, SoaImplementationStatus } from '../enums';

/**
 * GRC SOA Item Entity
 *
 * Represents a single item in a Statement of Applicability (SOA).
 * Each item corresponds to a clause from the standard and tracks:
 * - Whether the clause is applicable to the organization
 * - Justification for applicability decision
 * - Implementation status
 * - Target date for implementation
 * - Owner responsible for the clause
 *
 * Items can be linked to controls and evidence for traceability.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_soa_items')
@Index(['tenantId', 'profileId', 'clauseId'], { unique: true })
@Index(['tenantId', 'profileId'])
@Index(['tenantId', 'applicability'])
@Index(['tenantId', 'implementationStatus'])
export class GrcSoaItem extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'profile_id', type: 'uuid' })
  @Index()
  profileId: string;

  @ManyToOne(() => GrcSoaProfile, (profile) => profile.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id' })
  profile: GrcSoaProfile;

  @Column({ name: 'clause_id', type: 'uuid' })
  @Index()
  clauseId: string;

  @ManyToOne(() => StandardClause, { nullable: false })
  @JoinColumn({ name: 'clause_id' })
  clause: StandardClause;

  @Column({
    type: 'enum',
    enum: SoaApplicability,
    default: SoaApplicability.UNDECIDED,
  })
  applicability: SoaApplicability;

  @Column({ type: 'text', nullable: true })
  justification: string | null;

  @Column({
    name: 'implementation_status',
    type: 'enum',
    enum: SoaImplementationStatus,
    default: SoaImplementationStatus.NOT_IMPLEMENTED,
  })
  implementationStatus: SoaImplementationStatus;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: Date | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => GrcSoaItemControl, (sic) => sic.soaItem)
  soaItemControls: GrcSoaItemControl[];

  @OneToMany(() => GrcSoaItemEvidence, (sie) => sie.soaItem)
  soaItemEvidence: GrcSoaItemEvidence[];
}
