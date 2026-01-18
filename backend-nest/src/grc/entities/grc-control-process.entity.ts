import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcControl } from './grc-control.entity';
import { Process } from './process.entity';

/**
 * GRC Control-Process Mapping Entity
 *
 * Many-to-many relationship between GRC Controls and Processes.
 * A control can be linked to multiple processes.
 * A process can have multiple controls linked to it.
 * Extends MappingEntityBase for standard mapping fields.
 *
 * This enables "process-only controls" - controls that are linked
 * to processes without being linked to compliance requirements.
 */
@Entity('grc_control_processes')
@Index(['tenantId', 'controlId', 'processId'], { unique: true })
export class GrcControlProcess extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'control_id', type: 'uuid' })
  @Index()
  controlId: string;

  @ManyToOne(() => GrcControl, (control) => control.controlProcesses, {
    nullable: false,
  })
  @JoinColumn({ name: 'control_id' })
  control: GrcControl;

  @Column({ name: 'process_id', type: 'uuid' })
  @Index()
  processId: string;

  @ManyToOne(() => Process, (process) => process.controlProcesses, {
    nullable: false,
  })
  @JoinColumn({ name: 'process_id' })
  process: Process;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
