import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { PolicyEntity } from '../../entities/app/policy.entity';
// PolicyStandardEntity and StandardEntity are loaded lazily via DataSource to avoid injection errors if tables don't exist

@Module({
  imports: [TypeOrmModule.forFeature([PolicyEntity])],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
