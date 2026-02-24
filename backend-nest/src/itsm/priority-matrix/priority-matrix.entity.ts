import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';

/**
 * Priority Matrix Entry Entity
 *
 * Stores tenant-configurable impact × urgency → priority mappings.
 * Each row maps one (impact, urgency) pair to a priority for a given tenant.
 * The backend uses this table as source of truth for priority computation.
 *
 * Default matrix (ITIL standard):
 * | Impact \ Urgency | HIGH | MEDIUM | LOW |
 * |------------------|------|--------|-----|
 * | HIGH             | P1   | P2     | P3  |
 * | MEDIUM           | P2   | P3     | P4  |
 * | LOW              | P3   | P4     | P4  |
 */
@Entity('itsm_priority_matrix')
@Index(['tenantId', 'impact', 'urgency'], { unique: true })
export class PriorityMatrixEntry extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  impact: string;

  @Column({ type: 'varchar', length: 20 })
  urgency: string;

  @Column({ type: 'varchar', length: 10 })
  priority: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;
}
