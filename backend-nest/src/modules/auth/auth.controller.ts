import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './jwt.guard';

@Controller({ path: 'auth', version: '2' })
export class AuthController {
  constructor(
    private auth: AuthService,
    private mfa: MfaService,
  ) {}

  @Post('login')
  async login(@Body() dto: { email: string; password: string; mfaCode?: string }) {
    return this.auth.login(dto.email, dto.password, dto.mfaCode);
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

