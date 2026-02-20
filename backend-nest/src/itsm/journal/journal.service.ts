import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItsmJournal, JournalType } from './journal.entity';
import { CreateJournalDto } from './dto/create-journal.dto';
import { JournalFilterDto } from './dto/journal-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';
import { EventBusService } from '../../event-bus/event-bus.service';

const TABLE_MAP: Record<string, string> = {
  incidents: 'itsm_incidents',
  changes: 'itsm_changes',
  services: 'itsm_services',
  itsm_incidents: 'itsm_incidents',
  itsm_changes: 'itsm_changes',
  itsm_services: 'itsm_services',
};

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(ItsmJournal)
    private readonly repository: Repository<ItsmJournal>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly eventBusService?: EventBusService,
  ) {}

  resolveTableName(tableParam: string): string | null {
    return TABLE_MAP[tableParam] || null;
  }

  isAllowedTable(tableParam: string): boolean {
    return this.resolveTableName(tableParam) !== null;
  }

  async createJournalEntry(
    tenantId: string,
    userId: string,
    tableName: string,
    recordId: string,
    dto: CreateJournalDto,
  ): Promise<ItsmJournal> {
    const resolvedTableName = this.resolveTableName(tableName);
    if (!resolvedTableName) {
      throw new Error(`Table '${tableName}' is not supported`);
    }

    const entry = this.repository.create({
      tenantId,
      tableName: resolvedTableName,
      recordId,
      type: dto.type,
      message: dto.message,
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.repository.save(entry);

    await this.auditService?.recordCreate(
      'ItsmJournal',
      saved,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('journal.created', {
      journalId: saved.id,
      tenantId,
      userId,
      tableName: resolvedTableName,
      recordId,
      type: dto.type,
    });

    if (this.eventBusService) {
      await this.eventBusService.emit({
        tenantId,
        source: 'itsm.journal',
        eventName: 'journal.created',
        tableName: resolvedTableName,
        recordId,
        payload: {
          journalId: saved.id,
          type: dto.type,
          message:
            dto.message.length > 200
              ? dto.message.substring(0, 200) + '...'
              : dto.message,
        },
        actorId: userId,
      });
    }

    return saved;
  }

  async findByRecord(
    tenantId: string,
    tableName: string,
    recordId: string,
    filterDto: JournalFilterDto,
  ): Promise<PaginatedResponse<ItsmJournal>> {
    const {
      page = 1,
      pageSize = 20,
      type,
      sortOrder = 'DESC',
    } = filterDto;

    const resolvedTableName = this.resolveTableName(tableName);
    if (!resolvedTableName) {
      return createPaginatedResponse([], 0, page, pageSize);
    }

    const qb = this.repository.createQueryBuilder('journal');

    qb.where('journal.tenantId = :tenantId', { tenantId });
    qb.andWhere('journal.tableName = :tableName', { tableName: resolvedTableName });
    qb.andWhere('journal.recordId = :recordId', { recordId });
    qb.andWhere('journal.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      qb.andWhere('journal.type = :type', { type });
    }

    const total = await qb.getCount();

    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('journal.createdAt', validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async countByRecord(
    tenantId: string,
    tableName: string,
    recordId: string,
    type?: JournalType,
  ): Promise<number> {
    const resolvedTableName = this.resolveTableName(tableName);
    if (!resolvedTableName) {
      return 0;
    }

    const qb = this.repository.createQueryBuilder('journal');
    qb.where('journal.tenantId = :tenantId', { tenantId });
    qb.andWhere('journal.tableName = :tableName', { tableName: resolvedTableName });
    qb.andWhere('journal.recordId = :recordId', { recordId });
    qb.andWhere('journal.isDeleted = :isDeleted', { isDeleted: false });

    if (type) {
      qb.andWhere('journal.type = :type', { type });
    }

    return qb.getCount();
  }
}
