import { Injectable, UnauthorizedException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../../entities/auth/user.entity';
import { MfaService } from './mfa.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private mfa: MfaService,
    private config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async validateUser(email: string, pass: string, mfaCode?: string) {
    const userEntity = await this.usersRepo.findOne({ where: { email } });
    if (!userEntity) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (userEntity.locked_until && userEntity.locked_until > new Date()) {
      throw new ForbiddenException({
        statusCode: 423,
        message: 'Account is locked. Please try again later.',
        lockedUntil: userEntity.locked_until,
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(pass, userEntity.password_hash);
    
    if (!passwordValid) {
      // Increment failed attempts
      userEntity.failed_attempts = (userEntity.failed_attempts || 0) + 1;
      
      // Lock account after 5 failed attempts
      if (userEntity.failed_attempts >= 5) {
        const lockDuration = 15 * 60 * 1000; // 15 minutes
        userEntity.locked_until = new Date(Date.now() + lockDuration);
      }
      
      await this.usersRepo.save(userEntity);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful password
    if (userEntity.failed_attempts > 0) {
      userEntity.failed_attempts = 0;
      userEntity.locked_until = undefined;
      await this.usersRepo.save(userEntity);
    }

    // Check MFA if enabled
    if (userEntity.mfa_enabled) {
      if (!mfaCode) {
        throw new HttpException(
          { statusCode: 401, message: 'MFA_REQUIRED', mfaRequired: true },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const mfaValid = await this.mfa.verifyToken(userEntity.id, mfaCode);
      if (!mfaValid) {
        throw new HttpException(
          { statusCode: 401, message: 'MFA_INVALID' },
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    return {
      id: userEntity.id,
      email: userEntity.email,
      passwordHash: userEntity.password_hash,
      displayName: userEntity.display_name,
      userId: userEntity.id,
      mfaEnabled: userEntity.mfa_enabled,
    };
  }

  async login(email: string, pass: string, mfaCode?: string) {
    const u = await this.validateUser(email, pass, mfaCode);
    
    const accessExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    
    const payload = { 
      sub: String(u.id), 
      email: u.email, 
      role: 'admin', // TODO: Get from user roles
    };
    
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessExpiresIn as any });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh' }, 
      { expiresIn: refreshExpiresIn as any },
    );
    
    return { 
      accessToken, 
      refreshToken,
      user: { 
        id: payload.sub, 
        email: u.email, 
        displayName: u.displayName ?? 'Admin', 
        role: payload.role,
        mfaEnabled: u.mfaEnabled,
      } 
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const accessExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '15m';
      const newAccessToken = await this.jwt.signAsync(
        { sub: payload.sub, email: payload.email, role: payload.role },
        { expiresIn: accessExpiresIn as any },
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
