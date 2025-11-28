import { Optional } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { EventRawEntity } from '../../../entities/queue/event-raw.entity';
import { EventRaw } from '../queue.service';

@Processor('events.raw', {
  concurrency: parseInt(process.env.QUEUE_EVENTS_RAW_CONCURRENCY || '64', 10),
})
export class EventRawProcessor extends WorkerHost {
  constructor(
    @InjectRepository(EventRawEntity)
    private readonly eventRawRepo: Repository<EventRawEntity>,
    @Optional() @InjectQueue('events.normalize')
    private readonly normalizeQueue: Queue | null,
  ) {
    super();
  }

  async process(job: Job<EventRaw>): Promise<void> {
    const { source, payload, tenantId, idempotencyKey, ingestMeta } = job.data;

    // Generate fingerprint
    const fingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    // Check idempotency
    if (idempotencyKey && tenantId) {
      const existing = await this.eventRawRepo.findOne({
        where: { idempotency_key: idempotencyKey, tenant_id: tenantId },
      });
      if (existing) {
        // Duplicate - drop silently
        return;
      }
    }

    // Batch insert (simplified - in production, use batch insert)
    const eventRaw = this.eventRawRepo.create({
      tenant_id: tenantId || '00000000-0000-0000-0000-000000000000',
      source,
      payload,
      fingerprint,
      idempotency_key: idempotencyKey,
      ingest_meta: ingestMeta,
      received_at: new Date(),
    });

    await this.eventRawRepo.save(eventRaw);

    // Push to normalize queue (if available)
    if (this.normalizeQueue) {
      try {
        await this.normalizeQueue.add('process-normalize', {
          rawEventId: eventRaw.id,
          tenantId: eventRaw.tenant_id,
          source,
          payload,
        });
      } catch (error: any) {
        // Queue unavailable - log but don't throw
        console.warn(`Normalize queue unavailable: ${error?.message || error}`);
      }
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    // Optional: logging
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.error(`Job ${job.id} failed:`, error);
  }
}
