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
 * Tool Key Enum
 *
 * Enumerates the available external tools in the platform.
 * v1.1 supports ServiceNow read-only tools.
 */
export enum ToolKey {
  SERVICENOW_QUERY_TABLE = 'SERVICENOW_QUERY_TABLE',
  SERVICENOW_GET_RECORD = 'SERVICENOW_GET_RECORD',
  SERVICENOW_QUERY_INCIDENTS = 'SERVICENOW_QUERY_INCIDENTS',
  SERVICENOW_QUERY_CHANGES = 'SERVICENOW_QUERY_CHANGES',
}

/**
 * Tool Policy Entity
 *
 * Per-tenant policy governing external tool usage.
 * Controls which tools are enabled and rate limits.
 */
@Entity('nest_tool_policy')
@Index(['tenantId'], { unique: true })
export class ToolPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /**
   * Global toggle — if false, all external tools are disabled for this tenant
   */
  @Column({ name: 'is_tools_enabled', type: 'boolean', default: false })
  isToolsEnabled: boolean;

  /**
   * JSON array of allowed tool keys
   * e.g. ["SERVICENOW_QUERY_TABLE", "SERVICENOW_GET_RECORD"]
   */
  @Column({ name: 'allowed_tools', type: 'jsonb', default: '[]' })
  allowedTools: string[];

  /**
   * Rate limit per minute (optional, 0 = no limit)
   */
  @Column({ name: 'rate_limit_per_minute', type: 'int', default: 60 })
  rateLimitPerMinute: number;

  /**
   * Max tool calls per AI run (optional, 0 = no limit)
   */
  @Column({ name: 'max_tool_calls_per_run', type: 'int', default: 10 })
  maxToolCallsPerRun: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
