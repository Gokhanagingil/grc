import { Body, Controller, Get, Headers, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

class LoginDto { 
  email!: string; 
  password!: string; 
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '2' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant context id' })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', schema: { example: { accessToken: 'jwt.token.here', user: { id: 'uuid', email: 'admin@local', displayName: 'Admin' } } } })
  @ApiResponse({ status: 400, description: 'Missing x-tenant-id header' })
  @ApiResponse({ status: 403, description: 'Invalid credentials' })
  login(@Headers('x-tenant-id') tenantId: string | undefined, @Body() dto: LoginDto) {
    return this.auth.login(tenantId, dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user from token' })
  @ApiResponse({ status: 200, description: 'User info' })
  async me(@Request() req: any) {
    // Token'dan user bilgisi gelecek (guard eklendikten sonra)
    return { message: 'Not implemented - guard needed' };
  }
}


