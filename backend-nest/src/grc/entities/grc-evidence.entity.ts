import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';
import { User } from '../../users/user.entity';
import { EvidenceType } from '../enums';
import { GrcIssueEvidence } from './grc-issue-evidence.entity';

/**
 * GRC Evidence Entity
 *
 * Represents evidence artifacts (documents, screenshots, logs, etc.)
 * that support compliance, risk assessments, or issue resolution.
 */
@Entity('grc_evidence')
@Index(['tenantId', 'type'])
@Index(['tenantId', 'collectedAt'])
export class GrcEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: EvidenceType,
    default: EvidenceType.DOCUMENT,
  })
  type: EvidenceType;

  @Column({ type: 'varchar', length: 500 })
  location: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'collected_at', type: 'date', nullable: true })
  collectedAt: Date | null;

  @Column({ name: 'collected_by_user_id', type: 'uuid', nullable: true })
  collectedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'collected_by_user_id' })
  collectedBy: User | null;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => GrcIssueEvidence, (ie) => ie.evidence)
  issueEvidence: GrcIssueEvidence[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
