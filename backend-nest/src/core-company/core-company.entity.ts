import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities';
import { Tenant } from '../tenants/tenant.entity';
import { CompanyType, CompanyStatus } from './core-company.enum';

/**
 * Core Company Entity
 *
 * Shared dimension representing a company (customer, vendor, or internal).
 * Used across modules: ITSM, GRC, SLA, Contracts.
 * Extends BaseEntity for standard audit fields, soft delete, and multi-tenancy.
 */
@Entity('core_companies')
@Index(['tenantId', 'name'])
@Index(['tenantId', 'code'], { unique: true, where: '"code" IS NOT NULL' })
export class CoreCompany extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: CompanyType,
    default: CompanyType.CUSTOMER,
  })
  type: CompanyType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
  })
  status: CompanyStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
