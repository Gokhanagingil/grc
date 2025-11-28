import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  RiskCatalogEntity,
  StandardMappingEntity,
} from '../../entities/app';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { RequirementEntity } from '../compliance/comp.entity';
import { RiskInstanceEntity } from '../../entities/app/risk-instance.entity';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StandardEntity,
      StandardClauseEntity,
      ControlLibraryEntity,
      RiskCatalogEntity,
      StandardMappingEntity,
      PolicyEntity,
      RequirementEntity,
      RiskInstanceEntity,
      EntityTypeEntity,
    ]),
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
