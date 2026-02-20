import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Audit Log Entity
 *
 * Stores audit trail entries for all significant actions in the system.
 * Used for compliance, security monitoring, and debugging.
 */
@Entity('nest_audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['entityName', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant ID - nullable for system-level actions or unauthenticated requests
   */
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

  /**
   * User ID (actor) - nullable for unauthenticated requests
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  /**
   * Action performed (e.g., "USER_LOGIN", "GET /users", "UPDATE_POLICY")
   * For entity changes, use AuditAction enum values (create, update, delete)
   */
  @Column({ type: 'varchar', length: 255 })
  action: string;

  /**
   * Resource type (e.g., "users", "tenants", "auth", "policies")
   */
  @Column({ type: 'varchar', length: 100 })
  resource: string;

  /**
   * Resource ID if applicable (e.g., user ID, policy ID)
   */
  @Column({ name: 'resource_id', type: 'varchar', length: 255, nullable: true })
  resourceId: string | null;

  /**
   * Entity name for entity-level audit (e.g., "GrcRisk", "GrcPolicy")
   */
  @Column({ name: 'entity_name', type: 'varchar', length: 100, nullable: true })
  @Index()
  entityName: string | null;

  /**
   * Entity ID for entity-level audit
   */
  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  @Index()
  entityId: string | null;

  /**
   * State of the entity before the change (for UPDATE and DELETE actions)
   */
  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState: Record<string, unknown> | null;

  /**
   * State of the entity after the change (for CREATE and UPDATE actions)
   */
  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState: Record<string, unknown> | null;

  /**
   * HTTP status code of the response
   */
  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  /**
   * Additional metadata as JSON (request details, changes, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /**
   * IP address of the request
   */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * Correlation ID for request tracing across services
   */
  @Column({ name: 'correlation_id', type: 'uuid', nullable: true })
  @Index()
  correlationId: string | null;

  /**
   * Request latency in milliseconds
   */
  @Column({ name: 'latency_ms', type: 'int', nullable: true })
  latencyMs: number | null;

  /**
   * Timestamp when the audit log was created
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
