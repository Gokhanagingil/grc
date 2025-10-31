import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserEntity } from '../entities/auth/user.entity';
import { TenantEntity } from '../entities/tenant/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, TenantEntity])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}


