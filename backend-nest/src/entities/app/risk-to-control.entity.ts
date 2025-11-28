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
import { RiskCatalogEntity } from './risk-catalog.entity';
import { ControlLibraryEntity } from './control-library.entity';

@Entity({ name: 'risk_to_control' })
@Index('idx_risk_to_control_tenant', ['tenant_id'])
@Index('idx_risk_to_control_risk', ['risk_id'])
@Index('idx_risk_to_control_control', ['control_id'])
@Index('idx_risk_to_control_unique', ['risk_id', 'control_id', 'tenant_id'], {
  unique: true,
})
export class RiskToControlEntity {
  @PrimaryColumn('uuid') risk_id!: string;
  @ManyToOne(() => RiskCatalogEntity, (risk) => risk.related_controls)
  @JoinColumn({ name: 'risk_id' })
  risk?: RiskCatalogEntity;
  @PrimaryColumn('uuid') control_id!: string;
  @ManyToOne(() => ControlLibraryEntity)
  @JoinColumn({ name: 'control_id' })
  control?: ControlLibraryEntity;
  @PrimaryColumn('uuid') tenant_id!: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
