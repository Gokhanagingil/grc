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
 * AI Feature Key Enum
 *
 * Enumerates the AI-powered features in the platform.
 * v1 supports RISK_ADVISORY and INCIDENT_COPILOT.
 * Others are placeholders for v1.1+.
 */
export enum AiFeatureKey {
  RISK_ADVISORY = 'RISK_ADVISORY',
  INCIDENT_COPILOT = 'INCIDENT_COPILOT',
  CHANGE_ASSISTANT = 'CHANGE_ASSISTANT',
  KNOWLEDGE_DRAFTING = 'KNOWLEDGE_DRAFTING',
  EVIDENCE_SUMMARY = 'EVIDENCE_SUMMARY',
}

/**
 * AI Feature Policy Entity
 *
 * Per-tenant policy governing AI feature usage.
 * Controls which features are enabled, the default provider,
 * and human-in-the-loop requirements.
 */
@Entity('nest_ai_feature_policy')
@Index(['tenantId'], { unique: true })
export class AiFeaturePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant ID — required; each tenant has exactly one policy row
   */
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /**
   * Global toggle — if false, all AI features are disabled for this tenant
   */
  @Column({ name: 'is_ai_enabled', type: 'boolean', default: false })
  isAiEnabled: boolean;

  /**
   * Default provider config ID — fallback to global if null
   */
  @Column({ name: 'default_provider_config_id', type: 'uuid', nullable: true })
  defaultProviderConfigId: string | null;

  /**
   * Whether human approval is required by default for AI actions
   */
  @Column({ name: 'human_approval_required_default', type: 'boolean', default: true })
  humanApprovalRequiredDefault: boolean;

  /**
   * JSON map of feature keys to enabled status
   * e.g. { "RISK_ADVISORY": true, "INCIDENT_COPILOT": false }
   */
  @Column({ name: 'allowed_features', type: 'jsonb', default: '{}' })
  allowedFeatures: Record<string, boolean>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
