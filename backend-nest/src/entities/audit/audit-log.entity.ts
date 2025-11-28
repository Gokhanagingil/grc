import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  ValueTransformer,
} from 'typeorm';
import { jsonColumnType, isPostgres } from '../../common/database/column-types';
import * as uuid from 'uuid';

// Transformer to handle JSON serialization/deserialization for SQLite compatibility
// For PostgreSQL, TypeORM's jsonb type handles this automatically
const jsonTransformer: ValueTransformer = {
  to: (value: Record<string, unknown> | string | null | undefined): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    // If already a string, return as-is
    if (typeof value === 'string') {
      return value;
    }
    // If object, serialize to JSON string
    return JSON.stringify(value);
  },
  from: (value: string | null): Record<string, unknown> | null => {
    if (value === null || value === undefined) {
      return null;
    }
    // Deserialize JSON string to object
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },
};

@Entity({ schema: 'audit', name: 'audit_logs' })
export class AuditLogEntity {
  // For SQLite: use varchar(36) to match UUID string length
  // For PostgreSQL: use uuid type
  @PrimaryColumn(isPostgres ? 'uuid' : { type: 'varchar', length: 36 })
  id!: string;
  
  // For SQLite: use varchar(36) for UUID columns
  // For PostgreSQL: use uuid type
  @Column(isPostgres ? 'uuid' : { type: 'varchar', length: 36, nullable: true })
  tenant_id?: string;
  
  @Column(isPostgres ? 'uuid' : { type: 'varchar', length: 36, nullable: true })
  user_id?: string;
  
  @Column({ type: 'text' })
  entity_schema!: string;
  
  @Column({ type: 'text' })
  entity_table!: string;
  
  @Column(isPostgres ? 'uuid' : { type: 'varchar', length: 36, nullable: true })
  entity_id?: string;
  
  @Column({ type: 'text' })
  action!: string;
  
  // For SQLite: use text with transformer to ensure proper JSON serialization
  // For PostgreSQL: use jsonb (no transformer needed, TypeORM handles it)
  @Column({
    type: isPostgres ? jsonColumnType : 'text',
    nullable: true,
    ...(isPostgres ? {} : { transformer: jsonTransformer }),
  })
  diff?: Record<string, unknown>;
  
  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuid.v4();
    }
  }
}
