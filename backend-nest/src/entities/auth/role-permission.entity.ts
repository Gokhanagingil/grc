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
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';

/**
 * Role-Permission Junction Entity
 * 
 * Many-to-many relationship between roles and permissions
 * A role can have multiple permissions, and a permission can be assigned to multiple roles
 */
@Entity({ schema: 'auth', name: 'role_permissions' })
@Index('idx_role_permissions_role', ['role_id'])
@Index('idx_role_permissions_permission', ['permission_id'])
@Index('idx_role_permissions_unique', ['role_id', 'permission_id'], { unique: true })
export class RolePermissionEntity {
  @PrimaryColumn('uuid') role_id!: string;
  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: RoleEntity;

  @PrimaryColumn('uuid') permission_id!: string;
  @ManyToOne(() => PermissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission?: PermissionEntity;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

