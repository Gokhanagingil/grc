/**
 * @deprecated This module is legacy and should not be used in new code.
 * Use GovernanceModule instead, which provides tenant-safe policy operations.
 * 
 * This module has been hardened with tenant filtering for security,
 * but the long-term goal is to fully migrate to GovernanceModule.
 * 
 * @see GovernanceModule for the recommended implementation
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { PolicyService } from './policy.service';
import { PolicyController } from './policy.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([PolicyEntity]),
    ConfigModule,
  ],
  providers: [PolicyService],
  controllers: [PolicyController],
  exports: [PolicyService],
})
export class PolicyModule {}
