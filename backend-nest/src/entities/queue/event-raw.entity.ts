import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  jsonColumnType,
  timestampColumnType,
} from '../../common/database/column-types';

@Entity({ schema: 'queue', name: 'events_raw' })
export class EventRawEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid', { nullable: true }) tenant_id?: string;
  @Column({ type: 'text' }) source!: string;
  @Column({ type: 'text' }) event_type!: string;
  @Column({ type: 'text', nullable: true }) fingerprint?: string;
  @Column({
    type: timestampColumnType,
    default: () => 'CURRENT_TIMESTAMP',
  })
  received_at!: Date;
  @Column({ type: 'text', nullable: true }) idempotency_key?: string;
  @Column({ type: jsonColumnType, nullable: true })
  payload?: any;
  @Column({ type: jsonColumnType, nullable: true })
  ingest_meta?: Record<string, any>;
  @CreateDateColumn() created_at!: Date;
}
