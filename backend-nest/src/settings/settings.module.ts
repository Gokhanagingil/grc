import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './system-setting.entity';
import { TenantSetting } from './tenant-setting.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

/**
 * Settings Module
 *
 * Provides system and tenant-specific settings management.
 *
 * Features:
 * - System-wide settings with defaults
 * - Tenant-specific setting overrides
 * - Fallback pattern: tenant -> system -> default
 * - Auto-seeding of default settings on startup
 */
@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting, TenantSetting])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
