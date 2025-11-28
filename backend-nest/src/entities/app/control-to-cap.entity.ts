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
import { CorrectiveActionEntity } from './corrective-action.entity';

/**
 * Control-to-CAP Relationship Entity
 * 
 * Many-to-many relationship between controls and corrective action plans (CAPs).
 * A control can be linked to multiple CAPs, and a CAP can be linked to multiple controls.
 */
@Entity({ name: 'control_to_cap' })
@Index('idx_control_to_cap_tenant', ['tenant_id'])
@Index('idx_control_to_cap_control', ['control_id'])
@Index('idx_control_to_cap_cap', ['cap_id'])
@Index(
  'idx_control_to_cap_unique',
  ['control_id', 'cap_id', 'tenant_id'],
  { unique: true },
)
export class ControlToCapEntity {
  @PrimaryColumn('uuid') control_id!: string;
  @ManyToOne(() => ControlLibraryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'control_id' })
  control?: ControlLibraryEntity;
  
  @PrimaryColumn('uuid') cap_id!: string;
  @ManyToOne(() => CorrectiveActionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cap_id' })
  cap?: CorrectiveActionEntity;
  
  @PrimaryColumn('uuid') tenant_id!: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

