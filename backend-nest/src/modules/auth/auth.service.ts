import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as uuid from 'uuid';
import { UserEntity } from '../../entities/auth/user.entity';
import { RefreshTokenEntity } from '../../entities/auth/refresh-token.entity';
import { MfaService } from './mfa.service';
import { buildJwtTimes } from './jwt-timing.util';

// TTL sabitleri (saniye cinsinden)
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 dakika = 900 saniye
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 gün = 604800 saniye

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private mfa: MfaService,
    private config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokensRepo: Repository<RefreshTokenEntity>,
  ) {}

  async validateUser(
    email: string,
    pass: string,
    tenantId: string,
    mfaCode?: string,
  ) {
    const emailLower = email.toLowerCase();
    console.log(`[AuthService.validateUser] DEBUG: email=${emailLower}, tenantId=${tenantId}`);
    
    const userEntity = await this.usersRepo.findOne({
      where: { email: emailLower, tenant_id: tenantId },
    });
    
    if (!userEntity) {
      console.log(`[AuthService.validateUser] DEBUG: User not found - email=${emailLower}, tenantId=${tenantId}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    
    console.log(`[AuthService.validateUser] DEBUG: User found - id=${userEntity.id}, email=${userEntity.email}, is_active=${userEntity.is_active}, is_email_verified=${userEntity.is_email_verified}`);

    // Check if account is locked
    if (userEntity.locked_until && userEntity.locked_until > new Date()) {
      throw new ForbiddenException({
        statusCode: 423,
        message: 'Account is locked. Please try again later.',
        lockedUntil: userEntity.locked_until,
      });
    }

    // Verify password
    console.log(`[AuthService.validateUser] DEBUG: Comparing password...`);
    const passwordValid = await bcrypt.compare(pass, userEntity.password_hash);
    console.log(`[AuthService.validateUser] DEBUG: Password valid=${passwordValid}`);

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
      tenantId: userEntity.tenant_id,
    };
  }

  async login(
    email: string,
    pass: string,
    tenantId: string,
    mfaCode?: string,
  ) {
    const u = await this.validateUser(email, pass, tenantId, mfaCode);

    // Get roles from user entity (validateUser already fetched userEntity, but we need to get it again for roles)
    // TODO: Optimize - return roles from validateUser to avoid second query
    const userEntity = await this.usersRepo.findOne({ 
      where: { id: u.id },
      select: ['id', 'roles'],
    });
    const roles = userEntity?.roles && Array.isArray(userEntity.roles) && userEntity.roles.length > 0
      ? userEntity.roles
      : ['user']; // Default role if not set
    const jti = uuid.v4();
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000); // 7 days

    // Access token: manuel iat/exp hesapla
    const accessTimes = buildJwtTimes(ACCESS_TOKEN_TTL_SECONDS);
    const accessPayload = {
      sub: String(u.id),
      email: u.email,
      roles,
      tenantId: tenantId ?? u.tenantId,
      iat: accessTimes.iat,
      exp: accessTimes.exp,
    };

    // Access token sign - use manually set iat/exp from payload
    // JwtService will use our iat/exp values (it doesn't override if we explicitly set them)
    // JwtService'nin default secret'ını kullan (JwtModule config'inden)
    const accessToken = await this.jwt.signAsync(accessPayload, {
      // Do NOT use noTimestamp: true - it removes iat claim entirely
      // Instead, let jsonwebtoken use our manually set iat and exp from the payload
    });

    // Debug log - verify actual iat/exp/TTL
    try {
      const decoded: any = this.jwt.decode(accessToken, { json: true });
      const nowSec = Math.floor(Date.now() / 1000);
      const ttlSec = decoded?.exp && decoded?.iat ? (decoded.exp - decoded.iat) : null;
      const remainingSec = decoded?.exp ? decoded.exp - nowSec : null;

      console.log('[AuthService.login][DEBUG] Access token TTL:');
      console.log('[AuthService.login][DEBUG]   iat:', decoded?.iat);
      console.log('[AuthService.login][DEBUG]   exp:', decoded?.exp);
      console.log('[AuthService.login][DEBUG]   now (sec):', nowSec);
      console.log('[AuthService.login][DEBUG]   exp - iat (sec):', ttlSec);
      if (ttlSec !== null) {
        const ttlMin = Math.round((ttlSec / 60) * 100) / 100;
        console.log('[AuthService.login][DEBUG]   TTL (minutes):', ttlMin);
      }
      if (remainingSec !== null) {
        const remainingMin = Math.round((remainingSec / 60) * 100) / 100;
        console.log('[AuthService.login][DEBUG]   remaining TTL (sec):', remainingSec);
        console.log('[AuthService.login][DEBUG]   remaining TTL (minutes):', remainingMin);
      }
    } catch (e) {
      console.error('[AuthService.login][DEBUG] Failed to decode accessToken:', e);
    }
    
    // Refresh token: manuel iat/exp hesapla
    const refreshTimes = buildJwtTimes(REFRESH_TOKEN_TTL_SECONDS);
    
    // For refresh token, check if we need a separate secret
    const accessSecret =
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'dev-change-me';
    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ?? accessSecret;
    
    const refreshPayload = {
      sub: String(u.id),
      email: u.email,
      roles,
      tenantId: tenantId ?? u.tenantId,
      type: 'refresh',
      jti,
      iat: refreshTimes.iat,
      exp: refreshTimes.exp,
    };

    // Refresh token sign - use manually set iat/exp from payload
    // Secret'ı sadece refreshSecret farklıysa explicit olarak ver
    const refreshTokenOptions: any = {
      // Do NOT use noTimestamp: true - it removes iat claim entirely
      // Instead, let jsonwebtoken use our manually set iat and exp from the payload
    };
    if (refreshSecret !== accessSecret) {
      refreshTokenOptions.secret = refreshSecret;
    }
    const refreshToken = await this.jwt.signAsync(refreshPayload, refreshTokenOptions);

    // Save refresh token
    try {
      const refreshTokenEntity = this.refreshTokensRepo.create({
        id: uuid.v4(),
        user_id: u.id,
        jti,
        expires_at: expiresAt,
        revoked: false,
      });
      await this.refreshTokensRepo.save(refreshTokenEntity);
    } catch (error) {
      console.error('Failed to save refresh token:', error);
      // Continue without refresh token if save fails
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: accessPayload.sub,
        email: u.email,
        displayName: u.displayName ?? 'Admin',
        roles,
        mfaEnabled: u.mfaEnabled,
        tenantId: accessPayload.tenantId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const accessSecret =
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'dev-change-me';
    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ?? accessSecret;

    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
      if (payload.type !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Invalid token type');
      }
      const payloadRoles = Array.isArray(payload.roles)
        ? payload.roles
        : ['admin'];

      // Check if refresh token exists and is valid
      const tokenEntity = await this.refreshTokensRepo.findOne({
        where: { jti: payload.jti, revoked: false },
      });

      if (!tokenEntity || tokenEntity.expires_at < new Date()) {
        throw new UnauthorizedException('Refresh token expired or revoked');
      }

      // Rotation: revoke old token, create new one
      tokenEntity.revoked = true;
      tokenEntity.revoked_at = new Date();
      await this.refreshTokensRepo.save(tokenEntity);

      const newJti = uuid.v4();
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000); // 7 days

      const newRefreshTokenEntity = this.refreshTokensRepo.create({
        id: uuid.v4(),
        user_id: payload.sub,
        jti: newJti,
        expires_at: expiresAt,
        revoked: false,
      });
      await this.refreshTokensRepo.save(newRefreshTokenEntity);

      // New access token: manuel iat/exp hesapla
      const accessTimes = buildJwtTimes(ACCESS_TOKEN_TTL_SECONDS);
      const accessPayload = {
        sub: payload.sub,
        email: payload.email,
        roles: payloadRoles,
        tenantId: payload.tenantId,
        iat: accessTimes.iat,
        exp: accessTimes.exp,
      };

      // New access token sign - use manually set iat/exp from payload
      // JwtService will use our iat/exp values (it doesn't override if we explicitly set them)
      // JwtService'nin default secret'ını kullan (JwtModule config'inden)
      const newAccessToken = await this.jwt.signAsync(accessPayload, {
        // Do NOT use noTimestamp: true - it removes iat claim entirely
        // Instead, let jsonwebtoken use our manually set iat and exp from the payload
      });

      // Debug log - verify actual iat/exp/TTL for new access token
      try {
        const decoded: any = this.jwt.decode(newAccessToken, { json: true });
        const nowSec = Math.floor(Date.now() / 1000);
        const ttlSec = decoded?.exp && decoded?.iat ? (decoded.exp - decoded.iat) : null;
        const remainingSec = decoded?.exp ? decoded.exp - nowSec : null;

        console.log('[AuthService.refreshToken][DEBUG] New access token TTL:');
        console.log('[AuthService.refreshToken][DEBUG]   iat:', decoded?.iat);
        console.log('[AuthService.refreshToken][DEBUG]   exp:', decoded?.exp);
        console.log('[AuthService.refreshToken][DEBUG]   now (sec):', nowSec);
        console.log('[AuthService.refreshToken][DEBUG]   exp - iat (sec):', ttlSec);
        if (ttlSec !== null) {
          const ttlMin = Math.round((ttlSec / 60) * 100) / 100;
          console.log('[AuthService.refreshToken][DEBUG]   TTL (minutes):', ttlMin);
        }
        if (remainingSec !== null) {
          const remainingMin = Math.round((remainingSec / 60) * 100) / 100;
          console.log('[AuthService.refreshToken][DEBUG]   remaining TTL (sec):', remainingSec);
          console.log('[AuthService.refreshToken][DEBUG]   remaining TTL (minutes):', remainingMin);
        }
      } catch (e) {
        console.error('[AuthService.refreshToken][DEBUG] Failed to decode newAccessToken:', e);
      }

      // New refresh token: manuel iat/exp hesapla
      const refreshTimes = buildJwtTimes(REFRESH_TOKEN_TTL_SECONDS);
      const newRefreshPayload = {
        sub: payload.sub,
        email: payload.email,
        roles: payloadRoles,
        tenantId: payload.tenantId,
        type: 'refresh',
        jti: newJti,
        iat: refreshTimes.iat,
        exp: refreshTimes.exp,
      };

      // New refresh token sign - use manually set iat/exp from payload
      const newRefreshToken = await this.jwt.signAsync(newRefreshPayload, {
        // Do NOT use noTimestamp: true - it removes iat claim entirely
        // Instead, let jsonwebtoken use our manually set iat and exp from the payload
        secret: refreshSecret,
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'dev-change-me';
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
      if (payload.jti) {
        const tokenEntity = await this.refreshTokensRepo.findOne({
          where: { jti: payload.jti },
        });
        if (tokenEntity) {
          tokenEntity.revoked = true;
          tokenEntity.revoked_at = new Date();
          await this.refreshTokensRepo.save(tokenEntity);
        }
      }
    } catch (error) {
      // Ignore invalid tokens on logout
    }
  }
}
