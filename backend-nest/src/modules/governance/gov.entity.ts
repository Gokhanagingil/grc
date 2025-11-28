import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'gov_policies' })
export class GovPolicy {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 160 }) title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ length: 80, nullable: true }) category?: string;
  @Column({ length: 32, default: '1.0' }) version!: string;
  @Column({ length: 32, default: 'draft' }) status!: string;
  @Column({ type: 'date', nullable: true }) effective_date?: string;
  @Column({ type: 'date', nullable: true }) review_date?: string;
  @Column({ length: 80, nullable: true }) owner_first_name?: string;
  @Column({ length: 80, nullable: true }) owner_last_name?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
  @DeleteDateColumn() deleted_at?: Date;
}
