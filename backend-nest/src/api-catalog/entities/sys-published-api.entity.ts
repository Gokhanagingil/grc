import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface FieldPolicy {
  read: string[];
  write: string[];
}

export interface FilterPolicy {
  field: string;
  op: string;
  value: unknown;
}

@Entity('sys_published_apis')
@Index(['tenantId', 'name', 'version'], { unique: true })
@Index(['tenantId', 'isActive'])
export class SysPublishedApi {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'v1' })
  version: string;

  @Column({ type: 'varchar', length: 128, name: 'table_name' })
  tableName: string;

  @Column({
    type: 'jsonb',
    name: 'allowed_fields',
    default: '{"read":[],"write":[]}',
  })
  allowedFields: FieldPolicy;

  @Column({ type: 'jsonb', name: 'filter_policy', default: '[]' })
  filterPolicy: FilterPolicy[];

  @Column({ type: 'boolean', name: 'allow_list', default: true })
  allowList: boolean;

  @Column({ type: 'boolean', name: 'allow_create', default: false })
  allowCreate: boolean;

  @Column({ type: 'boolean', name: 'allow_update', default: false })
  allowUpdate: boolean;

  @Column({ type: 'int', name: 'rate_limit_per_minute', default: 60 })
  rateLimitPerMinute: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
