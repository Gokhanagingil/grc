import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequirementEntity } from './comp.entity';
import { ComplianceService } from './comp.service';
import { ComplianceController } from './comp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RequirementEntity])],
  providers: [ComplianceService],
  controllers: [ComplianceController],
})
export class ComplianceModule {}


