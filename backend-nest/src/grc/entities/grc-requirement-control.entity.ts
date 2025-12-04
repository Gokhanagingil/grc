import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcRequirement } from './grc-requirement.entity';
import { GrcControl } from './grc-control.entity';
import { CoverageLevel } from '../enums';

/**
 * GRC Requirement-Control Mapping Entity
 *
 * Many-to-many relationship between Compliance Requirements and Controls.
 * A requirement can be satisfied by multiple controls.
 * A control can satisfy multiple requirements.
 */
@Entity('grc_requirement_controls')
@Index(['tenantId', 'requirementId', 'controlId'], { unique: true })
export class GrcRequirementControl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'requirement_id', type: 'uuid' })
  @Index()
  requirementId: string;

  @ManyToOne(() => GrcRequirement, (req) => req.requirementControls, {
    nullable: false,
  })
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

  @Column({ name: 'control_id', type: 'uuid' })
  @Index()
  controlId: string;

  @ManyToOne(() => GrcControl, (control) => control.requirementControls, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @Column({
    name: 'coverage_level',
    type: 'enum',
    enum: CoverageLevel,
    nullable: true,
  })
  coverageLevel: CoverageLevel | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
