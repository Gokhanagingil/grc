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
 * Tenant LDAP Configuration Entity
 *
 * Stores per-tenant LDAP/Active Directory configuration including:
 * - Connection settings (host, port, SSL)
 * - Bind credentials
 * - User/group search configuration
 * - Attribute mappings
 */
@Entity('tenant_ldap_config')
export class TenantLdapConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index({ unique: true })
  tenantId: string;

  @OneToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  host: string | null;

  @Column({ default: 389 })
  port: number;

  @Column({ name: 'use_ssl', default: false })
  useSsl: boolean;

  @Column({ name: 'bind_dn', type: 'varchar', length: 512, nullable: true })
  bindDn: string | null;

  @Column({ name: 'bind_password', type: 'varchar', length: 512, nullable: true })
  bindPassword: string | null;

  @Column({ name: 'base_dn', type: 'varchar', length: 512, nullable: true })
  baseDn: string | null;

  @Column({ name: 'user_search_filter', type: 'varchar', length: 512, default: '(uid={{username}})' })
  userSearchFilter: string;

  @Column({ name: 'username_attribute', type: 'varchar', length: 64, default: 'uid' })
  usernameAttribute: string;

  @Column({ name: 'email_attribute', type: 'varchar', length: 64, default: 'mail' })
  emailAttribute: string;

  @Column({ name: 'first_name_attribute', type: 'varchar', length: 64, default: 'givenName' })
  firstNameAttribute: string;

  @Column({ name: 'last_name_attribute', type: 'varchar', length: 64, default: 'sn' })
  lastNameAttribute: string;

  @Column({ name: 'group_search_base', type: 'varchar', length: 512, nullable: true })
  groupSearchBase: string | null;

  @Column({ name: 'group_search_filter', type: 'varchar', length: 512, default: '(member={{userDn}})' })
  groupSearchFilter: string;

  @Column({ name: 'default_role', type: 'varchar', length: 32, default: 'user' })
  defaultRole: string;

  @Column({ name: 'allow_local_fallback', default: true })
  allowLocalFallback: boolean;

  @Column({ name: 'connection_timeout_ms', default: 5000 })
  connectionTimeoutMs: number;

  @Column({ name: 'last_connection_test', type: 'timestamp', nullable: true })
  lastConnectionTest: Date | null;

  @Column({ name: 'last_connection_status', type: 'varchar', length: 32, nullable: true })
  lastConnectionStatus: string | null;

  @Column({ name: 'last_connection_error', type: 'text', nullable: true })
  lastConnectionError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
