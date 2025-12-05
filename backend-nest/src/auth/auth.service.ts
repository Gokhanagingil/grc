import { Injectable, UnauthorizedException, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { TenantsService } from '../tenants/tenants.service';
import { UserLoggedInEvent, DomainEventNames } from '../events/domain-events';
import { BruteForceService } from './security/brute-force.service';

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
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TenantsService))
    private readonly tenantsService: TenantsService,
    private readonly bruteForceService: BruteForceService,
  ) {}

  /**
   * Get demo admin credentials from environment variables
   * These are only used for initial setup/demo purposes
   */
  private getDemoAdminCredentials(): { email: string; password: string } {
    return {
      email: this.configService.get<string>('DEMO_ADMIN_EMAIL') || 'admin@grc-platform.local',
      password: this.configService.get<string>('DEMO_ADMIN_PASSWORD') || 'changeme',
    };
  }

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
   * 
   * @param loginDto - Login credentials
   * @param ip - Client IP address for brute force tracking
   * @param correlationId - Request correlation ID for logging
   */
  async login(
    loginDto: LoginDto,
    ip?: string,
    correlationId?: string,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    const clientIp = ip || 'unknown';

    // Check brute force protection
    const bruteForceCheck = this.bruteForceService.isAllowed(clientIp, loginDto.email);
    if (!bruteForceCheck.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: bruteForceCheck.reason || 'Too many login attempts. Please try again later.',
          retryAfterMs: bruteForceCheck.delayMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // First, ensure demo admin exists (for initial setup)
    await this.ensureDemoAdminExists();

    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      // Record failed attempt
      this.bruteForceService.recordFailure(clientIp, loginDto.email, undefined, correlationId);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      // Record failed attempt for inactive accounts too
      this.bruteForceService.recordFailure(clientIp, loginDto.email, user.tenantId || undefined, correlationId);
      throw new UnauthorizedException('Account is deactivated');
    }

    // Record successful login (resets brute force counter)
    this.bruteForceService.recordSuccess(clientIp, loginDto.email);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Emit login event for audit logging
    this.eventEmitter.emit(
      DomainEventNames.USER_LOGGED_IN,
      new UserLoggedInEvent(user.id, user.email, user.tenantId || null),
    );

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Ensure demo admin user and tenant exist (for initial setup/demo purposes)
   * 
   * WARNING: This is for development/demo only. In production, use proper
   * user seeding or remove this method entirely.
   */
  private async ensureDemoAdminExists(): Promise<void> {
    const { email, password } = this.getDemoAdminCredentials();
    const existingAdmin = await this.usersService.findByEmail(email);
    
    if (!existingAdmin) {
      // First, create or get the demo tenant
      const demoTenant = await this.tenantsService.getOrCreateDemoTenant();
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await this.usersService.create({
        email,
        passwordHash: hashedPassword,
        role: UserRole.ADMIN,
        firstName: 'Demo',
        lastName: 'Admin',
        isActive: true,
        tenantId: demoTenant.id,
      });

      console.log('='.repeat(60));
      console.log('DEMO ADMIN USER CREATED');
      console.log('='.repeat(60));
      console.log(`Email: ${email}`);
      console.log(`Tenant: ${demoTenant.name} (${demoTenant.id})`);
      console.log('WARNING: Change these credentials in production!');
      console.log('='.repeat(60));
    } else if (!existingAdmin.tenantId) {
      // If admin exists but has no tenant, assign to demo tenant
      const demoTenant = await this.tenantsService.getOrCreateDemoTenant();
      await this.tenantsService.assignUserToTenant(existingAdmin.id, demoTenant.id);
      console.log(`Assigned existing admin to tenant: ${demoTenant.name}`);
    }
  }
}
