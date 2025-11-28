import { Body, Controller, Get, Post, Req, UseGuards, Headers, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './jwt.guard';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';

@Controller({ path: 'auth', version: '2' })
export class AuthController {
  constructor(
    private auth: AuthService,
    private mfa: MfaService,
    private config: ConfigService,
  ) {}

  // TODO: remove after fix
  @Get('ping')
  getPing() {
    return { ok: true, mod: 'auth', ts: new Date().toISOString() };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Headers('x-tenant-id') tenantHeader?: string,
  ) {
    const defaultTenant = this.config
      .get<string>('DEFAULT_TENANT_ID')
      ?.trim();
    const headerTenant = tenantHeader?.trim();

    if (headerTenant && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerTenant)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid tenant identifier',
        detail: 'x-tenant-id must be a valid UUID.',
      });
    }

    const effectiveTenant = headerTenant || defaultTenant || null;

    if (!effectiveTenant) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tenant context required',
        detail:
          'Provide an x-tenant-id header or set DEFAULT_TENANT_ID in the environment.',
      });
    }

    return this.auth.login(dto.email, dto.password, effectiveTenant, dto.mfaCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  async setupMfa(@Req() req: any) {
    const userId = req.user.userId || req.user.sub;
    return this.mfa.generateSecret(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify')
  async verifyMfa(@Req() req: any, @Body() dto: { token: string }) {
    const userId = req.user.userId || req.user.sub;
    const isValid = await this.mfa.verifyToken(userId, dto.token);
    if (isValid) {
      await this.mfa.enableMfa(userId);
      return { success: true, message: 'MFA enabled' };
    }
    throw new Error('Invalid MFA token');
  }

  @Post('refresh')
  async refresh(@Body() dto: { refreshToken: string }) {
    return this.auth.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: { refreshToken: string }) {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }
}
