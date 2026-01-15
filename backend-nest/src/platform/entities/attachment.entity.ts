import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';

/**
 * Attachment Status Enum
 * Tracks the lifecycle of an attachment
 */
export enum AttachmentStatus {
  UPLOADED = 'uploaded',
  SCANNED = 'scanned',
  BLOCKED = 'blocked',
  DELETED = 'deleted',
}

/**
 * Storage Provider Enum
 * Identifies where the file is stored
 */
export enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3',
}

/**
 * Attachment Entity
 *
 * Universal attachment storage for any record in the platform.
 * Supports multi-tenant isolation and soft delete pattern.
 *
 * Usage:
 * - ref_table: The table name of the parent record (e.g., 'grc_risks', 'grc_policies')
 * - ref_id: The UUID of the parent record
 * - Files are stored via StorageAdapter and referenced by storage_key
 */
@Entity('nest_attachments')
@Index(['tenantId', 'refTable', 'refId'])
@Index(['tenantId', 'storageKey'], { unique: true })
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'ref_table', type: 'varchar', length: 100 })
  @Index()
  refTable: string;

  @Column({ name: 'ref_id', type: 'uuid' })
  @Index()
  refId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'content_type', type: 'varchar', length: 100 })
  contentType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  @Column({ name: 'sha256', type: 'varchar', length: 64 })
  sha256: string;

  @Column({
    name: 'storage_provider',
    type: 'enum',
    enum: StorageProvider,
    default: StorageProvider.LOCAL,
  })
  storageProvider: StorageProvider;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AttachmentStatus,
    default: AttachmentStatus.UPLOADED,
  })
  status: AttachmentStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
