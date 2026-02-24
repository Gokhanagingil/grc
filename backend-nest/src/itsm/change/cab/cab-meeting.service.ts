import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CabMeeting, CabMeetingStatus } from './cab-meeting.entity';
import { CabAgendaItem } from './cab-agenda-item.entity';
import {
  CabMeetingFilterDto,
  CAB_MEETING_SORTABLE_FIELDS,
} from './dto/cab-meeting-filter.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';

@Injectable()
export class CabMeetingService {
  constructor(
    @InjectRepository(CabMeeting)
    private readonly meetingRepo: Repository<CabMeeting>,
    @InjectRepository(CabAgendaItem)
    private readonly agendaRepo: Repository<CabAgendaItem>,
  ) {}

  // ──────────────────────────────────────────────
  // Meeting CRUD
  // ──────────────────────────────────────────────

  async findAll(
    tenantId: string,
    filterDto: CabMeetingFilterDto,
  ): Promise<PaginatedResponse<CabMeeting>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'meetingAt',
      sortOrder = 'DESC',
      status,
      dateFrom,
      dateTo,
      search,
      q,
    } = filterDto;

    const qb = this.meetingRepo.createQueryBuilder('m');
    qb.where('m.tenantId = :tenantId', { tenantId });
    qb.andWhere('m.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('m.status = :status', { status });
    }
    if (dateFrom) {
      qb.andWhere('m.meetingAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('m.meetingAt <= :dateTo', { dateTo });
    }

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('(m.title ILIKE :search OR m.code ILIKE :search)', {
        search: `%${searchTerm}%`,
      });
    }

    qb.leftJoinAndSelect('m.chairperson', 'chairperson');

    const total = await qb.getCount();

    const validSortBy = CAB_MEETING_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'meetingAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`m.${validSortBy}`, validSortOrder);

    qb.skip((Number(page) - 1) * Number(pageSize));
    qb.take(Number(pageSize));

    const items = await qb.getMany();
    return createPaginatedResponse(
      items,
      total,
      Number(page),
      Number(pageSize),
    );
  }

  async findById(tenantId: string, id: string): Promise<CabMeeting | null> {
    return this.meetingRepo.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['chairperson'],
    });
  }

  async create(
    tenantId: string,
    userId: string,
    data: Partial<CabMeeting>,
  ): Promise<CabMeeting> {
    const code = await this.generateCode(tenantId);
    const entity = this.meetingRepo.create({
      ...data,
      tenantId,
      code,
      status: data.status || CabMeetingStatus.DRAFT,
      createdBy: userId,
      isDeleted: false,
    });
    return this.meetingRepo.save(entity);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<CabMeeting>,
  ): Promise<CabMeeting | null> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return null;

    const updated = this.meetingRepo.merge(existing, {
      ...data,
      updatedBy: userId,
    });
    return this.meetingRepo.save(updated);
  }

  async softDelete(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findById(tenantId, id);
    if (!existing) return false;

    await this.meetingRepo.save(
      this.meetingRepo.merge(existing, {
        isDeleted: true,
        updatedBy: userId,
      }),
    );
    return true;
  }

  // ──────────────────────────────────────────────
  // Agenda Management
  // ──────────────────────────────────────────────

  async listAgenda(
    tenantId: string,
    meetingId: string,
  ): Promise<CabAgendaItem[]> {
    return this.agendaRepo.find({
      where: { tenantId, cabMeetingId: meetingId, isDeleted: false },
      relations: ['change'],
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });
  }

  async addAgendaItem(
    tenantId: string,
    userId: string,
    meetingId: string,
    changeId: string,
    orderIndex?: number,
  ): Promise<CabAgendaItem> {
    // Check if already exists
    const existing = await this.agendaRepo.findOne({
      where: {
        tenantId,
        cabMeetingId: meetingId,
        changeId,
        isDeleted: false,
      },
    });
    if (existing) {
      return existing;
    }

    // Determine order index
    let idx = orderIndex;
    if (idx === undefined) {
      const maxResult: { maxIdx: number | null } | undefined =
        await this.agendaRepo
          .createQueryBuilder('a')
          .select('MAX(a.orderIndex)', 'maxIdx')
          .where('a.tenantId = :tenantId', { tenantId })
          .andWhere('a.cabMeetingId = :meetingId', { meetingId })
          .andWhere('a.isDeleted = false')
          .getRawOne();
      idx = (maxResult?.maxIdx ?? -1) + 1;
    }

    const entity = this.agendaRepo.create({
      tenantId,
      cabMeetingId: meetingId,
      changeId,
      orderIndex: idx,
      decisionStatus: 'PENDING',
      createdBy: userId,
      isDeleted: false,
    });
    return this.agendaRepo.save(entity);
  }

  async removeAgendaItem(
    tenantId: string,
    userId: string,
    meetingId: string,
    itemId: string,
  ): Promise<boolean> {
    const item = await this.agendaRepo.findOne({
      where: {
        id: itemId,
        tenantId,
        cabMeetingId: meetingId,
        isDeleted: false,
      },
    });
    if (!item) return false;

    await this.agendaRepo.save(
      this.agendaRepo.merge(item, {
        isDeleted: true,
        updatedBy: userId,
      }),
    );
    return true;
  }

  async reorderAgenda(
    tenantId: string,
    userId: string,
    meetingId: string,
    itemIds: string[],
  ): Promise<CabAgendaItem[]> {
    for (let i = 0; i < itemIds.length; i++) {
      await this.agendaRepo
        .createQueryBuilder()
        .update(CabAgendaItem)
        .set({ orderIndex: i, updatedBy: userId })
        .where('id = :id', { id: itemIds[i] })
        .andWhere('tenantId = :tenantId', { tenantId })
        .andWhere('cabMeetingId = :meetingId', { meetingId })
        .andWhere('isDeleted = false')
        .execute();
    }
    return this.listAgenda(tenantId, meetingId);
  }

  // ──────────────────────────────────────────────
  // Decision Recording
  // ──────────────────────────────────────────────

  async recordDecision(
    tenantId: string,
    userId: string,
    meetingId: string,
    itemId: string,
    decisionStatus: string,
    decisionNote?: string,
    conditions?: string,
  ): Promise<CabAgendaItem | null> {
    const item = await this.agendaRepo.findOne({
      where: {
        id: itemId,
        tenantId,
        cabMeetingId: meetingId,
        isDeleted: false,
      },
    });
    if (!item) return null;

    const updated = this.agendaRepo.merge(item, {
      decisionStatus,
      decisionNote: decisionNote || null,
      conditions: conditions || null,
      decisionAt: new Date(),
      decisionById: userId,
      updatedBy: userId,
    });
    return this.agendaRepo.save(updated);
  }

  // ──────────────────────────────────────────────
  // Change → CAB Summary (for change detail page)
  // ──────────────────────────────────────────────

  async getCabSummaryForChange(
    tenantId: string,
    changeId: string,
  ): Promise<{
    meetings: Array<{
      id: string;
      code: string;
      title: string;
      status: string;
      meetingAt: string;
    }>;
    latestDecision: {
      decisionStatus: string;
      decisionNote: string | null;
      decisionAt: string | null;
      meetingCode: string;
      meetingTitle: string;
    } | null;
  }> {
    const agendaItems = await this.agendaRepo.find({
      where: { tenantId, changeId, isDeleted: false },
      relations: ['cabMeeting'],
      order: { createdAt: 'DESC' },
    });

    const meetings = agendaItems
      .filter((a) => a.cabMeeting && !a.cabMeeting.isDeleted)
      .map((a) => ({
        id: a.cabMeeting.id,
        code: a.cabMeeting.code,
        title: a.cabMeeting.title,
        status: a.cabMeeting.status,
        meetingAt: a.cabMeeting.meetingAt.toISOString(),
      }));

    // Find latest decision (non-PENDING)
    const decidedItems = agendaItems.filter(
      (a) => a.decisionStatus !== 'PENDING' && a.decisionAt,
    );
    decidedItems.sort(
      (a, b) => (b.decisionAt?.getTime() ?? 0) - (a.decisionAt?.getTime() ?? 0),
    );

    let latestDecision: {
      decisionStatus: string;
      decisionNote: string | null;
      decisionAt: string | null;
      meetingCode: string;
      meetingTitle: string;
    } | null = null;
    if (decidedItems.length > 0) {
      const d = decidedItems[0];
      latestDecision = {
        decisionStatus: d.decisionStatus,
        decisionNote: d.decisionNote,
        decisionAt: d.decisionAt?.toISOString() ?? null,
        meetingCode: d.cabMeeting?.code ?? '',
        meetingTitle: d.cabMeeting?.title ?? '',
      };
    }

    return { meetings, latestDecision };
  }

  // ──────────────────────────────────────────────
  // Code Generation
  // ──────────────────────────────────────────────

  private async generateCode(tenantId: string): Promise<string> {
    const count = await this.meetingRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .getCount();
    const seq = String(count + 1).padStart(5, '0');
    return `CAB-${seq}`;
  }
}
