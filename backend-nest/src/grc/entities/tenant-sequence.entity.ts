import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * TenantSequence Entity
 *
 * Stores sequence counters for generating unique codes per tenant.
 * Each tenant has separate sequences for different entity types.
 *
 * Example sequences:
 * - RISK: RISK-000001, RISK-000002, ...
 * - FND: FND-000001, FND-000002, ...
 * - AUD: AUD-000001, AUD-000002, ...
 */
@Entity('tenant_sequences')
@Index(['tenantId', 'sequenceKey'], { unique: true })
export class TenantSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'sequence_key', type: 'varchar', length: 50 })
  sequenceKey: string;

  @Column({ name: 'next_value', type: 'bigint', default: 1 })
  nextValue: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
