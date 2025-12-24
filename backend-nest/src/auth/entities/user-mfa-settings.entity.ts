import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';

/**
 * User MFA Settings Entity
 *
 * Stores per-user MFA configuration including:
 * - Whether MFA is enabled
 * - Encrypted TOTP secret
 * - Enforcement status (admin-enforced)
 * - Last usage timestamp
 */
@Entity('user_mfa_settings')
export class UserMfaSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index({ unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_secret', type: 'varchar', length: 512, nullable: true })
  mfaSecret: string | null;

  @Column({ name: 'mfa_verified_at', type: 'timestamp', nullable: true })
  mfaVerifiedAt: Date | null;

  @Column({ name: 'mfa_enforced', default: false })
  mfaEnforced: boolean;

  @Column({ name: 'mfa_enforced_at', type: 'timestamp', nullable: true })
  mfaEnforcedAt: Date | null;

  @Column({ name: 'mfa_enforced_by', type: 'uuid', nullable: true })
  mfaEnforcedBy: string | null;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
