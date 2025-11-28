import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { timestampColumnType } from '../../common/database/column-types';

@Entity({ schema: 'auth', name: 'refresh_tokens' })
@Index('idx_refresh_tokens_user_id', ['user_id'])
@Index('idx_refresh_tokens_expires_at', ['expires_at'])
@Index('idx_refresh_tokens_jti', ['jti'], { unique: true })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column('uuid') user_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column('uuid', { unique: true }) jti!: string; // JWT ID

  @Column(timestampColumnType) expires_at!: Date;

  @Column({ type: 'boolean', default: false }) revoked!: boolean;

  @Column({ type: timestampColumnType, nullable: true })
  revoked_at?: Date;

  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
