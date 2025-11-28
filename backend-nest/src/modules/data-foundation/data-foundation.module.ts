import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StandardEntity,
  StandardClauseEntity,
  StandardMappingEntity,
  ControlLibraryEntity,
  ControlToClauseEntity,
  ControlToPolicyEntity,
  ControlToCapEntity,
  RiskCatalogEntity,
  RiskCategoryEntity,
  PolicyEntity,
  RiskToControlEntity,
  RiskToPolicyEntity,
  RiskToRequirementEntity,
  RiskCatalogAttachmentEntity,
  RiskInstanceAttachmentEntity,
  AuditFindingEntity,
  CorrectiveActionEntity,
} from '../../entities/app';
import { DataFoundationService } from './data-foundation.service';
import { DataFoundationController } from './data-foundation.controller';
import { RiskCatalogController } from '../risk/risk-catalog.controller';
import { RiskInstanceModule } from '../risk-instance/risk-instance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StandardEntity,
      StandardClauseEntity,
      StandardMappingEntity,
      ControlLibraryEntity,
      ControlToClauseEntity,
      ControlToPolicyEntity,
      ControlToCapEntity,
      RiskCatalogEntity,
      RiskCategoryEntity,
      PolicyEntity,
      RiskToControlEntity,
      RiskToPolicyEntity,
      RiskToRequirementEntity,
      RiskCatalogAttachmentEntity,
      RiskInstanceAttachmentEntity,
      AuditFindingEntity,
      CorrectiveActionEntity,
    ]),
    forwardRef(() => RiskInstanceModule),
  ],
  providers: [DataFoundationService],
  controllers: [DataFoundationController, RiskCatalogController],
  exports: [DataFoundationService],
})
export class DataFoundationModule {}
