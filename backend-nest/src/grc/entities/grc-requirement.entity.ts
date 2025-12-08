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
import { ComplianceFramework } from '../enums';
import { GrcRequirementControl } from './grc-requirement-control.entity';
import { GrcRiskRequirement } from './grc-risk-requirement.entity';

/**
 * GRC Compliance Requirement Entity
 *
 * Represents a regulatory or compliance requirement from a framework
 * (e.g., ISO 27001, SOC 2, GDPR, HIPAA).
 * Requirements can be linked to controls via GrcRequirementControl mapping.
 * Extends BaseEntity for standard audit fields.
 */
@Entity('grc_requirements')
@Index(['tenantId', 'framework'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'framework', 'referenceCode'], { unique: true })
@Index(['tenantId', 'status', 'createdAt'])
export class GrcRequirement extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: ComplianceFramework,
  })
  framework: ComplianceFramework;

  @Column({ name: 'reference_code', type: 'varchar', length: 50 })
  referenceCode: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  priority: string | null;

  @Column({ type: 'varchar', length: 50, default: 'not_started' })
  status: string;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcRequirementControl, (rc) => rc.requirement)
  requirementControls: GrcRequirementControl[];

  @OneToMany(() => GrcRiskRequirement, (rr) => rr.requirement)
  riskRequirements: GrcRiskRequirement[];
}
