import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface EventRaw {
  source: string;
  payload: Record<string, any>;
  tenantId?: string;
  idempotencyKey?: string;
  ingestMeta?: Record<string, any>;
}

@Injectable()
export class QueueService {
  constructor(@Optional() @InjectQueue('events.raw') private readonly rawQueue: Queue | null) {}

  isRedisAvailable(): boolean {
    if (!this.rawQueue) {
      return false;
    }
    try {
      // Check if queue client is connected
      const client = (this.rawQueue as any).client;
      if (!client) {
        return false;
      }
      // Try to ping Redis (non-blocking check)
      return client.status === 'ready' || client.status === 'connect';
    } catch {
      return false;
    }
  }

  async publishRaw(event: EventRaw): Promise<string> {
    if (!this.rawQueue) {
      // No-op: Queue disabled, return placeholder
      return 'QUEUE_DISABLED';
    }
    try {
      const job = await this.rawQueue.add('process-raw', event, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 500,
        },
      });
      return job.id!;
    } catch (error: any) {
      // Redis/Queue unavailable - log and return no-op result
      console.warn(`Queue publishRaw failed: ${error?.message || error}`);
      return 'QUEUE_DISABLED';
    }
  }

  async publishRawBulk(events: EventRaw[]): Promise<string[]> {
    if (!this.rawQueue) {
      // No-op: Queue disabled, return placeholder array
      return events.map(() => 'QUEUE_DISABLED');
    }
    try {
      const jobs = events.map((event) => ({
        name: 'process-raw',
        data: event,
        opts: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 500,
          },
        },
      }));

      const added = await this.rawQueue.addBulk(jobs);
      return added.map((j) => j.id!);
    } catch (error: any) {
      // Redis/Queue unavailable - log and return no-op result
      console.warn(`Queue publishRawBulk failed: ${error?.message || error}`);
      return events.map(() => 'QUEUE_DISABLED');
    }
  }
}
