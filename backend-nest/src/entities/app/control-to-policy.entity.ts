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
import { ControlLibraryEntity } from './control-library.entity';
import { PolicyEntity } from './policy.entity';

/**
 * Control-to-Policy Relationship Entity
 * 
 * Many-to-many relationship between controls and policies.
 * A control can be linked to multiple policies, and a policy can be linked to multiple controls.
 */
@Entity({ name: 'control_to_policy' })
@Index('idx_control_to_policy_tenant', ['tenant_id'])
@Index('idx_control_to_policy_control', ['control_id'])
@Index('idx_control_to_policy_policy', ['policy_id'])
@Index(
  'idx_control_to_policy_unique',
  ['control_id', 'policy_id', 'tenant_id'],
  { unique: true },
)
export class ControlToPolicyEntity {
  @PrimaryColumn('uuid') control_id!: string;
  @ManyToOne(() => ControlLibraryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'control_id' })
  control?: ControlLibraryEntity;
  
  @PrimaryColumn('uuid') policy_id!: string;
  @ManyToOne(() => PolicyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy?: PolicyEntity;
  
  @PrimaryColumn('uuid') tenant_id!: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

