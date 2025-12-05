import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../../common/logger';

/**
 * Login attempt tracking data
 */
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

/**
 * Brute Force Protection Service
 *
 * Tracks failed login attempts and implements exponential backoff
 * to protect against brute force attacks.
 *
 * Features:
 * - Tracks attempts by IP address and username
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s max
 * - Lockout after 5 failed attempts
 * - Auto-reset after successful login
 * - Structured logging for security events
 */
@Injectable()
export class BruteForceService {
  private readonly logger = new StructuredLoggerService();
  private readonly attempts = new Map<string, LoginAttempt>();

  // Configuration
  private readonly MAX_ATTEMPTS = 5;
  private readonly BASE_DELAY_MS = 1000; // 1 second
  private readonly MAX_DELAY_MS = 60000; // 60 seconds
  private readonly LOCKOUT_DURATION_MS = 300000; // 5 minutes

  constructor() {
    this.logger.setContext('BruteForceService');

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Generate a unique key for tracking attempts
   */
  private getKey(ip: string, username: string): string {
    return `${ip}:${username}`;
  }

  /**
   * Check if a login attempt is allowed
   * Returns delay in milliseconds if rate limited, 0 if allowed
   */
  isAllowed(
    ip: string,
    username: string,
  ): { allowed: boolean; delayMs: number; reason?: string } {
    const key = this.getKey(ip, username);
    const attempt = this.attempts.get(key);

    if (!attempt) {
      return { allowed: true, delayMs: 0 };
    }

    const now = Date.now();

    // Check if locked out
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
      const remainingMs = attempt.lockedUntil - now;
      return {
        allowed: false,
        delayMs: remainingMs,
        reason: `Account temporarily locked. Try again in ${Math.ceil(remainingMs / 1000)} seconds.`,
      };
    }

    // Check if exponential backoff applies
    if (attempt.count > 0) {
      const delayMs = Math.min(
        this.BASE_DELAY_MS * Math.pow(2, attempt.count - 1),
        this.MAX_DELAY_MS,
      );
      const timeSinceLastAttempt = now - attempt.lastAttempt;

      if (timeSinceLastAttempt < delayMs) {
        const remainingMs = delayMs - timeSinceLastAttempt;
        return {
          allowed: false,
          delayMs: remainingMs,
          reason: `Too many attempts. Try again in ${Math.ceil(remainingMs / 1000)} seconds.`,
        };
      }
    }

    return { allowed: true, delayMs: 0 };
  }

  /**
   * Record a failed login attempt
   */
  recordFailure(
    ip: string,
    username: string,
    tenantId?: string,
    correlationId?: string,
  ): void {
    const key = this.getKey(ip, username);
    const now = Date.now();

    const attempt = this.attempts.get(key) || {
      count: 0,
      lastAttempt: now,
      lockedUntil: null,
    };

    attempt.count += 1;
    attempt.lastAttempt = now;

    // Lock out after MAX_ATTEMPTS
    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.lockedUntil = now + this.LOCKOUT_DURATION_MS;

      this.logger.warn('auth.bruteforce_detected', {
        correlationId,
        ip,
        username,
        tenantId,
        attemptCount: attempt.count,
        lockedUntilMs: attempt.lockedUntil,
        lockoutDurationSeconds: this.LOCKOUT_DURATION_MS / 1000,
      });
    } else {
      this.logger.log('auth.failed_attempt', {
        correlationId,
        ip,
        username,
        tenantId,
        attemptCount: attempt.count,
        maxAttempts: this.MAX_ATTEMPTS,
      });
    }

    this.attempts.set(key, attempt);
  }

  /**
   * Record a successful login (resets attempt counter)
   */
  recordSuccess(ip: string, username: string): void {
    const key = this.getKey(ip, username);
    this.attempts.delete(key);
  }

  /**
   * Get current attempt count for an IP/username combination
   */
  getAttemptCount(ip: string, username: string): number {
    const key = this.getKey(ip, username);
    const attempt = this.attempts.get(key);
    return attempt?.count || 0;
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const expiryMs = this.LOCKOUT_DURATION_MS * 2; // Keep entries for 2x lockout duration

    for (const [key, attempt] of this.attempts.entries()) {
      if (now - attempt.lastAttempt > expiryMs) {
        this.attempts.delete(key);
      }
    }
  }
}
