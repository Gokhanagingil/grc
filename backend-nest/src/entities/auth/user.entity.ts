import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from '../../entities/tenant/tenant.entity';

@Entity({ schema: 'auth', name: 'users' })
@Index('idx_users_tenant_entity', ['tenant_id'])
export class UserEntity {
  @PrimaryColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  @ManyToOne(() => TenantEntity)
  tenant?: TenantEntity;

  @Column({ type: 'citext' }) email!: string;

  @Column({ type: 'text' }) password_hash!: string;

  @Column({ type: 'text', nullable: true }) display_name?: string;

  @Column({ type: 'boolean', default: false }) is_email_verified!: boolean;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @Column({ type: 'text', nullable: true }) twofa_secret?: string;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}


