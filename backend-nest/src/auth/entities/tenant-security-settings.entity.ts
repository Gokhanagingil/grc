import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * Tenant Security Settings Entity
 *
 * Stores tenant-level security configuration including:
 * - MFA requirements (for admins, for all users)
 * - Password policy settings
 * - Session timeout configuration
 */
@Entity('tenant_security_settings')
export class TenantSecuritySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index({ unique: true })
  tenantId: string;

  @OneToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'mfa_required_for_admins', default: false })
  mfaRequiredForAdmins: boolean;

  @Column({ name: 'mfa_required_for_all', default: false })
  mfaRequiredForAll: boolean;

  @Column({ name: 'password_min_length', default: 8 })
  passwordMinLength: number;

  @Column({ name: 'password_require_uppercase', default: true })
  passwordRequireUppercase: boolean;

  @Column({ name: 'password_require_lowercase', default: true })
  passwordRequireLowercase: boolean;

  @Column({ name: 'password_require_number', default: true })
  passwordRequireNumber: boolean;

  @Column({ name: 'password_require_special', default: false })
  passwordRequireSpecial: boolean;

  @Column({ name: 'session_timeout_minutes', default: 1440 })
  sessionTimeoutMinutes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
