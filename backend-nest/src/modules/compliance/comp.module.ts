import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequirementEntity } from './comp.entity';
import { ComplianceService } from './comp.service';
import { ComplianceController } from './comp.controller';
import { RegulationEntity } from '../../entities/app/regulation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RequirementEntity, RegulationEntity])],
  providers: [ComplianceService],
  controllers: [ComplianceController],
})
export class ComplianceModule {}
