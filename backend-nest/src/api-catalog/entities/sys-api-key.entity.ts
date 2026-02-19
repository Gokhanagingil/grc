import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_api_keys')
@Index(['tenantId', 'isActive'])
@Index(['keyHash'], { unique: true })
export class SysApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 128, name: 'key_hash' })
  keyHash: string;

  @Column({ type: 'varchar', length: 16, name: 'key_prefix' })
  keyPrefix: string;

  @Column({ type: 'jsonb', default: '[]' })
  scopes: string[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', name: 'expires_at', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
