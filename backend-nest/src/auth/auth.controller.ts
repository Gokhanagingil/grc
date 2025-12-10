import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * Auth Controller
 *
 * Provides authentication endpoints with rate limiting and brute force protection.
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('AuthLogin');

  constructor(private readonly authService: AuthService) {}

  /**
   * Login endpoint
   *
   * Accepts email and password, returns JWT token if valid.
   * Rate limited to 10 requests per minute per IP.
   * Brute force protection: exponential backoff after failed attempts.
   *
   * For demo purposes, you can use:
   * - Email: admin@grc-platform.local
   * - Password: TestPassword123!
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    // Extract client IP (handle proxies)
    const ip = this.getClientIp(req);
    const timestamp = new Date().toISOString();

    // Log login attempt (safe: no password logged)
    this.logger.log({
      context: 'AuthLogin',
      timestamp,
      path: req.url,
      method: req.method,
      email: loginDto.email,
      tenantIdHeader: tenantId || 'none',
      origin: req.headers.origin || 'none',
      ip,
      status: 'ATTEMPT',
    });

    try {
      const result = await this.authService.login(loginDto, ip, correlationId);

      // Log successful login
      this.logger.log({
        context: 'AuthLogin',
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        email: loginDto.email,
        status: 'SUCCESS',
      });

      return result;
    } catch (error) {
      // Log failed login (safe: no password logged)
      this.logger.warn({
        context: 'AuthLogin',
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
        email: loginDto.email,
        status: 'FAILURE',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Extract client IP address from request
   * Handles X-Forwarded-For header for proxied requests
   */
  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can be a comma-separated list, take the first IP
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
