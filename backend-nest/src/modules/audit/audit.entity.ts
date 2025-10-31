import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryColumn, UpdateDateColumn, BeforeInsert } from 'typeorm';
import * as uuid from 'uuid';

@Entity({ name: 'audits' })
export class AuditEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 160 }) name!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) status?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
  @DeleteDateColumn() deleted_at?: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = uuid.v4();
    }
  }
}

