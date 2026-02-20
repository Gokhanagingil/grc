import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ProcessControl } from './process-control.entity';
import { GrcRisk } from './grc-risk.entity';

/**
 * ProcessControlRisk Entity
 *
 * Many-to-many mapping between ProcessControls and GrcRisks.
 * Allows linking process controls to the risks they help mitigate.
 * Extends MappingEntityBase for minimal audit fields.
 */
@Entity('grc_process_control_risks')
@Index(['tenantId', 'controlId', 'riskId'], { unique: true })
@Index(['tenantId', 'controlId'])
@Index(['tenantId', 'riskId'])
export class ProcessControlRisk extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'control_id', type: 'uuid' })
  controlId: string;

  @ManyToOne(() => ProcessControl, (control) => control.controlRisks, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_id' })
  control: ProcessControl;

  @Column({ name: 'risk_id', type: 'uuid' })
  riskId: string;

  @ManyToOne(() => GrcRisk, { nullable: false })
  @JoinColumn({ name: 'risk_id' })
  risk: GrcRisk;
}
