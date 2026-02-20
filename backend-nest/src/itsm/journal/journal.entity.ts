import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum JournalType {
  WORK_NOTE = 'work_note',
  COMMENT = 'comment',
}

@Entity('itsm_journal')
@Index(['tenantId', 'tableName', 'recordId'])
@Index(['tenantId', 'tableName', 'recordId', 'type'])
@Index(['tenantId', 'createdAt'])
export class ItsmJournal extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'table_name', type: 'varchar', length: 100 })
  tableName: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: JournalType.COMMENT,
  })
  type: JournalType;

  @Column({ type: 'text' })
  message: string;
}
