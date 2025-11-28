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
import { UserEntity } from './user.entity';
import { RoleEntity } from './role.entity';

/**
 * User-Role Junction Entity
 * 
 * Many-to-many relationship between users and roles
 * A user can have multiple roles, and a role can be assigned to multiple users
 */
@Entity({ schema: 'auth', name: 'user_roles' })
@Index('idx_user_roles_user', ['user_id'])
@Index('idx_user_roles_role', ['role_id'])
@Index('idx_user_roles_unique', ['user_id', 'role_id'], { unique: true })
export class UserRoleEntity {
  @PrimaryColumn('uuid') user_id!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @PrimaryColumn('uuid') role_id!: string;
  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: RoleEntity;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}

