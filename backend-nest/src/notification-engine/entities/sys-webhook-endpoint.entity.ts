import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_webhook_endpoints')
@Index(['tenantId', 'isActive'])
export class SysWebhookEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 2048, name: 'base_url' })
  baseUrl: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  secret: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  headers: Record<string, string>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'int', name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ type: 'int', name: 'timeout_ms', default: 10000 })
  timeoutMs: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'boolean',
    name: 'allow_insecure',
    default: false,
  })
  allowInsecure: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
