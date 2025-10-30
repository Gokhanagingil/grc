import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'tenant', name: 'tenants' })
export class TenantEntity {
  @PrimaryColumn('uuid') id!: string;

  @Column({ type: 'text', unique: true }) name!: string;

  @Column({ type: 'text', unique: true }) slug!: string;

  @Column({ type: 'boolean', default: true }) is_active!: boolean;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}


