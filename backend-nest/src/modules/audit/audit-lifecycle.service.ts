import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, In, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MetricsService } from '../metrics/metrics.service';
import { CalendarService } from '../calendar/calendar.service';
import { CalendarEventEntity, CalendarEventType, CalendarEventStatus } from '../../entities/app/calendar-event.entity';
import {
  AuditPlanEntity,
  AuditEngagementEntity,
  AuditTestEntity,
  AuditEvidenceEntity,
  AuditFindingEntity,
  CorrectiveActionEntity,
} from '../../entities/app';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { parsePagination, parseSort } from '../../common/search/pagination.dto';
import {
  CreateAuditPlanDto,
  CreateAuditEngagementDto,
  CreateAuditTestDto,
  CreateAuditEvidenceDto,
  CreateAuditFindingDto,
  CreateCorrectiveActionDto,
  QueryAuditPlanDto,
  QueryAuditEngagementDto,
  QueryAuditTestDto,
  QueryAuditFindingDto,
  QueryCorrectiveActionDto,
} from './dto';
import { AuditPlanStatus } from '../../entities/app/audit-plan.entity';
import { AuditEngagementStatus } from '../../entities/app/audit-engagement.entity';
import { AuditTestStatus } from '../../entities/app/audit-test.entity';
import {
  AuditFindingSeverity,
  AuditFindingStatus,
} from '../../entities/app/audit-finding.entity';
import { CorrectiveActionStatus } from '../../entities/app/corrective-action.entity';

@Injectable()
export class AuditLifecycleService {
  private readonly logger = new Logger(AuditLifecycleService.name);

  constructor(
    @InjectRepository(AuditPlanEntity)
    private readonly planRepo: Repository<AuditPlanEntity>,
    @InjectRepository(AuditEngagementEntity)
    private readonly engagementRepo: Repository<AuditEngagementEntity>,
    @InjectRepository(AuditTestEntity)
    private readonly testRepo: Repository<AuditTestEntity>,
    @InjectRepository(AuditEvidenceEntity)
    private readonly evidenceRepo: Repository<AuditEvidenceEntity>,
    @InjectRepository(AuditFindingEntity)
    private readonly findingRepo: Repository<AuditFindingEntity>,
    @InjectRepository(CorrectiveActionEntity)
    private readonly capRepo: Repository<CorrectiveActionEntity>,
    private readonly metricsService: MetricsService,
    private readonly calendarService: CalendarService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  // Audit Plans
  async listPlans(tenantId: string, query: QueryAuditPlanDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.planRepo
        .createQueryBuilder('plan')
        .where('plan.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.search) {
        qb.andWhere('(plan.code ILIKE :search OR plan.name ILIKE :search)', {
          search: `%${query.search}%`,
        });
      }

      if (query.status) {
        qb.andWhere('plan.status = :status', { status: query.status });
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`plan.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn('Error listing audit plans:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getPlan(id: string, tenantId: string) {
    const plan = await this.planRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['engagements'],
    });
    if (!plan) throw new NotFoundException(`Audit plan ${id} not found`);
    return plan;
  }

  async createPlan(dto: CreateAuditPlanDto, tenantId: string) {
    const existing = await this.planRepo.findOne({
      where: { code: dto.code, ...tenantWhere(tenantId) },
    });
    if (existing)
      throw new ConflictException(
        `Audit plan with code ${dto.code} already exists`,
      );

    const plan = this.planRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      code: dto.code,
      name: dto.name,
      period_start: new Date(dto.period_start),
      period_end: new Date(dto.period_end),
      scope: dto.scope,
      status: dto.status || AuditPlanStatus.PLANNED,
    });

    return this.planRepo.save(plan);
  }

  async updatePlan(
    id: string,
    dto: Partial<CreateAuditPlanDto>,
    tenantId: string,
  ) {
    const plan = await this.getPlan(id, tenantId);
    if (dto.code && dto.code !== plan.code) {
      const existing = await this.planRepo.findOne({
        where: { code: dto.code, ...tenantWhere(tenantId) },
      });
      if (existing)
        throw new ConflictException(
          `Audit plan with code ${dto.code} already exists`,
        );
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.period_start !== undefined)
      plan.period_start = new Date(dto.period_start);
    if (dto.period_end !== undefined)
      plan.period_end = new Date(dto.period_end);
    if (dto.scope !== undefined) plan.scope = dto.scope;
    if (dto.status !== undefined) plan.status = dto.status;
    if (dto.code !== undefined) plan.code = dto.code;

    return this.planRepo.save(plan);
  }

  async archivePlan(id: string, tenantId: string) {
    const plan = await this.getPlan(id, tenantId);
    plan.status = AuditPlanStatus.ARCHIVED;
    plan.archived_at = new Date();
    return this.planRepo.save(plan);
  }

  // Audit Engagements
  async listEngagements(tenantId: string, query: QueryAuditEngagementDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.engagementRepo
        .createQueryBuilder('engagement')
        .leftJoinAndSelect('engagement.plan', 'plan')
        .leftJoinAndSelect('engagement.findings', 'findings')
        .where('engagement.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.plan_id) {
        qb.andWhere('engagement.plan_id = :planId', { planId: query.plan_id });
      }

      if (query.status) {
        qb.andWhere('engagement.status = :status', { status: query.status });
      }

      if (query.search) {
        // Use TypeORM ILike for SQLite compatibility
        qb.andWhere(
          '(engagement.code LIKE :search OR engagement.name LIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`engagement.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      // Load CAPs for each finding
      for (const engagement of items) {
        if (engagement.findings && engagement.findings.length > 0) {
          const findingIds = engagement.findings.map((f) => f.id);
          const caps = await this.capRepo.find({
            where: {
              finding_id: In(findingIds),
              ...tenantWhere(tenantId),
            },
          });
          // Attach CAPs to findings
          engagement.findings.forEach((finding) => {
            (finding as any).corrective_actions = caps.filter(
              (cap) => cap.finding_id === finding.id,
            );
          });
        }
      }

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn(
        'Error listing audit engagements:',
        error?.message || error,
      );
      if (error?.stack) {
        this.logger.error('Stack trace:', error.stack);
      }
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getEngagement(id: string, tenantId: string) {
    const engagement = await this.engagementRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['plan', 'tests', 'findings'],
    });
    if (!engagement)
      throw new NotFoundException(`Audit engagement ${id} not found`);
    
    // Load CAPs for findings
    if (engagement.findings && engagement.findings.length > 0) {
      const findingIds = engagement.findings.map((f) => f.id);
      const caps = await this.capRepo.find({
        where: {
          finding_id: In(findingIds),
          ...tenantWhere(tenantId),
        },
      });
      // Attach CAPs to findings
      engagement.findings.forEach((finding) => {
        (finding as any).corrective_actions = caps.filter(
          (cap) => cap.finding_id === finding.id,
        );
      });
    }
    
    return engagement;
  }

  async createEngagement(dto: CreateAuditEngagementDto, tenantId: string) {
    // Verify plan exists
    const plan = await this.planRepo.findOne({
      where: { id: dto.plan_id, ...tenantWhere(tenantId) },
    });
    if (!plan)
      throw new NotFoundException(`Audit plan ${dto.plan_id} not found`);

    const existing = await this.engagementRepo.findOne({
      where: { code: dto.code, ...tenantWhere(tenantId) },
    });
    if (existing)
      throw new ConflictException(
        `Engagement with code ${dto.code} already exists`,
      );

    const engagement = this.engagementRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      plan_id: dto.plan_id,
      code: dto.code,
      name: dto.name,
      auditee: dto.auditee,
      lead_auditor_id: dto.lead_auditor_id,
      status: dto.status || AuditEngagementStatus.PLANNED,
    });

    const saved = await this.engagementRepo.save(engagement);

    // Create calendar event for engagement
    try {
      const plan = await this.planRepo.findOne({
        where: { id: dto.plan_id, ...tenantWhere(tenantId) },
      });
      if (plan && plan.period_start && plan.period_end) {
        // Use plan's period dates for calendar event
        const startAt = new Date(plan.period_start);
        const endAt = new Date(plan.period_end);
        
        // Map engagement status to calendar event status
        let calendarStatus = CalendarEventStatus.PLANNED;
        if (saved.status === AuditEngagementStatus.COMPLETED) {
          calendarStatus = CalendarEventStatus.COMPLETED;
        } else if (saved.status === AuditEngagementStatus.IN_PROGRESS) {
          calendarStatus = CalendarEventStatus.CONFIRMED;
        } else if (saved.status === AuditEngagementStatus.CANCELLED) {
          calendarStatus = CalendarEventStatus.CANCELLED;
        }

        await this.calendarService.create(
          {
            title: `${saved.code}: ${saved.name}`,
            description: saved.auditee ? `Auditee: ${saved.auditee}` : undefined,
            event_type: CalendarEventType.AUDIT_ENGAGEMENT,
            source_module: 'audit',
            source_entity: 'AuditEngagement',
            source_id: saved.id,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: calendarStatus,
            owner_user_id: saved.lead_auditor_id,
          },
          tenantId,
        );
      }
    } catch (error: any) {
      // Log error but don't fail engagement creation
      this.logger.warn('Failed to create calendar event for engagement:', error?.message || error);
    }

    return this.getEngagement(saved.id, tenantId);
  }

  async updateEngagement(
    id: string,
    dto: Partial<CreateAuditEngagementDto>,
    tenantId: string,
  ) {
    const engagement = await this.getEngagement(id, tenantId);
    if (dto.code && dto.code !== engagement.code) {
      const existing = await this.engagementRepo.findOne({
        where: { code: dto.code, ...tenantWhere(tenantId) },
      });
      if (existing)
        throw new ConflictException(
          `Engagement with code ${dto.code} already exists`,
        );
    }

    if (dto.name !== undefined) engagement.name = dto.name;
    if (dto.auditee !== undefined) engagement.auditee = dto.auditee;
    if (dto.lead_auditor_id !== undefined)
      engagement.lead_auditor_id = dto.lead_auditor_id;
    if (dto.status !== undefined) engagement.status = dto.status;
    if (dto.code !== undefined) engagement.code = dto.code;

    const updated = await this.engagementRepo.save(engagement);

    // Update calendar event for engagement
    try {
      const plan = await this.planRepo.findOne({
        where: { id: engagement.plan_id, ...tenantWhere(tenantId) },
      });
      if (plan && plan.period_start && plan.period_end) {
        // Find existing calendar event
        const calendarEvents = await this.calendarService.list(
          {
            from: new Date(plan.period_start).toISOString(),
            to: new Date(plan.period_end).toISOString(),
            types: [CalendarEventType.AUDIT_ENGAGEMENT],
          },
          tenantId,
        );
        const existingEvent = calendarEvents.find(
          (e) => e.source_id === engagement.id && e.source_entity === 'AuditEngagement',
        );

        const startAt = new Date(plan.period_start);
        const endAt = new Date(plan.period_end);
        
        // Map engagement status to calendar event status
        let calendarStatus = CalendarEventStatus.PLANNED;
        if (updated.status === AuditEngagementStatus.COMPLETED) {
          calendarStatus = CalendarEventStatus.COMPLETED;
        } else if (updated.status === AuditEngagementStatus.IN_PROGRESS) {
          calendarStatus = CalendarEventStatus.CONFIRMED;
        } else if (updated.status === AuditEngagementStatus.CANCELLED) {
          calendarStatus = CalendarEventStatus.CANCELLED;
        }

        if (existingEvent) {
          // Update existing event
          await this.calendarService.update(
            existingEvent.id,
            {
              title: `${updated.code}: ${updated.name}`,
              description: updated.auditee ? `Auditee: ${updated.auditee}` : undefined,
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
              status: calendarStatus,
              owner_user_id: updated.lead_auditor_id,
            },
            tenantId,
          );
        } else {
          // Create new event if it doesn't exist
          await this.calendarService.create(
            {
              title: `${updated.code}: ${updated.name}`,
              description: updated.auditee ? `Auditee: ${updated.auditee}` : undefined,
              event_type: CalendarEventType.AUDIT_ENGAGEMENT,
              source_module: 'audit',
              source_entity: 'AuditEngagement',
              source_id: updated.id,
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
              status: calendarStatus,
              owner_user_id: updated.lead_auditor_id,
            },
            tenantId,
          );
        }
      }
    } catch (error: any) {
      // Log error but don't fail engagement update
      this.logger.warn('Failed to update calendar event for engagement:', error?.message || error);
    }

    return updated;
  }

  // Audit Tests
  async listTests(tenantId: string, query: QueryAuditTestDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.testRepo
        .createQueryBuilder('test')
        .leftJoinAndSelect('test.engagement', 'engagement')
        .where('test.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.engagement_id) {
        qb.andWhere('test.engagement_id = :engagementId', {
          engagementId: query.engagement_id,
        });
      }

      if (query.status) {
        qb.andWhere('test.status = :status', { status: query.status });
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`test.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn('Error listing audit tests:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getTest(id: string, tenantId: string) {
    const test = await this.testRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['engagement', 'evidences'],
    });
    if (!test) throw new NotFoundException(`Audit test ${id} not found`);
    return test;
  }

  async createTest(dto: CreateAuditTestDto, tenantId: string) {
    const engagement = await this.engagementRepo.findOne({
      where: { id: dto.engagement_id, ...tenantWhere(tenantId) },
    });
    if (!engagement)
      throw new NotFoundException(`Engagement ${dto.engagement_id} not found`);

    const existing = await this.testRepo.findOne({
      where: { code: dto.code, ...tenantWhere(tenantId) },
    });
    if (existing)
      throw new ConflictException(`Test with code ${dto.code} already exists`);

    const test = this.testRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      engagement_id: dto.engagement_id,
      code: dto.code,
      name: dto.name,
      objective: dto.objective,
      population_ref: dto.population_ref,
      clause_id: dto.clause_id,
      control_id: dto.control_id,
      status: dto.status || AuditTestStatus.PLANNED,
    });

    const saved = await this.testRepo.save(test);
    return this.getTest(saved.id, tenantId);
  }

  async updateTest(
    id: string,
    dto: Partial<CreateAuditTestDto>,
    tenantId: string,
  ) {
    const test = await this.getTest(id, tenantId);
    if (dto.code && dto.code !== test.code) {
      const existing = await this.testRepo.findOne({
        where: { code: dto.code, ...tenantWhere(tenantId) },
      });
      if (existing)
        throw new ConflictException(
          `Test with code ${dto.code} already exists`,
        );
    }

    if (dto.name !== undefined) test.name = dto.name;
    if (dto.objective !== undefined) test.objective = dto.objective;
    if (dto.population_ref !== undefined)
      test.population_ref = dto.population_ref;
    if (dto.clause_id !== undefined) test.clause_id = dto.clause_id;
    if (dto.control_id !== undefined) test.control_id = dto.control_id;
    if (dto.status !== undefined) test.status = dto.status;
    if (dto.code !== undefined) test.code = dto.code;

    return this.testRepo.save(test);
  }

  // Audit Evidences
  async listEvidences(tenantId: string, testId?: string) {
    try {
      const where: FindOptionsWhere<AuditEvidenceEntity> = {
        ...tenantWhere(tenantId),
      };
      if (testId) where.test_id = testId;

      const items = await this.evidenceRepo.find({
        where,
        order: { collected_at: 'DESC' },
      });

      return { items, total: items.length };
    } catch (error: any) {
      this.logger.warn(
        'Error listing audit evidences:',
        error?.message || error,
      );
      return { items: [], total: 0 };
    }
  }

  async addEvidenceToTest(
    testId: string,
    dto: Omit<CreateAuditEvidenceDto, 'test_id'>,
    tenantId: string,
  ) {
    const test = await this.testRepo.findOne({
      where: { id: testId, ...tenantWhere(tenantId) },
    });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);

    const evidenceDto: CreateAuditEvidenceDto = {
      ...dto,
      test_id: testId,
      related_entity_type: 'test',
      related_entity_id: testId,
    };

    return this.createEvidence(evidenceDto, tenantId);
  }

  async addEvidenceToFinding(
    findingId: string,
    dto: Omit<CreateAuditEvidenceDto, 'test_id' | 'related_entity_type' | 'related_entity_id'>,
    tenantId: string,
  ) {
    const finding = await this.findingRepo.findOne({
      where: { id: findingId, ...tenantWhere(tenantId) },
    });
    if (!finding) throw new NotFoundException(`Finding ${findingId} not found`);

    const evidenceDto: CreateAuditEvidenceDto = {
      ...dto,
      test_id: finding.test_id, // Link to test if available
      related_entity_type: 'finding',
      related_entity_id: findingId,
    };

    return this.createEvidence(evidenceDto, tenantId);
  }

  async addEvidenceToCorrectiveAction(
    capId: string,
    dto: Omit<CreateAuditEvidenceDto, 'test_id' | 'related_entity_type' | 'related_entity_id'>,
    tenantId: string,
  ) {
    const cap = await this.capRepo.findOne({
      where: { id: capId, ...tenantWhere(tenantId) },
      relations: ['finding'],
    });
    if (!cap) throw new NotFoundException(`Corrective action ${capId} not found`);

    // Try to get test_id from finding if available
    let testId: string | undefined;
    if (cap.finding?.test_id) {
      testId = cap.finding.test_id;
    }

    const evidenceDto: CreateAuditEvidenceDto = {
      ...dto,
      test_id: testId,
      related_entity_type: 'corrective_action',
      related_entity_id: capId,
    };

    return this.createEvidence(evidenceDto, tenantId);
  }

  async createEvidence(dto: CreateAuditEvidenceDto, tenantId: string) {
    // If test_id provided, verify it exists
    if (dto.test_id) {
      const test = await this.testRepo.findOne({
        where: { id: dto.test_id, ...tenantWhere(tenantId) },
      });
      if (!test) throw new NotFoundException(`Test ${dto.test_id} not found`);
    }

    const evidence = this.evidenceRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      test_id: dto.test_id,
      type: dto.type,
      related_entity_type: dto.related_entity_type,
      related_entity_id: dto.related_entity_id,
      file_name: dto.file_name,
      file_url: dto.file_url || dto.uri_or_text,
      note: dto.note,
      uri_or_text: dto.uri_or_text || dto.file_url || dto.note,
      collected_at: dto.collected_at ? new Date(dto.collected_at) : new Date(),
      collected_by: dto.collected_by,
    });

    return this.evidenceRepo.save(evidence);
  }

  async deleteEvidence(id: string, tenantId: string) {
    const evidence = await this.evidenceRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
    });
    if (!evidence) throw new NotFoundException(`Evidence ${id} not found`);
    await this.evidenceRepo.remove(evidence);
    return { success: true, id };
  }

  // Audit Findings
  async listFindings(tenantId: string, query: QueryAuditFindingDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.findingRepo
        .createQueryBuilder('finding')
        .leftJoinAndSelect('finding.engagement', 'engagement')
        .leftJoinAndSelect('finding.test', 'test')
        .where('finding.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.engagement_id) {
        qb.andWhere('finding.engagement_id = :engagementId', {
          engagementId: query.engagement_id,
        });
      }

      if (query.severity) {
        qb.andWhere('finding.severity = :severity', {
          severity: query.severity,
        });
      }

      if (query.status) {
        qb.andWhere('finding.status = :status', { status: query.status });
      }

      if (query.due_date) {
        qb.andWhere('finding.due_date >= :dueDate', {
          dueDate: query.due_date,
        });
      }

      if (query.search) {
        qb.andWhere(
          '(finding.title ILIKE :search OR finding.details ILIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`finding.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      // Update metrics: count open findings
      const openCount = items.filter(
        (f) => f.status === AuditFindingStatus.OPEN,
      ).length;
      if (this.metricsService) {
        try {
          const gauge = this.metricsService.getGauge(
            'audit_findings_open_total',
          );
          if (gauge) {
            gauge.set({ tenant_id: tenantId }, openCount);
          }
        } catch (error: any) {
          // Metrics not available, ignore
        }
      }

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn(
        'Error listing audit findings:',
        error?.message || error,
      );
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getFinding(id: string, tenantId: string) {
    const finding = await this.findingRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['engagement', 'test', 'corrective_actions'],
    });
    if (!finding) throw new NotFoundException(`Audit finding ${id} not found`);
    return finding;
  }

  async createFindingFromTest(
    testId: string,
    dto: Omit<CreateAuditFindingDto, 'test_id' | 'engagement_id'>,
    tenantId: string,
  ) {
    const test = await this.testRepo.findOne({
      where: { id: testId, ...tenantWhere(tenantId) },
      relations: ['engagement'],
    });
    if (!test) throw new NotFoundException(`Test ${testId} not found`);

    const findingDto: CreateAuditFindingDto = {
      ...dto,
      engagement_id: test.engagement_id,
      test_id: testId,
      // Auto-populate from test if not provided
      title: dto.title || `Finding from test: ${test.name}`,
      severity: dto.severity || AuditFindingSeverity.MEDIUM,
    };

    return this.createFinding(findingDto, tenantId);
  }

  async createFinding(dto: CreateAuditFindingDto, tenantId: string) {
    const engagement = await this.engagementRepo.findOne({
      where: { id: dto.engagement_id, ...tenantWhere(tenantId) },
    });
    if (!engagement)
      throw new NotFoundException(`Engagement ${dto.engagement_id} not found`);

    if (dto.test_id) {
      const test = await this.testRepo.findOne({
        where: { id: dto.test_id, ...tenantWhere(tenantId) },
      });
      if (!test) throw new NotFoundException(`Test ${dto.test_id} not found`);
    }

    const finding = this.findingRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      engagement_id: dto.engagement_id,
      test_id: dto.test_id,
      severity: dto.severity,
      title: dto.title,
      description: dto.description || dto.details,
      details: dto.details || dto.description,
      root_cause: dto.root_cause,
      status: dto.status || AuditFindingStatus.OPEN,
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      policy_id: dto.policy_id,
      clause_id: dto.clause_id,
      control_id: dto.control_id,
      risk_instance_id: dto.risk_instance_id,
    });

    const saved = await this.findingRepo.save(finding);
    return this.getFinding(saved.id, tenantId);
  }

  async updateFinding(
    id: string,
    dto: Partial<CreateAuditFindingDto>,
    tenantId: string,
  ) {
    const finding = await this.getFinding(id, tenantId);
    if (dto.title !== undefined) finding.title = dto.title;
    if (dto.details !== undefined) finding.details = dto.details;
    if (dto.severity !== undefined) finding.severity = dto.severity;
    if (dto.status !== undefined) finding.status = dto.status;
    if (dto.due_date !== undefined)
      finding.due_date = dto.due_date ? new Date(dto.due_date) : undefined;

    return this.findingRepo.save(finding);
  }

  async linkFindingToPolicy(id: string, policyId: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.policy_id = policyId;
    return this.findingRepo.save(finding);
  }

  async linkFindingToClause(id: string, clauseId: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.clause_id = clauseId;
    return this.findingRepo.save(finding);
  }

  async linkFindingToControl(id: string, controlId: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.control_id = controlId;
    return this.findingRepo.save(finding);
  }

  async linkFindingToRisk(
    id: string,
    riskInstanceId: string,
    tenantId: string,
  ) {
    const finding = await this.getFinding(id, tenantId);
    finding.risk_instance_id = riskInstanceId;
    return this.findingRepo.save(finding);
  }

  // Unlink endpoints (idempotent - set to null)
  async unlinkFindingFromPolicy(id: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.policy_id = undefined;
    return this.findingRepo.save(finding);
  }

  async unlinkFindingFromClause(id: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.clause_id = undefined;
    return this.findingRepo.save(finding);
  }

  async unlinkFindingFromControl(id: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.control_id = undefined;
    return this.findingRepo.save(finding);
  }

  async unlinkFindingFromRisk(id: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.risk_instance_id = undefined;
    return this.findingRepo.save(finding);
  }

  async linkFindingToBIAProcess(
    id: string,
    biaProcessId: string,
    tenantId: string,
  ) {
    const finding = await this.getFinding(id, tenantId);
    // Verify BIA process exists (would need BCM service injected, but for now just set it)
    finding.bia_process_id = biaProcessId;
    return this.findingRepo.save(finding);
  }

  async unlinkFindingFromBIAProcess(id: string, tenantId: string) {
    const finding = await this.getFinding(id, tenantId);
    finding.bia_process_id = undefined;
    return this.findingRepo.save(finding);
  }

  // Engagement Summary
  async getEngagementSummary(id: string, tenantId: string) {
    const engagement = await this.getEngagement(id, tenantId);

    // Count tests
    const testCount = await this.testRepo.count({
      where: { engagement_id: id, ...tenantWhere(tenantId) },
    });

    // Count evidences (via tests)
    const tests = await this.testRepo.find({
      where: { engagement_id: id, ...tenantWhere(tenantId) },
      select: ['id'],
    });
    const testIds = tests.map((t) => t.id);
    const evidenceCount =
      testIds.length > 0
        ? await this.evidenceRepo.count({
            where: { test_id: In(testIds), ...tenantWhere(tenantId) },
          })
        : 0;

    // Count findings by status and severity
    const findings = await this.findingRepo.find({
      where: { engagement_id: id, ...tenantWhere(tenantId) },
      select: ['status', 'severity'],
    });

    const openFindings = findings.filter(
      (f) => f.status === AuditFindingStatus.OPEN,
    ).length;
    const highFindings = findings.filter(
      (f) =>
        f.severity === AuditFindingSeverity.HIGH ||
        f.severity === AuditFindingSeverity.CRITICAL,
    ).length;

    // CAP status distribution
    const findingIds = findings.map((f) => f.id);
    const caps =
      findingIds.length > 0
        ? await this.capRepo.find({
            where: { finding_id: In(findingIds), ...tenantWhere(tenantId) },
            select: ['status'],
          })
        : [];

    const capStatusDistribution = {
      open: caps.filter((c) => c.status === CorrectiveActionStatus.OPEN).length,
      in_progress: caps.filter(
        (c) => c.status === CorrectiveActionStatus.IN_PROGRESS,
      ).length,
      done: caps.filter((c) => c.status === CorrectiveActionStatus.DONE).length,
      cancelled: caps.filter(
        (c) => c.status === CorrectiveActionStatus.CANCELLED,
      ).length,
    };

    return {
      engagement: {
        id: engagement.id,
        code: engagement.code,
        name: engagement.name,
        status: engagement.status,
      },
      testCount,
      evidenceCount,
      findingCounts: {
        total: findings.length,
        open: openFindings,
        high: highFindings,
      },
      capStatusDistribution,
    };
  }

  // CAP Status Transition
  async transitionCAPStatus(
    id: string,
    newStatus: CorrectiveActionStatus,
    tenantId: string,
  ) {
    const cap = await this.getCAP(id, tenantId);

    // Validate transition
    const validTransitions: Record<
      CorrectiveActionStatus,
      CorrectiveActionStatus[]
    > = {
      [CorrectiveActionStatus.OPEN]: [
        CorrectiveActionStatus.IN_PROGRESS,
        CorrectiveActionStatus.CANCELLED,
      ],
      [CorrectiveActionStatus.IN_PROGRESS]: [
        CorrectiveActionStatus.DONE,
        CorrectiveActionStatus.CANCELLED,
      ],
      [CorrectiveActionStatus.DONE]: [], // Terminal state
      [CorrectiveActionStatus.CANCELLED]: [], // Terminal state
    };

    if (!validTransitions[cap.status].includes(newStatus)) {
      throw new ConflictException(
        `Invalid transition from ${cap.status} to ${newStatus}. Valid transitions: ${validTransitions[cap.status].join(', ')}`,
      );
    }

    cap.status = newStatus;
    if (
      newStatus === CorrectiveActionStatus.DONE ||
      newStatus === CorrectiveActionStatus.CANCELLED
    ) {
      cap.closed_at = new Date();
    }

    const saved = await this.capRepo.save(cap);

    // Broadcast WebSocket notification (if RealtimeGateway is available)
    if (this.realtimeGateway) {
      try {
        this.realtimeGateway.broadcastCapStatusUpdated(
          saved.id,
          saved.status,
          tenantId,
        );
      } catch (error: any) {
        this.logger.warn('Failed to broadcast CAP status update:', error?.message || error);
      }
    }

    return saved;
  }

  // Corrective Actions (CAP)
  async listCAPs(tenantId: string, query: QueryCorrectiveActionDto) {
    try {
      const { page, pageSize, skip } = parsePagination(query);
      const order = parseSort(query.sort) || { created_at: 'DESC' };

      const qb = this.capRepo
        .createQueryBuilder('cap')
        .leftJoinAndSelect('cap.finding', 'finding')
        .where('cap.tenant_id = :tenantId', { tenantId })
        .skip(skip)
        .take(pageSize);

      if (query.finding_id) {
        qb.andWhere('cap.finding_id = :findingId', {
          findingId: query.finding_id,
        });
      }

      if (query.status) {
        qb.andWhere('cap.status = :status', { status: query.status });
      }

      Object.entries(order).forEach(([field, dir]) => {
        qb.addOrderBy(`cap.${field}`, dir);
      });

      const [items, total] = await qb.getManyAndCount();

      // Update metrics: count open CAPs
      const openCount = items.filter(
        (c) =>
          c.status === CorrectiveActionStatus.OPEN ||
          c.status === CorrectiveActionStatus.IN_PROGRESS,
      ).length;
      if (this.metricsService) {
        try {
          const gauge = this.metricsService.getGauge('audit_caps_open_total');
          if (gauge) {
            gauge.set({ tenant_id: tenantId }, openCount);
          }
        } catch (error: any) {
          // Metrics not available, ignore
        }
      }

      return { items, total, page, pageSize };
    } catch (error: any) {
      this.logger.warn('Error listing CAPs:', error?.message || error);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  async getCAP(id: string, tenantId: string) {
    const cap = await this.capRepo.findOne({
      where: { id, ...tenantWhere(tenantId) },
      relations: ['finding'],
    });
    if (!cap) throw new NotFoundException(`CAP ${id} not found`);
    return cap;
  }

  async createCorrectiveActionFromFinding(
    findingId: string,
    dto: Omit<CreateCorrectiveActionDto, 'finding_id'>,
    tenantId: string,
  ) {
    const finding = await this.findingRepo.findOne({
      where: { id: findingId, ...tenantWhere(tenantId) },
    });
    if (!finding) throw new NotFoundException(`Finding ${findingId} not found`);

    const capDto: CreateCorrectiveActionDto = {
      ...dto,
      finding_id: findingId,
    };

    return this.createCorrectiveAction(capDto, tenantId);
  }

  async createCorrectiveAction(dto: CreateCorrectiveActionDto, tenantId: string) {
    const finding = await this.findingRepo.findOne({
      where: { id: dto.finding_id, ...tenantWhere(tenantId) },
    });
    if (!finding)
      throw new NotFoundException(`Finding ${dto.finding_id} not found`);

    const cap = this.capRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      finding_id: dto.finding_id,
      code: dto.code,
      title: dto.title,
      description: dto.description,
      assignee_user_id: dto.assignee_user_id,
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      status: dto.status || CorrectiveActionStatus.OPEN,
      closed_at: dto.completed_date ? new Date(dto.completed_date) : undefined,
    });

    const saved = await this.capRepo.save(cap);
    return this.getCAP(saved.id, tenantId);
  }

  async createCAP(dto: CreateCorrectiveActionDto, tenantId: string) {
    return this.createCorrectiveAction(dto, tenantId);
  }

  async updateCAP(
    id: string,
    dto: Partial<CreateCorrectiveActionDto>,
    tenantId: string,
  ) {
    const cap = await this.getCAP(id, tenantId);
    if (dto.title !== undefined) cap.title = dto.title;
    if (dto.description !== undefined) cap.description = dto.description;
    if (dto.assignee_user_id !== undefined)
      cap.assignee_user_id = dto.assignee_user_id;
    if (dto.due_date !== undefined)
      cap.due_date = dto.due_date ? new Date(dto.due_date) : undefined;
    if (dto.status !== undefined) cap.status = dto.status;
    if (dto.completed_date !== undefined) {
      cap.closed_at = dto.completed_date ? new Date(dto.completed_date) : undefined;
    }

    return this.capRepo.save(cap);
  }
}
