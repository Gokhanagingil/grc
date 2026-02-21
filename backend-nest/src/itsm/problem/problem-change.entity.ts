import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { ItsmProblem } from './problem.entity';
import { ItsmChange } from '../change/change.entity';
import { ProblemChangeLinkType } from '../enums';

/**
 * Problem-Change Link Entity
 *
 * Maps the many-to-many relationship between problems and changes.
 * Includes a relation type (INVESTIGATES, WORKAROUND, PERMANENT_FIX, ROLLBACK_RELATED).
 */
@Entity('itsm_problem_change')
@Unique(['tenantId', 'problemId', 'changeId', 'relationType'])
@Index(['tenantId', 'problemId'])
@Index(['tenantId', 'changeId'])
@Index(['tenantId', 'createdAt'])
export class ItsmProblemChange extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'problem_id', type: 'uuid' })
  problemId: string;

  @ManyToOne(() => ItsmProblem, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: ItsmProblem;

  @Column({ name: 'change_id', type: 'uuid' })
  changeId: string;

  @ManyToOne(() => ItsmChange, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'change_id' })
  change: ItsmChange;

  @Column({
    name: 'relation_type',
    type: 'enum',
    enum: ProblemChangeLinkType,
    enumName: 'itsm_problem_change_link_type_enum',
    default: ProblemChangeLinkType.INVESTIGATES,
  })
  relationType: ProblemChangeLinkType;
}
