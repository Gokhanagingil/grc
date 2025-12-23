import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { TenantLdapConfig } from '../entities/tenant-ldap-config.entity';
import { LdapGroupRoleMapping } from '../entities/ldap-group-role-mapping.entity';
import { StructuredLoggerService } from '../../common/logger';
import { LdapAuthAttemptEvent, DomainEventNames } from '../../events/domain-events';

/**
 * LDAP User Info returned from authentication
 */
export interface LdapUserInfo {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dn: string;
  groups: string[];
  role: string;
}

/**
 * LDAP Connection Test Result
 */
export interface LdapConnectionTestResult {
  success: boolean;
  message: string;
  responseTimeMs: number;
}

/**
 * LDAP Service
 *
 * Provides LDAP/Active Directory integration:
 * - Configuration management per tenant
 * - User authentication against LDAP
 * - Group to role mapping
 * - Connection testing
 *
 * NOTE: This is an MVP implementation that simulates LDAP operations.
 * In production, you would use a library like 'ldapjs' for actual LDAP communication.
 * The actual LDAP library integration is deferred to avoid adding external dependencies.
 */
@Injectable()
export class LdapService {
  private readonly logger = new StructuredLoggerService();
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(TenantLdapConfig)
    private readonly ldapConfigRepository: Repository<TenantLdapConfig>,
    @InjectRepository(LdapGroupRoleMapping)
    private readonly groupMappingRepository: Repository<LdapGroupRoleMapping>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext('LdapService');
    
    // Get encryption key from config
    const keyString = this.configService.get<string>('LDAP_ENCRYPTION_KEY') || 
                      this.configService.get<string>('JWT_SECRET') || 
                      'default-ldap-key-change-in-production';
    this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();
  }

  /**
   * Check if LDAP is enabled for a tenant
   */
  async isLdapEnabled(tenantId: string): Promise<boolean> {
    const config = await this.ldapConfigRepository.findOne({
      where: { tenantId },
    });
    return config?.enabled || false;
  }

  /**
   * Get LDAP configuration for a tenant
   */
  async getLdapConfig(tenantId: string): Promise<TenantLdapConfig | null> {
    return this.ldapConfigRepository.findOne({
      where: { tenantId },
    });
  }

  /**
   * Get LDAP configuration for display (without sensitive data)
   */
  async getLdapConfigSafe(tenantId: string): Promise<Partial<TenantLdapConfig> | null> {
    const config = await this.getLdapConfig(tenantId);
    if (!config) return null;

    // Return config without sensitive fields
    return {
      id: config.id,
      tenantId: config.tenantId,
      enabled: config.enabled,
      host: config.host,
      port: config.port,
      useSsl: config.useSsl,
      baseDn: config.baseDn,
      userSearchFilter: config.userSearchFilter,
      usernameAttribute: config.usernameAttribute,
      emailAttribute: config.emailAttribute,
      firstNameAttribute: config.firstNameAttribute,
      lastNameAttribute: config.lastNameAttribute,
      groupSearchBase: config.groupSearchBase,
      groupSearchFilter: config.groupSearchFilter,
      defaultRole: config.defaultRole,
      allowLocalFallback: config.allowLocalFallback,
      connectionTimeoutMs: config.connectionTimeoutMs,
      lastConnectionTest: config.lastConnectionTest,
      lastConnectionStatus: config.lastConnectionStatus,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Create or update LDAP configuration for a tenant
   */
  async saveLdapConfig(
    tenantId: string,
    configData: Partial<TenantLdapConfig>,
  ): Promise<TenantLdapConfig> {
    let config = await this.ldapConfigRepository.findOne({
      where: { tenantId },
    });

    if (!config) {
      config = this.ldapConfigRepository.create({
        tenantId,
        ...configData,
      });
    } else {
      Object.assign(config, configData);
    }

    // Encrypt bind password if provided
    if (configData.bindPassword) {
      config.bindPassword = this.encryptPassword(configData.bindPassword);
    }

    return this.ldapConfigRepository.save(config);
  }

  /**
   * Test LDAP connection
   */
  async testConnection(tenantId: string): Promise<LdapConnectionTestResult> {
    const startTime = Date.now();
    const config = await this.getLdapConfig(tenantId);

    if (!config) {
      return {
        success: false,
        message: 'LDAP configuration not found',
        responseTimeMs: Date.now() - startTime,
      };
    }

    if (!config.host || !config.baseDn) {
      return {
        success: false,
        message: 'LDAP host and base DN are required',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // NOTE: In production, this would actually connect to the LDAP server
    // For MVP, we simulate a successful connection test
    const result: LdapConnectionTestResult = {
      success: true,
      message: 'Connection test simulated (LDAP library not integrated)',
      responseTimeMs: Date.now() - startTime,
    };

    // Update connection test status
    config.lastConnectionTest = new Date();
    config.lastConnectionStatus = result.success ? 'success' : 'failed';
    config.lastConnectionError = result.success ? null : result.message;
    await this.ldapConfigRepository.save(config);

    this.logger.log('ldap.connection_test', {
      tenantId,
      success: result.success,
      responseTimeMs: result.responseTimeMs,
    });

    return result;
  }

  /**
   * Authenticate user against LDAP
   *
   * NOTE: This is a simulated implementation for MVP.
   * In production, this would use ldapjs or similar library.
   */
  async authenticateUser(
    tenantId: string,
    username: string,
    _password: string,
  ): Promise<LdapUserInfo | null> {
    const config = await this.getLdapConfig(tenantId);

    if (!config || !config.enabled) {
      return null;
    }

    // NOTE: In production, this would:
    // 1. Connect to LDAP server
    // 2. Bind with service account
    // 3. Search for user
    // 4. Attempt to bind as user with provided password
    // 5. Fetch user attributes and groups
    // 6. Map groups to roles

    // For MVP, we emit the event and return null (LDAP auth not actually performed)
    this.eventEmitter.emit(
      DomainEventNames.LDAP_AUTH_ATTEMPT,
      new LdapAuthAttemptEvent(
        username,
        tenantId,
        false,
        'LDAP authentication not implemented in MVP - use local auth',
      ),
    );

    this.logger.log('ldap.auth_attempt', {
      tenantId,
      username,
      success: false,
      reason: 'LDAP library not integrated in MVP',
    });

    return null;
  }

  /**
   * Get group to role mappings for a tenant
   */
  async getGroupMappings(tenantId: string): Promise<LdapGroupRoleMapping[]> {
    return this.groupMappingRepository.find({
      where: { tenantId },
      order: { priority: 'DESC' },
    });
  }

  /**
   * Create or update a group to role mapping
   */
  async saveGroupMapping(
    tenantId: string,
    ldapGroupDn: string,
    platformRole: string,
    ldapGroupName?: string,
    priority?: number,
  ): Promise<LdapGroupRoleMapping> {
    let mapping = await this.groupMappingRepository.findOne({
      where: { tenantId, ldapGroupDn },
    });

    if (!mapping) {
      mapping = this.groupMappingRepository.create({
        tenantId,
        ldapGroupDn,
        platformRole,
        ldapGroupName,
        priority: priority || 0,
      });
    } else {
      mapping.platformRole = platformRole;
      if (ldapGroupName !== undefined) mapping.ldapGroupName = ldapGroupName;
      if (priority !== undefined) mapping.priority = priority;
    }

    return this.groupMappingRepository.save(mapping);
  }

  /**
   * Delete a group to role mapping
   */
  async deleteGroupMapping(tenantId: string, mappingId: string): Promise<void> {
    await this.groupMappingRepository.delete({
      id: mappingId,
      tenantId,
    });
  }

  /**
   * Determine role from LDAP groups
   */
  async determineRoleFromGroups(
    tenantId: string,
    groups: string[],
  ): Promise<string> {
    const mappings = await this.getGroupMappings(tenantId);
    const config = await this.getLdapConfig(tenantId);

    // Find highest priority matching group
    for (const mapping of mappings) {
      if (groups.includes(mapping.ldapGroupDn)) {
        return mapping.platformRole;
      }
    }

    // Return default role
    return config?.defaultRole || 'user';
  }

  // ==================== Private Methods ====================

  /**
   * Encrypt password for storage
   */
  private encryptPassword(password: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt password from storage
   */
  decryptPassword(encryptedPassword: string): string {
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
