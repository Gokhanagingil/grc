import {
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { TenantsService } from '../tenants/tenants.service';
import {
  UserLoggedInEvent,
  LoginFailedEvent,
  DomainEventNames,
} from '../events/domain-events';
import { BruteForceService } from './security/brute-force.service';
import { StructuredLoggerService } from '../common/logger';
import { MfaService } from './mfa/mfa.service';

/**
 * Login response type - either full access or MFA challenge
 */
export interface LoginResponse {
  accessToken?: string;
  user?: Partial<User>;
  mfaRequired?: boolean;
  mfaToken?: string;
}

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
  private readonly logger = new StructuredLoggerService();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TenantsService))
    private readonly tenantsService: TenantsService,
    private readonly bruteForceService: BruteForceService,
    @Inject(forwardRef(() => MfaService))
    private readonly mfaService: MfaService,
  ) {
    this.logger.setContext('AuthService');
  }

  /**
   * Get demo admin credentials from environment variables
   * These are only used for initial setup/demo purposes
   */
  private getDemoAdminCredentials(): { email: string; password: string } {
    return {
      email:
        this.configService.get<string>('DEMO_ADMIN_EMAIL') ||
        'admin@grc-platform.local',
      password:
        this.configService.get<string>('DEMO_ADMIN_PASSWORD') || 'changeme',
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
   * Login and return JWT token or MFA challenge
   *
   * @param loginDto - Login credentials
   * @param ip - Client IP address for brute force tracking
   * @param correlationId - Request correlation ID for logging
   */
  async login(
    loginDto: LoginDto,
    ip?: string,
    correlationId?: string,
  ): Promise<LoginResponse> {
    const clientIp = ip || 'unknown';

    // Check brute force protection
    const bruteForceCheck = this.bruteForceService.isAllowed(
      clientIp,
      loginDto.email,
    );
    if (!bruteForceCheck.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message:
            bruteForceCheck.reason ||
            'Too many login attempts. Please try again later.',
          retryAfterMs: bruteForceCheck.delayMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // First, ensure demo admin exists (for initial setup)
    await this.ensureDemoAdminExists();

    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      // Record failed attempt and emit event
      this.bruteForceService.recordFailure(
        clientIp,
        loginDto.email,
        undefined,
        correlationId,
      );
      this.eventEmitter.emit(
        DomainEventNames.LOGIN_FAILED,
        new LoginFailedEvent(
          loginDto.email,
          null,
          'Invalid credentials',
          clientIp,
        ),
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      // Record failed attempt for inactive accounts too
      this.bruteForceService.recordFailure(
        clientIp,
        loginDto.email,
        user.tenantId || undefined,
        correlationId,
      );
      this.eventEmitter.emit(
        DomainEventNames.LOGIN_FAILED,
        new LoginFailedEvent(
          loginDto.email,
          user.tenantId ?? null,
          'Account deactivated',
          clientIp,
        ),
      );
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if MFA is enabled for this user
    const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);

    if (mfaEnabled) {
      // Generate MFA challenge token (short-lived JWT for MFA verification)
      const mfaPayload = {
        sub: user.id,
        email: user.email,
        type: 'mfa_challenge',
      };
      const mfaToken = this.jwtService.sign(mfaPayload, { expiresIn: '5m' });

      this.logger.log('auth.mfa_challenge_issued', {
        userId: user.id,
        email: user.email,
      });

      return {
        mfaRequired: true,
        mfaToken,
      };
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to exclude passwordHash from response
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Complete MFA challenge and return JWT token
   *
   * @param mfaToken - MFA challenge token from initial login
   * @param code - TOTP or recovery code
   * @param ip - Client IP address for brute force tracking
   */
  async completeMfaChallenge(
    mfaToken: string,
    code: string,
    ip?: string,
  ): Promise<LoginResponse> {
    const clientIp = ip || 'unknown';

    // Verify MFA token
    let mfaPayload: { sub: string; email: string; type: string };
    try {
      mfaPayload = this.jwtService.verify(mfaToken);
      if (mfaPayload.type !== 'mfa_challenge') {
        throw new UnauthorizedException('Invalid MFA token');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    // Get user
    const user = await this.usersService.findById(mfaPayload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Verify MFA code
    const isValid = await this.mfaService.verifyMfaCode(
      user.id,
      code,
      user.tenantId,
    );

    if (!isValid) {
      this.bruteForceService.recordFailure(
        clientIp,
        user.email,
        user.tenantId || undefined,
      );
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Record successful login
    this.bruteForceService.recordSuccess(clientIp, user.email);

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to exclude passwordHash from response
    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Ensure demo admin user and tenant exist (for initial setup/demo purposes)
   *
   * PRODUCTION SAFETY: In production (NODE_ENV=production), this method is
   * a no-op unless ENABLE_DEMO_BOOTSTRAP=true is explicitly set.
   * This prevents accidental demo user creation on production databases.
   */
  private async ensureDemoAdminExists(): Promise<void> {
    // Production safety gate: require explicit opt-in for demo bootstrap
    const nodeEnv = this.configService.get<string>(
      'app.nodeEnv',
      'development',
    );
    if (nodeEnv === 'production') {
      const enableBootstrap = process.env.ENABLE_DEMO_BOOTSTRAP;
      if (enableBootstrap !== 'true') {
        return; // Silent no-op in production without explicit opt-in
      }
      this.logger.warn('demo.bootstrap.production_mode', {
        warning:
          'ENABLE_DEMO_BOOTSTRAP=true in production — disable after initial setup!',
      });
    }

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

      this.logger.warn('demo.admin.created', {
        email,
        tenantId: demoTenant.id,
        tenantName: demoTenant.name,
        warning: 'Change these credentials in production!',
      });
    } else if (!existingAdmin.tenantId) {
      // If admin exists but has no tenant, assign to demo tenant
      const demoTenant = await this.tenantsService.getOrCreateDemoTenant();
      await this.tenantsService.assignUserToTenant(
        existingAdmin.id,
        demoTenant.id,
      );
      this.logger.log('demo.admin.tenant.assigned', {
        userId: existingAdmin.id,
        tenantId: demoTenant.id,
        tenantName: demoTenant.name,
      });
    }
  }
}
