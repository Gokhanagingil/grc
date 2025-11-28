import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskInstanceController } from './risk-instance.controller';
import { RiskInstanceService } from './risk-instance.service';
import { AutoGenerationService } from './auto-generation.service';
import { RiskInstanceEntity } from '../../entities/app/risk-instance.entity';
import { RiskCatalogEntity } from '../../entities/app/risk-catalog.entity';
import { ControlLibraryEntity } from '../../entities/app/control-library.entity';
import { EntityEntity } from '../../entities/app/entity.entity';
import { RiskScoringModule } from '../risk-scoring/risk-scoring.module';
// RealtimeModule removed - optional dependency handled via @Optional() in service

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiskInstanceEntity,
      RiskCatalogEntity,
      ControlLibraryEntity,
      EntityEntity,
    ]),
    RiskScoringModule,
    // RealtimeModule removed - optional dependency handled via @Optional() in service
  ],
  controllers: [RiskInstanceController],
  providers: [RiskInstanceService, AutoGenerationService],
  exports: [RiskInstanceService, AutoGenerationService],
})
export class RiskInstanceModule {}
