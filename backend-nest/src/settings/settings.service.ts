import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';
import { TenantSetting } from './tenant-setting.entity';

/**
 * Settings Service
 *
 * Provides access to system and tenant-specific settings.
 * Implements a fallback pattern: tenant setting -> system setting -> default value.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(TenantSetting)
    private readonly tenantSettingRepository: Repository<TenantSetting>,
  ) {}

  /**
   * Seed default system settings on module initialization
   */
  async onModuleInit(): Promise<void> {
    await this.seedDefaultSettings();
  }

  /**
   * Get a system setting by key
   */
  async getSystemSetting(key: string): Promise<string | null> {
    const setting = await this.systemSettingRepository.findOne({
      where: { key },
    });
    return setting?.value ?? null;
  }

  /**
   * Get a tenant-specific setting by key
   */
  async getTenantSetting(
    tenantId: string,
    key: string,
  ): Promise<string | null> {
    const setting = await this.tenantSettingRepository.findOne({
      where: { tenantId, key },
    });
    return setting?.value ?? null;
  }

  /**
   * Get the effective setting value with fallback:
   * 1. Tenant-specific setting (if tenantId provided)
   * 2. System setting
   * 3. Default value (if provided)
   */
  async getEffectiveSetting(
    key: string,
    tenantId?: string,
    defaultValue?: string,
  ): Promise<string | null> {
    // Try tenant setting first if tenantId is provided
    if (tenantId) {
      const tenantSetting = await this.getTenantSetting(tenantId, key);
      if (tenantSetting !== null) {
        return tenantSetting;
      }
    }

    // Fall back to system setting
    const systemSetting = await this.getSystemSetting(key);
    if (systemSetting !== null) {
      return systemSetting;
    }

    // Return default value if provided
    return defaultValue ?? null;
  }

  /**
   * Get the effective setting value parsed as JSON
   */
  async getEffectiveSettingParsed<T>(
    key: string,
    tenantId?: string,
    defaultValue?: T,
  ): Promise<T | null> {
    const value = await this.getEffectiveSetting(key, tenantId);
    if (value === null) {
      return defaultValue ?? null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      // If not valid JSON, return as-is (for simple string values)
      return value as unknown as T;
    }
  }

  /**
   * Set a system setting
   */
  async setSystemSetting(
    key: string,
    value: string,
    description?: string,
    category?: string,
  ): Promise<SystemSetting> {
    let setting = await this.systemSettingRepository.findOne({
      where: { key },
    });

    if (setting) {
      setting.value = value;
      if (description !== undefined) setting.description = description;
      if (category !== undefined) setting.category = category;
    } else {
      setting = this.systemSettingRepository.create({
        key,
        value,
        description,
        category,
      });
    }

    return this.systemSettingRepository.save(setting);
  }

  /**
   * Set a tenant-specific setting
   */
  async setTenantSetting(
    tenantId: string,
    key: string,
    value: string,
  ): Promise<TenantSetting> {
    let setting = await this.tenantSettingRepository.findOne({
      where: { tenantId, key },
    });

    if (setting) {
      setting.value = value;
    } else {
      setting = this.tenantSettingRepository.create({
        tenantId,
        key,
        value,
      });
    }

    return this.tenantSettingRepository.save(setting);
  }

  /**
   * Delete a tenant-specific setting (reverts to system default)
   */
  async deleteTenantSetting(tenantId: string, key: string): Promise<boolean> {
    const result = await this.tenantSettingRepository.delete({
      tenantId,
      key,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Get all system settings
   */
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return this.systemSettingRepository.find({
      order: { category: 'ASC', key: 'ASC' },
    });
  }

  /**
   * Get all tenant settings for a specific tenant
   */
  async getAllTenantSettings(tenantId: string): Promise<TenantSetting[]> {
    return this.tenantSettingRepository.find({
      where: { tenantId },
      order: { key: 'ASC' },
    });
  }

  /**
   * Seed default system settings
   */
  private async seedDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'maxLoginAttempts',
        value: '5',
        description: 'Maximum number of failed login attempts before lockout',
        category: 'security',
      },
      {
        key: 'sessionTimeoutMinutes',
        value: '60',
        description: 'Session timeout in minutes',
        category: 'security',
      },
      {
        key: 'defaultLocale',
        value: '"en-US"',
        description: 'Default locale for the application',
        category: 'localization',
      },
      {
        key: 'defaultTimezone',
        value: '"UTC"',
        description: 'Default timezone for the application',
        category: 'localization',
      },
      {
        key: 'maxFileUploadSizeMB',
        value: '10',
        description: 'Maximum file upload size in megabytes',
        category: 'limits',
      },
      {
        key: 'auditLogRetentionDays',
        value: '90',
        description: 'Number of days to retain audit logs',
        category: 'audit',
      },
    ];

    for (const setting of defaultSettings) {
      const existing = await this.systemSettingRepository.findOne({
        where: { key: setting.key },
      });

      if (!existing) {
        await this.systemSettingRepository.save(
          this.systemSettingRepository.create(setting),
        );
      }
    }
  }
}
