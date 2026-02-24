import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { MappingEntityBase } from '../../../common/entities';
import { ItsmChangeTemplate } from './change-template.entity';

@Entity('itsm_change_template_dependencies')
@Unique(['tenantId', 'templateId', 'predecessorTaskKey', 'successorTaskKey'])
@Index(['tenantId', 'templateId'])
export class ItsmChangeTemplateDependency extends MappingEntityBase {
  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @ManyToOne(() => ItsmChangeTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ItsmChangeTemplate;

  @Column({ name: 'predecessor_task_key', type: 'varchar', length: 100 })
  predecessorTaskKey: string;

  @Column({ name: 'successor_task_key', type: 'varchar', length: 100 })
  successorTaskKey: string;
}
