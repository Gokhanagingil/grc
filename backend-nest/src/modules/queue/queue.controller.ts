import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('events')
@Controller({ path: 'events', version: '2' })
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly config: ConfigService,
  ) {}

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest single event' })
  async ingest(
    @Body()
    body: { source: string; payload: Record<string, any>; tenantId?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-ingest-token') ingestToken?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    this.validateIngestAuth(ingestToken);
    this.checkQueueAvailable();

    const jobId = await this.queueService.publishRaw({
      source: body.source,
      payload: body.payload,
      tenantId: tenantId || body.tenantId,
      idempotencyKey,
    });

    return { accepted: true, jobId };
  }

  @Post('ingest/bulk')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest bulk events' })
  async ingestBulk(
    @Body()
    body: {
      source: string;
      items: Array<{ payload: Record<string, any>; tenantId?: string }>;
    },
    @Headers('x-ingest-token') ingestToken?: string,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    this.validateIngestAuth(ingestToken);
    this.checkQueueAvailable();

    const maxItems = parseInt(
      this.config.get<string>('INGEST_MAX_ITEMS') || '10000',
      10,
    );
    if (body.items.length > maxItems) {
      throw new BadRequestException(
        `Maximum ${maxItems} items allowed per bulk request`,
      );
    }

    const events = body.items.map((item) => ({
      source: body.source,
      payload: item.payload,
      tenantId: tenantId || item.tenantId,
    }));

    const jobIds = await this.queueService.publishRawBulk(events);

    return { accepted: true, jobIds, count: jobIds.length };
  }

  private validateIngestAuth(token?: string) {
    const requiredToken = this.config.get<string>('INGEST_TOKEN');
    if (requiredToken && token !== requiredToken) {
      throw new BadRequestException('Invalid ingest token');
    }
  }

  private checkQueueAvailable() {
    const ingestEnabled = this.config.get<string>('INGEST_ENABLED');
    if (ingestEnabled === 'false') {
      throw new ServiceUnavailableException('Event ingestion is disabled');
    }

    // Check Redis connection via QueueService
    if (!this.queueService.isRedisAvailable()) {
      throw new ServiceUnavailableException(
        'Redis queue unavailable. Retry after 60 seconds.',
      );
    }
  }
}
