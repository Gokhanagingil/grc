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
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tenant ID - nullable for system-level actions or unauthenticated requests
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

  /**
   * User ID - nullable for unauthenticated requests
   */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  /**
   * Action performed (e.g., "USER_LOGIN", "GET /users", "UPDATE_POLICY")
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
  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId: string | null;

  /**
   * HTTP status code of the response
   */
  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  /**
   * Additional metadata as JSON (request details, changes, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  /**
   * IP address of the request
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * Timestamp when the audit log was created
   */
  @CreateDateColumn()
  createdAt: Date;
}
