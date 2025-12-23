import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantSecuritySettings } from '../auth/entities/tenant-security-settings.entity';
import { TenantLdapConfig } from '../auth/entities/tenant-ldap-config.entity';
import { UserMfaSettings } from '../auth/entities/user-mfa-settings.entity';

/**
 * Security Posture Response
 */
export interface SecurityPosture {
  authentication: {
    localAuthEnabled: boolean;
    mfaAvailable: boolean;
    ldapEnabled: boolean;
    ldapHost: string | null;
  };
  mfaStatus: {
    usersWithMfaEnabled: number;
    totalUsers: number;
    mfaEnforcedForAdmins: boolean;
    mfaEnforcedForAll: boolean;
  };
  ldapStatus: {
    configured: boolean;
    enabled: boolean;
    lastConnectionTest: Date | null;
    lastConnectionStatus: string | null;
  };
  securitySettings: {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumber: boolean;
    passwordRequireSpecial: boolean;
    sessionTimeoutMinutes: number;
  };
}

/**
 * Admin System Service
 *
 * Provides system-level information for admin visibility:
 * - Security posture
 * - Authentication modes
 * - System health indicators
 */
@Injectable()
export class AdminSystemService {
  constructor(
    @InjectRepository(TenantSecuritySettings)
    private readonly securitySettingsRepository: Repository<TenantSecuritySettings>,
    @InjectRepository(TenantLdapConfig)
    private readonly ldapConfigRepository: Repository<TenantLdapConfig>,
    @InjectRepository(UserMfaSettings)
    private readonly mfaSettingsRepository: Repository<UserMfaSettings>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get security posture for a tenant
   */
  async getSecurityPosture(tenantId: string): Promise<SecurityPosture> {
    // Get tenant security settings
    const securitySettings = await this.securitySettingsRepository.findOne({
      where: { tenantId },
    });

    // Get LDAP configuration
    const ldapConfig = await this.ldapConfigRepository.findOne({
      where: { tenantId },
    });

    // Count users with MFA enabled
    const mfaEnabledCount = await this.mfaSettingsRepository.count({
      where: { mfaEnabled: true },
    });

    // Get total users count (approximate - we don't have direct access to users here)
    const totalMfaSettings = await this.mfaSettingsRepository.count();

    return {
      authentication: {
        localAuthEnabled: true, // Local auth is always enabled
        mfaAvailable: true, // MFA is now available
        ldapEnabled: ldapConfig?.enabled || false,
        ldapHost: ldapConfig?.host || null,
      },
      mfaStatus: {
        usersWithMfaEnabled: mfaEnabledCount,
        totalUsers: totalMfaSettings || 0,
        mfaEnforcedForAdmins: securitySettings?.mfaRequiredForAdmins || false,
        mfaEnforcedForAll: securitySettings?.mfaRequiredForAll || false,
      },
      ldapStatus: {
        configured: !!ldapConfig,
        enabled: ldapConfig?.enabled || false,
        lastConnectionTest: ldapConfig?.lastConnectionTest || null,
        lastConnectionStatus: ldapConfig?.lastConnectionStatus || null,
      },
      securitySettings: {
        passwordMinLength: securitySettings?.passwordMinLength || 8,
        passwordRequireUppercase: securitySettings?.passwordRequireUppercase || false,
        passwordRequireLowercase: securitySettings?.passwordRequireLowercase || false,
        passwordRequireNumber: securitySettings?.passwordRequireNumber || false,
        passwordRequireSpecial: securitySettings?.passwordRequireSpecial || false,
        sessionTimeoutMinutes: securitySettings?.sessionTimeoutMinutes || 60,
      },
    };
  }

  /**
   * Get authentication modes summary
   */
  async getAuthModesSummary(tenantId: string): Promise<{
    modes: string[];
    primary: string;
    fallback: string | null;
  }> {
    const ldapConfig = await this.ldapConfigRepository.findOne({
      where: { tenantId },
    });

    const modes: string[] = ['local'];
    
    if (ldapConfig?.enabled) {
      modes.push('ldap');
    }

    // MFA is an enhancement, not a separate mode
    const securitySettings = await this.securitySettingsRepository.findOne({
      where: { tenantId },
    });

    if (securitySettings?.mfaRequiredForAll || securitySettings?.mfaRequiredForAdmins) {
      modes.push('mfa_enforced');
    }

    return {
      modes,
      primary: ldapConfig?.enabled ? 'ldap' : 'local',
      fallback: ldapConfig?.enabled && ldapConfig?.allowLocalFallback ? 'local' : null,
    };
  }
}
