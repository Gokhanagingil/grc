import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM Encryption Service
 *
 * Provides symmetric encryption/decryption for sensitive AI config values
 * (API keys, tokens, custom headers).
 *
 * Key is sourced from the AI_ENCRYPTION_KEY environment variable.
 * If not set, falls back to a derived key from JWT_SECRET (not ideal but functional).
 *
 * Format: base64(iv:authTag:ciphertext)
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('AI_ENCRYPTION_KEY');
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (encryptionKey) {
      // Use dedicated AI encryption key (recommended)
      this.key = crypto.createHash('sha256').update(encryptionKey).digest();
    } else if (jwtSecret) {
      // Derive from JWT secret as fallback
      this.key = crypto
        .createHash('sha256')
        .update(`ai-config-encryption:${jwtSecret}`)
        .digest();
      this.logger.warn(
        'AI_ENCRYPTION_KEY not set. Deriving encryption key from JWT_SECRET. ' +
          'Set AI_ENCRYPTION_KEY for production use.',
      );
    } else {
      // Generate ephemeral key — encrypted data will NOT survive restarts
      this.key = crypto.randomBytes(32);
      this.logger.error(
        'Neither AI_ENCRYPTION_KEY nor JWT_SECRET is set. ' +
          'Using ephemeral key — encrypted secrets will be lost on restart!',
      );
    }
  }

  /**
   * Encrypt a plaintext string.
   * Returns a base64-encoded string containing iv + authTag + ciphertext.
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.authTagLength,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Pack: iv (16) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return packed.toString('base64');
  }

  /**
   * Decrypt a base64-encoded string produced by encrypt().
   * Returns the original plaintext.
   * Returns null if decryption fails (e.g. wrong key, corrupted data).
   */
  decrypt(encryptedBase64: string): string | null {
    try {
      const packed = Buffer.from(encryptedBase64, 'base64');

      if (packed.length < this.ivLength + this.authTagLength) {
        this.logger.warn(
          'Encrypted data too short to contain iv + authTag + ciphertext',
        );
        return null;
      }

      const iv = packed.subarray(0, this.ivLength);
      const authTag = packed.subarray(
        this.ivLength,
        this.ivLength + this.authTagLength,
      );
      const ciphertext = packed.subarray(this.ivLength + this.authTagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv, {
        authTagLength: this.authTagLength,
      });
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      this.logger.warn('Decryption failed — key mismatch or corrupted data');
      return null;
    }
  }
}
