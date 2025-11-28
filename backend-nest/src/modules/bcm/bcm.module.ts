import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BCMService } from './bcm.service';
import { BCMController } from './bcm.controller';
import {
  BIAProcessEntity,
  BIAProcessDependencyEntity,
  BCPPlanEntity,
  BCPExerciseEntity,
  EntityEntity,
} from '../../entities/app';
import { MetricsModule } from '../metrics/metrics.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BIAProcessEntity,
      BIAProcessDependencyEntity,
      BCPPlanEntity,
      BCPExerciseEntity,
      EntityEntity,
    ]),
    MetricsModule,
    CalendarModule,
  ],
  providers: [BCMService],
  controllers: [BCMController],
  exports: [BCMService],
})
export class BCMModule {}
