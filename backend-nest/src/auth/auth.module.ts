import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PermissionService } from './permissions/permission.service';
import { PermissionsGuard } from './permissions/permissions.guard';
import { BruteForceService } from './security/brute-force.service';

/**
 * Parse expiresIn string (e.g., '24h', '7d', '30m') to seconds
 */
function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Default to 24 hours if invalid format
    return 86400;
  }
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 86400;
  }
}

/**
 * Auth Module
 * 
 * Provides authentication functionality including JWT-based auth.
 */
@Module({
  imports: [
    UsersModule,
    forwardRef(() => TenantsModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }
        // Parse expiresIn from config (e.g., '24h', '7d') or default to 24 hours in seconds
        const expiresInConfig = configService.get<string>('jwt.expiresIn') || '24h';
        // Convert string like '24h' to seconds for type safety
        const expiresInSeconds = parseExpiresIn(expiresInConfig);
        return {
          secret,
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, PermissionService, PermissionsGuard, BruteForceService],
  controllers: [AuthController],
  exports: [AuthService, PermissionService, PermissionsGuard, BruteForceService],
})
export class AuthModule {}
