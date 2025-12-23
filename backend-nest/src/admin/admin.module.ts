import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSystemService } from './admin-system.service';
import { AdminSystemController } from './admin-system.controller';
import { TenantSecuritySettings } from '../auth/entities/tenant-security-settings.entity';
import { TenantLdapConfig } from '../auth/entities/tenant-ldap-config.entity';
import { UserMfaSettings } from '../auth/entities/user-mfa-settings.entity';
import { AuthModule } from '../auth/auth.module';

/**
 * Admin Module
 *
 * Provides admin-level functionality:
 * - System visibility
 * - Security posture monitoring
 * - Configuration management
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantSecuritySettings,
      TenantLdapConfig,
      UserMfaSettings,
    ]),
    AuthModule,
  ],
  controllers: [AdminSystemController],
  providers: [AdminSystemService],
  exports: [AdminSystemService],
})
export class AdminModule {}
