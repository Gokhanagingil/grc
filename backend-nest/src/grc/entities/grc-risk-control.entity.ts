import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcRisk } from './grc-risk.entity';
import { GrcControl } from './grc-control.entity';
import { RelationshipType, ControlEffectiveness } from '../enums';

/**
 * GRC Risk-Control Mapping Entity
 *
 * Many-to-many relationship between Risks and Controls.
 * A risk can be mitigated by multiple controls.
 * A control can mitigate multiple risks.
 * Extends MappingEntityBase for standard mapping fields.
 */
@Entity('grc_risk_controls')
@Index(['tenantId', 'riskId', 'controlId'], { unique: true })
export class GrcRiskControl extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'risk_id', type: 'uuid' })
  @Index()
  riskId: string;

  @ManyToOne(() => GrcRisk, (risk) => risk.riskControls, { nullable: false })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;

  @Column({ name: 'control_id', type: 'uuid' })
  @Index()
  controlId: string;

  @ManyToOne(() => GrcControl, (control) => control.riskControls, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @Column({
    name: 'relationship_type',
    type: 'enum',
    enum: RelationshipType,
    nullable: true,
  })
  relationshipType: RelationshipType | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  effectiveness: string | null;

  @Column({
    name: 'effectiveness_rating',
    type: 'enum',
    enum: ControlEffectiveness,
    default: ControlEffectiveness.UNKNOWN,
  })
  effectivenessRating: ControlEffectiveness;

  /**
   * Override effectiveness percentage for this specific risk-control link (0-100).
   * When set, this value takes precedence over the control's global effectivenessPercent.
   * When null, the control's global effectivenessPercent is used.
   */
  @Column({
    name: 'override_effectiveness_percent',
    type: 'int',
    nullable: true,
  })
  overrideEffectivenessPercent: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
