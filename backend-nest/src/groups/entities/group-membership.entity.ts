import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sys_group_memberships')
@Index(['tenantId', 'groupId', 'userId'], { unique: true })
export class SysGroupMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'group_id' })
  @Index()
  groupId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
