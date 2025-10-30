import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'audit', name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id!: string;
  @Column('uuid', { nullable: true }) tenant_id?: string;
  @Column('uuid', { nullable: true }) user_id?: string;
  @Column({ type: 'text' }) entity_schema!: string;
  @Column({ type: 'text' }) entity_table!: string;
  @Column('uuid', { nullable: true }) entity_id?: string;
  @Column({ type: 'text' }) action!: string;
  @Column({ type: 'jsonb', nullable: true }) diff?: Record<string, unknown>;
  @CreateDateColumn() created_at!: Date;
}


