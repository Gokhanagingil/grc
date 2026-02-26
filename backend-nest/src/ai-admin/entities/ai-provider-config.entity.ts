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
 * AI Provider Type Enum
 *
 * Defines supported AI provider backends.
 * LOCAL is the primary/recommended option for v1.
 */
export enum AiProviderType {
  LOCAL = 'LOCAL',
  OPENAI = 'OPENAI',
  AZURE_OPENAI = 'AZURE_OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  OTHER = 'OTHER',
}

/**
 * AI Provider Config Entity
 *
 * Stores AI provider configuration (global + per-tenant optional).
 * Secrets (apiKey, custom headers) are encrypted at rest and NEVER
 * returned in API responses.
 */
@Entity('nest_ai_provider_config')
@Index(['tenantId', 'providerType'])
@Index(['tenantId', 'isEnabled'])
export class AiProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant ID — nullable for global/default config
   */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Column({
    name: 'provider_type',
    type: 'varchar',
    length: 30,
  })
  providerType: AiProviderType;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  /**
   * Base URL for LOCAL providers and compatible gateways
   */
  @Column({ name: 'base_url', type: 'varchar', length: 1024, nullable: true })
  baseUrl: string | null;

  @Column({ name: 'model_name', type: 'varchar', length: 255, nullable: true })
  modelName: string | null;

  @Column({ name: 'request_timeout_ms', type: 'int', default: 30000 })
  requestTimeoutMs: number;

  @Column({ name: 'max_tokens', type: 'int', nullable: true })
  maxTokens: number | null;

  @Column({ name: 'temperature', type: 'decimal', precision: 3, scale: 2, nullable: true })
  temperature: number | null;

  /**
   * Encrypted API key / token — NEVER returned in API responses
   */
  @Column({ name: 'api_key_encrypted', type: 'text', nullable: true })
  apiKeyEncrypted: string | null;

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
