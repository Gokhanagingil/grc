import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { ItsmProblem } from '../problem/problem.entity';
import { ItsmKnownError } from '../known-error/known-error.entity';
import { ItsmMajorIncident } from '../major-incident/major-incident.entity';
import { ItsmPir } from '../pir/pir.entity';
import { ItsmPirAction } from '../pir/pir-action.entity';
import { ItsmKnowledgeCandidate } from '../pir/knowledge-candidate.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItsmProblem,
      ItsmKnownError,
      ItsmMajorIncident,
      ItsmPir,
      ItsmPirAction,
      ItsmKnowledgeCandidate,
    ]),
    AuthModule,
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
