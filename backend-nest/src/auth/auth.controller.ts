import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * Auth Controller
 * 
 * Provides authentication endpoints.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Login endpoint
   * 
   * Accepts email and password, returns JWT token if valid.
   * 
   * For demo purposes, you can use:
   * - Email: admin@grc-platform.local
   * - Password: Admin123!
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
