import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from '../../entities/tenant/tenant.entity';

@Entity({ schema: 'auth', name: 'roles' })
@Index('idx_roles_tenant_entity', ['tenant_id'])
export class RoleEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @ManyToOne(() => TenantEntity) tenant?: TenantEntity;

  @Column({ type: 'text' }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'boolean', default: false }) is_system!: boolean;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}


