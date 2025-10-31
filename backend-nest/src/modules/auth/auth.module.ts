import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { UserEntity } from '../../entities/auth/user.entity';
import { RefreshTokenEntity } from '../../entities/auth/refresh-token.entity';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): JwtModuleOptions => {
        const secret = cfg.get<string>('JWT_SECRET') ?? 'dev-change-me';
        const expiresIn = cfg.get<string>('JWT_EXPIRES_IN') ?? '15m';
        const refreshExpiresIn = cfg.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
        return { 
          secret, 
          signOptions: { expiresIn: expiresIn as any },
        };
      },
    }),
  ],
  providers: [AuthService, MfaService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, MfaService, JwtModule],
})
export class AuthModule {}

