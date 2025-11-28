import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'auth', name: 'permissions' })
export class PermissionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'text', unique: true }) code!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
