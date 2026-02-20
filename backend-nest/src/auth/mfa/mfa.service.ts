import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserMfaSettings } from '../entities/user-mfa-settings.entity';
import { UserMfaRecoveryCode } from '../entities/user-mfa-recovery-code.entity';
import { TenantSecuritySettings } from '../entities/tenant-security-settings.entity';
import { StructuredLoggerService } from '../../common/logger';
import {
  MfaEnabledEvent,
  MfaDisabledEvent,
  MfaChallengeFailedEvent,
  DomainEventNames,
} from '../../events/domain-events';

/**
 * TOTP Configuration
 */
const TOTP_CONFIG = {
  issuer: 'GRC Platform',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secretLength: 20,
};

/**
 * Number of recovery codes to generate
 */
const RECOVERY_CODE_COUNT = 10;

/**
 * MFA Service
 *
 * Provides Multi-Factor Authentication functionality:
 * - TOTP secret generation and verification
 * - Recovery code management
 * - MFA enforcement checking
 * - Tenant-level MFA policy management
 */
@Injectable()
export class MfaService {
  private readonly logger = new StructuredLoggerService();
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(UserMfaSettings)
    private readonly mfaSettingsRepository: Repository<UserMfaSettings>,
    @InjectRepository(UserMfaRecoveryCode)
    private readonly recoveryCodeRepository: Repository<UserMfaRecoveryCode>,
    @InjectRepository(TenantSecuritySettings)
    private readonly securitySettingsRepository: Repository<TenantSecuritySettings>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.setContext('MfaService');

    // Get encryption key from config or generate a default one
    const keyString =
      this.configService.get<string>('MFA_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      'default-mfa-key-change-in-production';
    // Derive a 32-byte key from the string
    this.encryptionKey = crypto.createHash('sha256').update(keyString).digest();
  }

  /**
   * Generate a new TOTP secret for a user
   * Returns the secret and QR code URL for setup
   */
  generateSecret(
    _userId: string,
    userEmail: string,
  ): {
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  } {
    // Generate a random secret
    const secretBuffer = crypto.randomBytes(TOTP_CONFIG.secretLength);
    const secret = this.base32Encode(secretBuffer);

    // Generate QR code URL (otpauth format)
    const qrCodeUrl = this.generateOtpAuthUrl(userEmail, secret);

    return {
      secret,
      qrCodeUrl,
      manualEntryKey: secret,
    };
  }

  /**
   * Setup MFA for a user (stores encrypted secret, not yet enabled)
   */
  async setupMfa(userId: string, secret: string): Promise<void> {
    const encryptedSecret = this.encryptSecret(secret);

    let settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });

    if (settings) {
      settings.mfaSecret = encryptedSecret;
      settings.mfaEnabled = false; // Not enabled until verified
      settings.mfaVerifiedAt = null;
    } else {
      settings = this.mfaSettingsRepository.create({
        userId,
        mfaSecret: encryptedSecret,
        mfaEnabled: false,
      });
    }

    await this.mfaSettingsRepository.save(settings);
  }

  /**
   * Verify TOTP code and enable MFA if valid
   * Returns recovery codes on first successful verification
   */
  async verifyAndEnableMfa(
    userId: string,
    code: string,
    tenantId?: string,
  ): Promise<{ enabled: boolean; recoveryCodes?: string[] }> {
    const settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings || !settings.mfaSecret) {
      throw new BadRequestException('MFA not set up for this user');
    }

    const secret = this.decryptSecret(settings.mfaSecret);
    const isValid = this.verifyTotp(secret, code);

    if (!isValid) {
      this.eventEmitter.emit(
        DomainEventNames.MFA_CHALLENGE_FAILED,
        new MfaChallengeFailedEvent(
          userId,
          tenantId || null,
          'setup_verification',
        ),
      );
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Enable MFA
    settings.mfaEnabled = true;
    settings.mfaVerifiedAt = new Date();
    await this.mfaSettingsRepository.save(settings);

    // Generate recovery codes
    const recoveryCodes = await this.generateRecoveryCodes(userId);

    // Emit event
    this.eventEmitter.emit(
      DomainEventNames.MFA_ENABLED,
      new MfaEnabledEvent(userId, tenantId || null),
    );

    this.logger.log('mfa.enabled', { userId, tenantId });

    return { enabled: true, recoveryCodes };
  }

  /**
   * Verify TOTP code during login
   */
  async verifyMfaCode(
    userId: string,
    code: string,
    tenantId?: string,
  ): Promise<boolean> {
    const settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings || !settings.mfaEnabled || !settings.mfaSecret) {
      return false;
    }

    const secret = this.decryptSecret(settings.mfaSecret);
    const isValid = this.verifyTotp(secret, code);

    if (isValid) {
      // Update last used timestamp
      settings.lastUsedAt = new Date();
      await this.mfaSettingsRepository.save(settings);
      return true;
    }

    // Check if it's a recovery code
    const isRecoveryCode = await this.verifyRecoveryCode(userId, code);
    if (isRecoveryCode) {
      return true;
    }

    // Emit failure event
    this.eventEmitter.emit(
      DomainEventNames.MFA_CHALLENGE_FAILED,
      new MfaChallengeFailedEvent(userId, tenantId || null, 'login'),
    );

    return false;
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(
    userId: string,
    disabledBy: string,
    tenantId?: string,
  ): Promise<void> {
    const settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      return;
    }

    settings.mfaEnabled = false;
    settings.mfaSecret = null;
    settings.mfaVerifiedAt = null;
    settings.mfaEnforced = false;
    settings.mfaEnforcedAt = null;
    settings.mfaEnforcedBy = null;
    await this.mfaSettingsRepository.save(settings);

    // Delete recovery codes
    await this.recoveryCodeRepository.delete({ userId });

    // Emit event
    this.eventEmitter.emit(
      DomainEventNames.MFA_DISABLED,
      new MfaDisabledEvent(userId, tenantId || null, disabledBy),
    );

    this.logger.log('mfa.disabled', { userId, disabledBy, tenantId });
  }

  /**
   * Check if MFA is enabled for a user
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });
    return settings?.mfaEnabled || false;
  }

  /**
   * Check if MFA is required for a user based on tenant policy
   */
  async isMfaRequired(
    userId: string,
    tenantId: string,
    userRole: string,
  ): Promise<boolean> {
    // Check user-level enforcement
    const userSettings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });
    if (userSettings?.mfaEnforced) {
      return true;
    }

    // Check tenant-level policy
    const tenantSettings = await this.securitySettingsRepository.findOne({
      where: { tenantId },
    });

    if (!tenantSettings) {
      return false;
    }

    if (tenantSettings.mfaRequiredForAll) {
      return true;
    }

    if (tenantSettings.mfaRequiredForAdmins && userRole === 'admin') {
      return true;
    }

    return false;
  }

  /**
   * Get MFA status for a user
   */
  async getMfaStatus(userId: string): Promise<{
    enabled: boolean;
    enforced: boolean;
    verifiedAt: Date | null;
    lastUsedAt: Date | null;
  }> {
    const settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });

    return {
      enabled: settings?.mfaEnabled || false,
      enforced: settings?.mfaEnforced || false,
      verifiedAt: settings?.mfaVerifiedAt || null,
      lastUsedAt: settings?.lastUsedAt || null,
    };
  }

  /**
   * Enforce MFA for a user (admin action)
   */
  async enforceMfa(
    userId: string,
    enforcedBy: string,
    tenantId?: string,
  ): Promise<void> {
    let settings = await this.mfaSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.mfaSettingsRepository.create({
        userId,
        mfaEnabled: false,
        mfaEnforced: true,
        mfaEnforcedAt: new Date(),
        mfaEnforcedBy: enforcedBy,
      });
    } else {
      settings.mfaEnforced = true;
      settings.mfaEnforcedAt = new Date();
      settings.mfaEnforcedBy = enforcedBy;
    }

    await this.mfaSettingsRepository.save(settings);

    this.logger.log('mfa.enforced', { userId, enforcedBy, tenantId });
  }

  /**
   * Get or create tenant security settings
   */
  async getTenantSecuritySettings(
    tenantId: string,
  ): Promise<TenantSecuritySettings> {
    let settings = await this.securitySettingsRepository.findOne({
      where: { tenantId },
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        tenantId,
      });
      await this.securitySettingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Update tenant security settings
   */
  async updateTenantSecuritySettings(
    tenantId: string,
    updates: Partial<TenantSecuritySettings>,
  ): Promise<TenantSecuritySettings> {
    let settings = await this.securitySettingsRepository.findOne({
      where: { tenantId },
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        tenantId,
        ...updates,
      });
    } else {
      Object.assign(settings, updates);
    }

    return this.securitySettingsRepository.save(settings);
  }

  /**
   * Regenerate recovery codes for a user
   */
  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    // Delete existing codes
    await this.recoveryCodeRepository.delete({ userId });

    // Generate new codes
    return this.generateRecoveryCodes(userId);
  }

  // ==================== Private Methods ====================

  /**
   * Generate TOTP code for current time window
   */
  private generateTotp(secret: string, timeStep?: number): string {
    const time = timeStep ?? Math.floor(Date.now() / 1000 / TOTP_CONFIG.period);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(time));

    const secretBuffer = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
    return otp.toString().padStart(TOTP_CONFIG.digits, '0');
  }

  /**
   * Verify TOTP code (allows 1 time step drift)
   */
  private verifyTotp(secret: string, code: string): boolean {
    const currentTime = Math.floor(Date.now() / 1000 / TOTP_CONFIG.period);

    // Check current and adjacent time windows
    for (let i = -1; i <= 1; i++) {
      const expectedCode = this.generateTotp(secret, currentTime + i);
      if (
        crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate otpauth URL for QR code
   */
  private generateOtpAuthUrl(email: string, secret: string): string {
    const params = new URLSearchParams({
      secret,
      issuer: TOTP_CONFIG.issuer,
      algorithm: TOTP_CONFIG.algorithm,
      digits: TOTP_CONFIG.digits.toString(),
      period: TOTP_CONFIG.period.toString(),
    });

    return `otpauth://totp/${encodeURIComponent(TOTP_CONFIG.issuer)}:${encodeURIComponent(email)}?${params.toString()}`;
  }

  /**
   * Generate recovery codes
   */
  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes: string[] = [];

    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      // Generate a random 8-character code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);

      // Hash and store the code
      const codeHash = await bcrypt.hash(code, 10);
      const recoveryCode = this.recoveryCodeRepository.create({
        userId,
        codeHash,
      });
      await this.recoveryCodeRepository.save(recoveryCode);
    }

    return codes;
  }

  /**
   * Verify a recovery code
   */
  private async verifyRecoveryCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const recoveryCodes = await this.recoveryCodeRepository.find({
      where: { userId, usedAt: undefined },
    });

    for (const recoveryCode of recoveryCodes) {
      const isValid = await bcrypt.compare(
        code.toUpperCase(),
        recoveryCode.codeHash,
      );
      if (isValid) {
        // Mark code as used
        recoveryCode.usedAt = new Date();
        await this.recoveryCodeRepository.save(recoveryCode);

        this.logger.log('mfa.recovery_code_used', { userId });
        return true;
      }
    }

    return false;
  }

  /**
   * Encrypt secret for storage
   */
  private encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt secret from storage
   */
  private decryptSecret(encryptedSecret: string): string {
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Base32 encode a buffer
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }

    return result;
  }

  /**
   * Base32 decode a string
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');

    let bits = 0;
    let value = 0;
    const result: number[] = [];

    for (const char of cleanedInput) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        result.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(result);
  }
}
