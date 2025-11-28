import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuditTestEntity } from './audit-test.entity';
import {
  enumColumnOptions,
  timestampColumnType,
} from '../../common/database/column-types';

export enum AuditEvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LINK = 'link',
  NOTE = 'note',
}

@Entity({ name: 'audit_evidences' })
@Index('idx_audit_evidences_tenant', ['tenant_id'])
@Index('idx_audit_evidences_test', ['test_id'])
export class AuditEvidenceEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column('uuid') test_id!: string;
  @ManyToOne(() => AuditTestEntity)
  @JoinColumn({ name: 'test_id' })
  test?: AuditTestEntity;

  @Column({
    ...enumColumnOptions(AuditEvidenceType, AuditEvidenceType.NOTE),
  })
  type!: AuditEvidenceType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  related_entity_type?: string; // 'test', 'finding', 'corrective_action'
  @Column('uuid', { nullable: true }) related_entity_id?: string; // FK to test/finding/corrective_action

  @Column({ type: 'varchar', length: 255, nullable: true }) file_name?: string;
  @Column({ type: 'text', nullable: true }) file_url?: string; // URI for link/document
  @Column({ type: 'text', nullable: true }) uri_or_text?: string; // Alias for file_url or note text
  @Column({ type: 'text', nullable: true }) note?: string;
  @Column({ type: timestampColumnType })
  collected_at!: Date;
  @Column('uuid', { nullable: true }) collected_by?: string;

  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
