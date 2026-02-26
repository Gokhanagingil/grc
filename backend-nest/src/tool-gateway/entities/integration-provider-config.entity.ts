import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * Integration Auth Type Enum
 */
export enum IntegrationAuthType {
  BASIC = 'BASIC',
  API_TOKEN = 'API_TOKEN',
}

/**
 * Integration Provider Key Enum
 */
export enum IntegrationProviderKey {
  SERVICENOW = 'SERVICENOW',
}

/**
 * Integration Provider Config Entity
 *
 * Stores external integration provider configuration (per-tenant).
 * Secrets (username/password, token, custom headers) are encrypted at rest
 * and NEVER returned in API responses.
 *
 * This is separate from AiProviderConfig — AI providers handle LLM connections,
 * while IntegrationProviderConfig handles external tool/service connections
 * like ServiceNow.
 */
@Entity('nest_integration_provider_config')
@Index(['tenantId', 'providerKey'])
@Index(['tenantId', 'isEnabled'])
export class IntegrationProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'provider_key', type: 'varchar', length: 30 })
  providerKey: IntegrationProviderKey;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  /**
   * Base URL for the integration (e.g., https://instance.service-now.com)
   * Validated for SSRF safety before storage.
   */
  @Column({ name: 'base_url', type: 'varchar', length: 1024 })
  baseUrl: string;

  @Column({ name: 'auth_type', type: 'varchar', length: 30 })
  authType: IntegrationAuthType;

  /**
   * Encrypted username — NEVER returned in API responses
   */
  @Column({ name: 'username_encrypted', type: 'text', nullable: true })
  usernameEncrypted: string | null;

  /**
   * Encrypted password — NEVER returned in API responses
   */
  @Column({ name: 'password_encrypted', type: 'text', nullable: true })
  passwordEncrypted: string | null;

  /**
   * Encrypted API token — NEVER returned in API responses
   */
  @Column({ name: 'token_encrypted', type: 'text', nullable: true })
  tokenEncrypted: string | null;

  /**
   * Encrypted custom headers JSON — NEVER returned in API responses
   */
  @Column({ name: 'custom_headers_encrypted', type: 'text', nullable: true })
  customHeadersEncrypted: string | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
