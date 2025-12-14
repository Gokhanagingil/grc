import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ApiUsersController } from './api-users.controller';

/**
 * Users Module
 *
 * Provides user management functionality.
 * This is a skeleton implementation for the initial NestJS setup.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  controllers: [UsersController, ApiUsersController],
  exports: [UsersService],
})
export class UsersModule {}
