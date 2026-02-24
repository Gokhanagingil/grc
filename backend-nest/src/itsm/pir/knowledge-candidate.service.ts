import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ItsmKnowledgeCandidate } from './knowledge-candidate.entity';
import { ItsmPir } from './pir.entity';
import { ItsmKnownError } from '../known-error/known-error.entity';
import { ItsmProblem } from '../problem/problem.entity';
import {
  KnowledgeCandidateStatus,
  KnowledgeCandidateSourceType,
  isValidKcTransition,
} from './pir.enums';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../grc/dto/pagination.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class KnowledgeCandidateService {
  private readonly logger = new Logger(KnowledgeCandidateService.name);

  constructor(
    @InjectRepository(ItsmKnowledgeCandidate)
    private readonly kcRepo: Repository<ItsmKnowledgeCandidate>,
    @InjectRepository(ItsmPir)
    private readonly pirRepo: Repository<ItsmPir>,
    @InjectRepository(ItsmKnownError)
    private readonly keRepo: Repository<ItsmKnownError>,
    @InjectRepository(ItsmProblem)
    private readonly problemRepo: Repository<ItsmProblem>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // Generate from Source
  // ============================================================================

  async generateFromPir(
    tenantId: string,
    userId: string,
    pirId: string,
  ): Promise<ItsmKnowledgeCandidate> {
    const pir = await this.pirRepo.findOne({
      where: { id: pirId, tenantId, isDeleted: false },
    });
    if (!pir) {
      throw new NotFoundException(`PIR with ID ${pirId} not found`);
    }

    const kc = this.kcRepo.create({
      tenantId,
      title: `Knowledge Article: ${pir.title}`,
      sourceType: KnowledgeCandidateSourceType.PIR,
      sourceId: pirId,
      status: KnowledgeCandidateStatus.DRAFT,
      synopsis: pir.summary || null,
      rootCauseSummary: pir.rootCauses || null,
      resolution: pir.correctiveActions || null,
      workaround: pir.preventiveActions || null,
      symptoms: pir.whatHappened || null,
      content: {
        whatHappened: pir.whatHappened,
        rootCauses: pir.rootCauses,
        whatWorkedWell: pir.whatWorkedWell,
        whatDidNotWork: pir.whatDidNotWork,
        customerImpact: pir.customerImpact,
        detectionEffectiveness: pir.detectionEffectiveness,
        responseEffectiveness: pir.responseEffectiveness,
        preventiveActions: pir.preventiveActions,
        correctiveActions: pir.correctiveActions,
        timelineHighlights: pir.timelineHighlights,
      },
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.kcRepo.save(kc);

    this.logger.log(`Knowledge Candidate generated from PIR: ${saved.id}`);

    this.eventEmitter.emit('knowledge-candidate.generated', {
      tenantId,
      userId,
      candidateId: saved.id,
      sourceType: 'PIR',
      sourceId: pirId,
    });

    return saved;
  }

  async generateFromKnownError(
    tenantId: string,
    userId: string,
    knownErrorId: string,
  ): Promise<ItsmKnowledgeCandidate> {
    const ke = await this.keRepo.findOne({
      where: { id: knownErrorId, tenantId, isDeleted: false },
    });
    if (!ke) {
      throw new NotFoundException(
        `Known Error with ID ${knownErrorId} not found`,
      );
    }

    const kc = this.kcRepo.create({
      tenantId,
      title: `Knowledge Article: ${ke.title}`,
      sourceType: KnowledgeCandidateSourceType.KNOWN_ERROR,
      sourceId: knownErrorId,
      status: KnowledgeCandidateStatus.DRAFT,
      synopsis: ke.title,
      rootCauseSummary: ke.rootCause || null,
      workaround: ke.workaround || null,
      symptoms: ke.symptoms || null,
      content: {
        title: ke.title,
        symptoms: ke.symptoms,
        rootCause: ke.rootCause,
        workaround: ke.workaround,
        permanentFixStatus: ke.permanentFixStatus,
      },
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.kcRepo.save(kc);

    this.logger.log(`Knowledge Candidate generated from KE: ${saved.id}`);

    this.eventEmitter.emit('knowledge-candidate.generated', {
      tenantId,
      userId,
      candidateId: saved.id,
      sourceType: 'KNOWN_ERROR',
      sourceId: knownErrorId,
    });

    return saved;
  }

  async generateFromProblem(
    tenantId: string,
    userId: string,
    problemId: string,
  ): Promise<ItsmKnowledgeCandidate> {
    const problem = await this.problemRepo.findOne({
      where: { id: problemId, tenantId, isDeleted: false },
    });
    if (!problem) {
      throw new NotFoundException(`Problem with ID ${problemId} not found`);
    }

    const kc = this.kcRepo.create({
      tenantId,
      title: `Knowledge Article: ${problem.shortDescription}`,
      sourceType: KnowledgeCandidateSourceType.PROBLEM,
      sourceId: problemId,
      status: KnowledgeCandidateStatus.DRAFT,
      synopsis: problem.description || problem.shortDescription,
      rootCauseSummary: problem.rootCauseSummary || null,
      workaround: problem.workaroundSummary || null,
      content: {
        shortDescription: problem.shortDescription,
        description: problem.description,
        rootCauseSummary: problem.rootCauseSummary,
        fiveWhySummary: problem.fiveWhySummary,
        contributingFactors: problem.contributingFactors,
        rootCauseCategory: problem.rootCauseCategory,
        workaroundSummary: problem.workaroundSummary,
      },
      createdBy: userId,
      isDeleted: false,
    });

    const saved = await this.kcRepo.save(kc);

    this.logger.log(`Knowledge Candidate generated from Problem: ${saved.id}`);

    this.eventEmitter.emit('knowledge-candidate.generated', {
      tenantId,
      userId,
      candidateId: saved.id,
      sourceType: 'PROBLEM',
      sourceId: problemId,
    });

    return saved;
  }

  // ============================================================================
  // CRUD
  // ============================================================================

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<ItsmKnowledgeCandidate | null> {
    return this.kcRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async findWithFilters(
    tenantId: string,
    params: {
      page?: number;
      pageSize?: number;
      status?: KnowledgeCandidateStatus;
      sourceType?: KnowledgeCandidateSourceType;
      search?: string;
    },
  ): Promise<PaginatedResponse<ItsmKnowledgeCandidate>> {
    const { page = 1, pageSize = 20, status, sourceType, search } = params;

    const qb = this.kcRepo.createQueryBuilder('kc');
    qb.where('kc.tenantId = :tenantId', { tenantId });
    qb.andWhere('kc.isDeleted = :isDeleted', { isDeleted: false });

    if (status) {
      qb.andWhere('kc.status = :status', { status });
    }
    if (sourceType) {
      qb.andWhere('kc.sourceType = :sourceType', { sourceType });
    }
    if (search) {
      qb.andWhere('(kc.title ILIKE :search OR kc.synopsis ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const total = await qb.getCount();

    qb.orderBy('kc.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async transitionStatus(
    tenantId: string,
    userId: string,
    id: string,
    newStatus: KnowledgeCandidateStatus,
  ): Promise<ItsmKnowledgeCandidate> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) {
      throw new NotFoundException(
        `Knowledge Candidate with ID ${id} not found`,
      );
    }

    if (!isValidKcTransition(existing.status, newStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${existing.status} to ${newStatus}`,
      );
    }

    existing.status = newStatus;
    existing.updatedBy = userId;

    if (newStatus === KnowledgeCandidateStatus.REVIEWED) {
      existing.reviewedBy = userId;
      existing.reviewedAt = new Date();
    }
    if (newStatus === KnowledgeCandidateStatus.PUBLISHED) {
      existing.publishedAt = new Date();
    }

    const saved = await this.kcRepo.save(existing);

    try {
      await this.auditService.recordUpdate(
        'ItsmKnowledgeCandidate',
        saved.id,
        {} as Record<string, unknown>,
        { status: newStatus } as unknown as Record<string, unknown>,
        userId,
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Failed to record audit for KC status change: ${err}`);
    }

    if (newStatus === KnowledgeCandidateStatus.PUBLISHED) {
      this.eventEmitter.emit('knowledge-candidate.published', {
        tenantId,
        userId,
        candidateId: saved.id,
      });
    }

    return saved;
  }

  async softDelete(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOne(tenantId, id);
    if (!existing) return false;

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.kcRepo.save(existing);

    return true;
  }
}
