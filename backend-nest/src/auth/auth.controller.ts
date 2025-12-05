import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
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
  ) {
    // Extract client IP (handle proxies)
    const ip = this.getClientIp(req);
    return this.authService.login(loginDto, ip, correlationId);
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
