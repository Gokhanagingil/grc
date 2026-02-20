import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { BruteForceService } from './security/brute-force.service';
import { MfaService } from './mfa/mfa.service';
import { User, UserRole } from '../users/user.entity';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let bruteForceService: jest.Mocked<BruteForceService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser: Partial<User> = {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'admin@grc-platform.local',
    passwordHash: '$2b$10$hashedpassword',
    role: UserRole.ADMIN,
    firstName: 'Demo',
    lastName: 'Admin',
    isActive: true,
    tenantId: '00000000-0000-0000-0000-000000000001',
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          DEMO_ADMIN_EMAIL: 'admin@grc-platform.local',
          DEMO_ADMIN_PASSWORD: 'TestPassword123!',
        };
        return config[key];
      }),
    };

    const mockTenantsService = {
      getOrCreateDemoTenant: jest.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Organization',
      }),
      assignUserToTenant: jest.fn(),
    };

    const mockBruteForceService = {
      isAllowed: jest.fn().mockReturnValue({ allowed: true }),
      recordFailure: jest.fn(),
      recordSuccess: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockMfaService = {
      isMfaEnabled: jest.fn().mockResolvedValue(false),
      verifyMfaCode: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: BruteForceService, useValue: mockBruteForceService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: MfaService, useValue: mockMfaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    bruteForceService = module.get(BruteForceService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    // Clear all mocks between tests
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user when email and password are correct', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.validateUser(
        'admin@grc-platform.local',
        'TestPassword123!',
      );

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'admin@grc-platform.local',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'TestPassword123!',
        mockUser.passwordHash,
      );
    });

    it('should return null when email is not found', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.validateUser(
        'nonexistent@example.com',
        'password',
      );

      // Assert
      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is incorrect', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await service.validateUser(
        'admin@grc-platform.local',
        'wrongpassword',
      );

      // Assert
      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        mockUser.passwordHash,
      );
    });
  });

  describe('login', () => {
    it('should return accessToken and user on successful login', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.login(
        { email: 'admin@grc-platform.local', password: 'TestPassword123!' },
        '127.0.0.1',
      );

      // Assert
      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', 'admin@grc-platform.local');
      expect(jwtService.sign).toHaveBeenCalled();
      expect(bruteForceService.recordSuccess).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.login(
          { email: 'admin@grc-platform.local', password: 'wrongpassword' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(bruteForceService.recordFailure).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.login(
          { email: 'nonexistent@example.com', password: 'password' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(bruteForceService.recordFailure).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user account is deactivated', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByEmail.mockResolvedValue(inactiveUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.login(
          { email: 'admin@grc-platform.local', password: 'TestPassword123!' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(bruteForceService.recordFailure).toHaveBeenCalled();
    });
  });
});
