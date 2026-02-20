import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SysEvent, SysEventStatus } from './entities/sys-event.entity';
import { StructuredLoggerService } from '../common/logger';

export interface EmitEventOptions {
  tenantId: string;
  source: string;
  eventName: string;
  tableName?: string;
  recordId?: string;
  payload?: Record<string, unknown>;
  actorId?: string;
}

@Injectable()
export class EventBusService {
  private readonly logger: StructuredLoggerService;

  constructor(
    @InjectRepository(SysEvent)
    private readonly sysEventRepository: Repository<SysEvent>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new StructuredLoggerService();
    this.logger.setContext('EventBusService');
  }

  async emit(options: EmitEventOptions): Promise<SysEvent> {
    const event = this.sysEventRepository.create({
      tenantId: options.tenantId,
      source: options.source,
      eventName: options.eventName,
      tableName: options.tableName || null,
      recordId: options.recordId || null,
      payloadJson: options.payload || {},
      actorId: options.actorId || null,
      status: SysEventStatus.PENDING,
    });

    const saved = await this.sysEventRepository.save(event);

    this.logger.log('Event emitted', {
      eventId: saved.id,
      eventName: options.eventName,
      tenantId: options.tenantId,
      source: options.source,
    });

    this.eventEmitter.emit('sys.event', saved);
    this.eventEmitter.emit(`sys.event.${options.eventName}`, saved);

    return saved;
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.sysEventRepository.update(eventId, {
      status: SysEventStatus.PROCESSED,
    });
  }

  async markFailed(eventId: string): Promise<void> {
    await this.sysEventRepository.update(eventId, {
      status: SysEventStatus.FAILED,
    });
  }

  async findByTenant(
    tenantId: string,
    filters?: {
      eventName?: string;
      tableName?: string;
      status?: SysEventStatus;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: SysEvent[]; total: number }> {
    const page = filters?.page || 1;
    const pageSize = Math.min(filters?.pageSize || 50, 100);

    const qb = this.sysEventRepository
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId });

    if (filters?.eventName) {
      qb.andWhere('e.eventName = :eventName', {
        eventName: filters.eventName,
      });
    }

    if (filters?.tableName) {
      qb.andWhere('e.tableName = :tableName', {
        tableName: filters.tableName,
      });
    }

    if (filters?.status) {
      qb.andWhere('e.status = :status', { status: filters.status });
    }

    if (filters?.from) {
      qb.andWhere('e.createdAt >= :from', { from: filters.from });
    }

    if (filters?.to) {
      qb.andWhere('e.createdAt <= :to', { to: filters.to });
    }

    const total = await qb.getCount();

    qb.orderBy('e.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return { items, total };
  }

  async findOneByTenant(
    tenantId: string,
    eventId: string,
  ): Promise<SysEvent | null> {
    return this.sysEventRepository.findOne({
      where: { id: eventId, tenantId },
    });
  }

  async getDistinctEventNames(tenantId: string): Promise<string[]> {
    const results = await this.sysEventRepository
      .createQueryBuilder('e')
      .select('DISTINCT e.eventName', 'eventName')
      .where('e.tenantId = :tenantId', { tenantId })
      .orderBy('e.eventName', 'ASC')
      .getRawMany<{ eventName: string }>();

    return results.map((r) => r.eventName);
  }

  async getDistinctTableNames(tenantId: string): Promise<string[]> {
    const results = await this.sysEventRepository
      .createQueryBuilder('e')
      .select('DISTINCT e.tableName', 'tableName')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.tableName IS NOT NULL')
      .orderBy('e.tableName', 'ASC')
      .getRawMany<{ tableName: string }>();

    return results.map((r) => r.tableName);
  }
}
