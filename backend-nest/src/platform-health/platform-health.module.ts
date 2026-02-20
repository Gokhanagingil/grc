import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformHealthRun } from './platform-health-run.entity';
import { PlatformHealthCheck } from './platform-health-check.entity';
import { PlatformHealthService } from './platform-health.service';
import { PlatformHealthController } from './platform-health.controller';
import { GuardsModule } from '../common/guards';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformHealthRun, PlatformHealthCheck]),
    GuardsModule,
  ],
  controllers: [PlatformHealthController],
  providers: [PlatformHealthService],
  exports: [PlatformHealthService],
})
export class PlatformHealthModule {}
