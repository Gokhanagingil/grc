import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { EventRawProcessor } from './workers/event.raw.processor';
import { EventNormalizeProcessor } from './workers/event.normalize.processor';
import { EventIncidentProcessor } from './workers/event.incident.processor';
import { EventRawEntity } from '../../entities/queue/event-raw.entity';
import { EventNormalizedEntity } from '../../entities/queue/event-normalized.entity';
import { RulesModule } from '../rules/rules.module';

// Check if Redis is available (optional)
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const safeMode = process.env.SAFE_MODE === 'true';
const hasRedis = !safeMode && !!(redisUrl || redisHost);

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EventRawEntity, EventNormalizedEntity]),
    // Only register BullMQ if Redis is configured
    ...(hasRedis
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => {
              const redisUrl = cfg.get<string>('REDIS_URL');
              let connection: any;
              
              if (redisUrl) {
                const url = new URL(redisUrl);
                connection = {
                  host: url.hostname,
                  port: parseInt(url.port || '6379', 10),
                  password: url.password || undefined,
                };
              } else {
                connection = {
                  host: cfg.get<string>('REDIS_HOST') || 'localhost',
                  port: cfg.get<number>('REDIS_PORT') || 6379,
                  password: cfg.get<string>('REDIS_PASSWORD') || undefined,
                };
              }

              // BullMQ connection options - non-fatal, graceful degradation
              return {
                connection: {
                  ...connection,
                  maxRetriesPerRequest: null, // Disable fatal retries in BullMQ/ioredis
                  enableReadyCheck: false, // Disable ready check
                  lazyConnect: true, // Defer connection
                  retryStrategy: (times: number) => Math.min(times * 50, 2000),
                  reconnectOnError: () => false, // Don't auto-reconnect on error
                },
              };
            },
          }),
          BullModule.registerQueue(
            { name: 'events.raw' },
            { name: 'events.normalize' },
            { name: 'events.incident' },
            { name: 'events.dlq' },
          ),
        ]
      : []),
    RulesModule,
  ],
  controllers: [QueueController],
  providers: [
    QueueService,
    // Only register processors if Redis is available
    ...(hasRedis
      ? [EventRawProcessor, EventNormalizeProcessor, EventIncidentProcessor]
      : []),
  ],
  exports: hasRedis ? [QueueService, BullModule] : [QueueService],
})
export class QueueModule {}
