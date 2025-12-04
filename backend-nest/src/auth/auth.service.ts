import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/**
 * Auth Service
 * 
 * Provides authentication functionality including login and JWT generation.
 * 
 * NOTE: For initial setup/demo purposes, this service includes a hardcoded
 * admin user that is created if no users exist in the database. This should
 * be removed or replaced with proper user seeding in production.
 */
@Injectable()
export class AuthService {
  // Hardcoded demo admin credentials for initial setup
  // WARNING: Remove or change these in production!
  private readonly DEMO_ADMIN_EMAIL = 'admin@grc-platform.local';
  private readonly DEMO_ADMIN_PASSWORD = 'Admin123!';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Login and return JWT token
   */
  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: Partial<User> }> {
    // First, ensure demo admin exists (for initial setup)
    await this.ensureDemoAdminExists();

    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Ensure demo admin user exists (for initial setup/demo purposes)
   * 
   * WARNING: This is for development/demo only. In production, use proper
   * user seeding or remove this method entirely.
   */
  private async ensureDemoAdminExists(): Promise<void> {
    const existingAdmin = await this.usersService.findByEmail(this.DEMO_ADMIN_EMAIL);
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(this.DEMO_ADMIN_PASSWORD, 10);
      
      await this.usersService.create({
        email: this.DEMO_ADMIN_EMAIL,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        firstName: 'Demo',
        lastName: 'Admin',
        isActive: true,
      });

      console.log('='.repeat(60));
      console.log('DEMO ADMIN USER CREATED');
      console.log('='.repeat(60));
      console.log(`Email: ${this.DEMO_ADMIN_EMAIL}`);
      console.log(`Password: ${this.DEMO_ADMIN_PASSWORD}`);
      console.log('WARNING: Change these credentials in production!');
      console.log('='.repeat(60));
    }
  }
}
