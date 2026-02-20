import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_api_audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['apiKeyId', 'createdAt'])
export class SysApiAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'uuid', name: 'api_key_id' })
  apiKeyId: string;

  @Column({ type: 'uuid', name: 'published_api_id' })
  publishedApiId: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 512 })
  path: string;

  @Column({ type: 'int', name: 'status_code' })
  statusCode: number;

  @Column({ type: 'int', name: 'response_time_ms', default: 0 })
  responseTimeMs: number;

  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'jsonb', name: 'request_body', default: '{}' })
  requestBody: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
