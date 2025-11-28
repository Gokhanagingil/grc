import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserEntity } from '../../entities/auth/user.entity';
import { CacheModule } from '../../common/services/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CacheModule, // Explicit import required even though @Global() - ensures proper initialization order
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
