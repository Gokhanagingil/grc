import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../../common/logger';

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fd/,
  /^fe80:/,
  /^::$/,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

@Injectable()
export class SsrfGuardService {
  private readonly logger: StructuredLoggerService;

  constructor() {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('SsrfGuardService');
  }

  validateUrl(
    url: string,
    options?: { allowInsecure?: boolean },
  ): { valid: boolean; reason?: string } {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { valid: false, reason: 'Invalid URL format' };
    }

    if (!options?.allowInsecure && parsed.protocol !== 'https:') {
      return {
        valid: false,
        reason: 'Only HTTPS is allowed unless allowInsecure is explicitly set',
      };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, reason: 'Only HTTP/HTTPS protocols are allowed' };
    }

    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'URLs with credentials are not allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return {
        valid: false,
        reason: `Hostname "${hostname}" is blocked`,
      };
    }

    if (this.isIpLiteral(hostname)) {
      if (this.isPrivateIp(hostname)) {
        return {
          valid: false,
          reason: 'IP literals in private ranges are blocked',
        };
      }
    }

    if (parsed.port) {
      const port = parseInt(parsed.port, 10);
      if (port < 1 || port > 65535) {
        return { valid: false, reason: 'Invalid port number' };
      }
    }

    return { valid: true };
  }

  private isIpLiteral(hostname: string): boolean {
    return (
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      hostname.includes(':')
    );
  }

  private isPrivateIp(ip: string): boolean {
    const cleaned = ip.replace(/^\[/, '').replace(/\]$/, '');
    return PRIVATE_IP_RANGES.some((range) => range.test(cleaned));
  }
}
