import { Optional } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventNormalizedEntity } from '../../../entities/queue/event-normalized.entity';
import { EventRawEntity } from '../../../entities/queue/event-raw.entity';

interface NormalizeJobData {
  rawEventId: string;
  tenantId: string;
  source: string;
  payload: Record<string, any>;
}

@Processor('events.normalize', {
  concurrency: parseInt(
    process.env.QUEUE_EVENTS_NORMALIZE_CONCURRENCY || '32',
    10,
  ),
})
export class EventNormalizeProcessor extends WorkerHost {
  constructor(
    @InjectRepository(EventNormalizedEntity)
    private readonly normalizedRepo: Repository<EventNormalizedEntity>,
    @InjectRepository(EventRawEntity)
    private readonly rawRepo: Repository<EventRawEntity>,
    @Optional() @InjectQueue('events.incident')
    private readonly incidentQueue: Queue | null,
  ) {
    super();
  }

  async process(job: Job<NormalizeJobData>): Promise<void> {
    const { rawEventId, tenantId, source, payload } = job.data;

    // Map payload to normalized structure
    const severity = this.mapSeverity(source, payload);
    const category = payload.category || payload.type || 'unknown';
    const resource =
      payload.resource || payload.host || payload.instance || 'unknown';
    const message =
      payload.message || payload.description || JSON.stringify(payload);
    const eventTime = payload.timestamp
      ? new Date(payload.timestamp * 1000)
      : new Date();

    const normalized = this.normalizedRepo.create({
      tenant_id: tenantId,
      raw_id: rawEventId,
      event_time: eventTime,
      severity,
      category,
      resource,
      message,
      labels: payload.labels || {},
    });

    await this.normalizedRepo.save(normalized);

    // If severity >= major, push to incident queue (if available)
    if (['major', 'critical'].includes(severity) && this.incidentQueue) {
      try {
        await this.incidentQueue.add('process-incident', {
          normalizedEventId: normalized.id,
          tenantId,
          severity,
          category,
          resource,
          message,
        });
      } catch (error: any) {
        // Queue unavailable - log but don't throw
        console.warn(`Incident queue unavailable: ${error?.message || error}`);
      }
    }
  }

  private mapSeverity(
    source: string,
    payload: Record<string, any>,
  ): 'info' | 'warning' | 'minor' | 'major' | 'critical' {
    // Priority mapping based on source
    if (payload.severity) {
      const sev = payload.severity.toLowerCase();
      if (['critical', 'fatal', 'emergency'].includes(sev)) return 'critical';
      if (['error', 'major'].includes(sev)) return 'major';
      if (['warning', 'warn', 'minor'].includes(sev)) return 'warning';
    }

    // Default mapping
    if (source === 'prometheus') {
      return payload.value > 0.9 ? 'critical' : 'warning';
    }

    return 'info';
  }
}
