import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * User Entity
 *
 * NOTE: This entity uses a separate table name 'nest_users' to avoid
 * conflicts with the existing Express backend's 'users' table during
 * the migration period. The Express backend uses integer primary keys,
 * while this entity uses UUIDs.
 *
 * Once the migration is complete, this can be unified with the existing
 * users table or the Express backend can be updated to use this table.
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}

@Entity('nest_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Tenant relationship
   *
   * Each user belongs to exactly one tenant.
   * The tenantId is nullable to support the demo admin user
   * which may be created before any tenant exists.
   */
  @Column({ name: 'tenant_id', nullable: true })
  tenantId?: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
