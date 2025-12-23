import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

/**
 * LDAP Group Role Mapping Entity
 *
 * Maps LDAP groups to platform roles.
 * Higher priority mappings take precedence when a user belongs to multiple groups.
 */
@Entity('ldap_group_role_mapping')
@Index(['tenantId', 'ldapGroupDn'], { unique: true })
export class LdapGroupRoleMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'ldap_group_dn', type: 'varchar', length: 512 })
  ldapGroupDn: string;

  @Column({ name: 'ldap_group_name', type: 'varchar', length: 255, nullable: true })
  ldapGroupName: string | null;

  @Column({ name: 'platform_role', type: 'varchar', length: 32 })
  platformRole: string;

  @Column({ default: 0 })
  priority: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
