import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PolicyStatus } from './policy-status.enum';

@Entity({ name: 'policies' })
@Index(['code'], { unique: true })
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  name!: string;

  @Column({ length: 64 })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: PolicyStatus, default: PolicyStatus.DRAFT })
  status!: PolicyStatus;

  @Column({ length: 80, nullable: true })
  owner?: string;

  @Column({ length: 32, nullable: true })
  version?: string;

  @Column({ type: 'date', nullable: true })
  effectiveDate?: string;

  @Column({ type: 'date', nullable: true })
  reviewDate?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
