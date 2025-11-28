import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HealthController, RootHealthController } from './health.controller';
import {
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  RiskCatalogEntity,
  StandardMappingEntity,
} from '../entities/app';

// Check if Redis is available (optional)
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const safeMode = process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1';
const hasRedis = !safeMode && !!(redisUrl || redisHost);

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StandardEntity,
      StandardClauseEntity,
      ControlLibraryEntity,
      RiskCatalogEntity,
      StandardMappingEntity,
    ]),
    // Only register Bull queues if Redis is configured
    ...(hasRedis
      ? [
          BullModule.registerQueue(
            { name: 'events.raw' },
            { name: 'events.dlq' },
          ),
        ]
      : []),
  ],
  controllers: [RootHealthController, HealthController],
  providers: [], // DataSource is injected via TypeOrmModule
})
export class HealthModule {}
