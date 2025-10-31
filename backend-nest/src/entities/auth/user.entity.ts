import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { TenantEntity } from '../../entities/tenant/tenant.entity';

@Entity({ schema: 'auth', name: 'users' })
@Index('idx_users_tenant_entity', ['tenant_id'])
@Index('idx_users_locked_until', ['locked_until'])
export class UserEntity {
  @PrimaryColumn('uuid') id!: string;

  @Column('uuid') tenant_id!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ type: 'citext' }) email!: string;

  @Column({ type: 'text' }) password_hash!: string;

  @Column({ type: 'text', nullable: true }) display_name?: string;

  @Column({ type: 'boolean', default: false }) is_email_verified!: boolean;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  
  // MFA fields
  @Column({ type: 'boolean', default: false }) mfa_enabled!: boolean;
  @Column({ type: 'text', nullable: true }) mfa_secret?: string;
  @Column({ type: 'integer', default: 0 }) failed_attempts!: number;
  @Column({ type: 'timestamptz', nullable: true }) locked_until?: Date;
  
  // Legacy field (deprecated, use mfa_secret)
  @Column({ type: 'text', nullable: true }) twofa_secret?: string;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}


