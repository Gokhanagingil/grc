import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import {
  GrcEvidence,
  GrcControl,
  GrcControlEvidence,
  GrcTestResult,
  GrcEvidenceTestResult,
  GrcIssue,
  GrcIssueEvidence,
} from '../entities';
import {
  CreateEvidenceDto,
  UpdateEvidenceDto,
  EvidenceFilterDto,
  LinkEvidenceTestResultDto,
} from '../dto/evidence.dto';
import { AuditService } from '../../audit/audit.service';
import { ControlEvidenceType } from '../enums';
import { parseFilterJson } from '../../common/list-query/list-query.parser';
import { validateFilterAgainstAllowlist } from '../../common/list-query/list-query.validator';
import {
  applyFilterTree,
  applyQuickSearch,
} from '../../common/list-query/list-query.apply';
import {
  EVIDENCE_ALLOWLIST,
  EVIDENCE_SEARCHABLE_COLUMNS,
} from '../../common/list-query/list-query.allowlist';

@Injectable()
export class GrcEvidenceService {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'type',
    'sourceType',
    'status',
    'collectedAt',
    'dueDate',
  ]);

  constructor(
    @InjectRepository(GrcEvidence)
    private readonly evidenceRepository: Repository<GrcEvidence>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcControlEvidence)
    private readonly controlEvidenceRepository: Repository<GrcControlEvidence>,
    @InjectRepository(GrcTestResult)
    private readonly testResultRepository: Repository<GrcTestResult>,
    @InjectRepository(GrcEvidenceTestResult)
    private readonly evidenceTestResultRepository: Repository<GrcEvidenceTestResult>,
    @InjectRepository(GrcIssue)
    private readonly issueRepository: Repository<GrcIssue>,
    @InjectRepository(GrcIssueEvidence)
    private readonly issueEvidenceRepository: Repository<GrcIssueEvidence>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateEvidenceDto,
    userId: string,
  ): Promise<GrcEvidence> {
    const evidence = this.evidenceRepository.create({
      ...dto,
      tenantId,
      createdBy: userId,
    });

    const saved = await this.evidenceRepository.save(evidence);

    await this.auditService.recordCreate(
      'GrcEvidence',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async findAll(
    tenantId: string,
    filter: EvidenceFilterDto,
  ): Promise<{ items: GrcEvidence[]; total: number }> {
    const {
      type,
      sourceType,
      status,
      controlId,
      testResultId,
      issueId,
      q,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      filter: filterJson,
    } = filter;

    const queryBuilder = this.evidenceRepository
      .createQueryBuilder('evidence')
      .leftJoinAndSelect('evidence.controlEvidence', 'controlEvidence')
      .leftJoinAndSelect('evidence.evidenceTestResults', 'evidenceTestResults')
      .leftJoinAndSelect('evidence.issueEvidence', 'issueEvidence')
      .where('evidence.tenantId = :tenantId', { tenantId })
      .andWhere('evidence.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          const validationErrors = validateFilterAgainstAllowlist(
            parsed.tree,
            EVIDENCE_ALLOWLIST,
          );
          if (validationErrors.length > 0) {
            throw new BadRequestException({
              message: 'Invalid filter',
              errors: validationErrors,
            });
          }
          applyFilterTree(queryBuilder, parsed.tree, EVIDENCE_ALLOWLIST, 'evidence');
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException({
          message: 'Invalid filter JSON',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Legacy individual filters (backward compatibility)
    if (type) {
      queryBuilder.andWhere('evidence.type = :type', { type });
    }
    if (sourceType) {
      queryBuilder.andWhere('evidence.sourceType = :sourceType', {
        sourceType,
      });
    }
    if (status) {
      queryBuilder.andWhere('evidence.status = :status', { status });
    }
    if (controlId) {
      queryBuilder.andWhere('controlEvidence.controlId = :controlId', {
        controlId,
      });
    }
    if (testResultId) {
      queryBuilder.andWhere(
        'evidenceTestResults.testResultId = :testResultId',
        { testResultId },
      );
    }
    if (issueId) {
      queryBuilder.andWhere('issueEvidence.issueId = :issueId', { issueId });
    }

    // Apply quick search using the standardized utility
    const searchTerm = q || search;
    if (searchTerm) {
      applyQuickSearch(queryBuilder, searchTerm, EVIDENCE_SEARCHABLE_COLUMNS, 'evidence');
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`evidence.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcEvidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: [
        'controlEvidence',
        'controlEvidence.control',
        'evidenceTestResults',
        'evidenceTestResults.testResult',
        'issueEvidence',
        'issueEvidence.issue',
        'collectedBy',
      ],
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${id} not found`);
    }

    return evidence;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEvidenceDto,
    userId: string,
  ): Promise<GrcEvidence> {
    const evidence = await this.findOne(tenantId, id);
    const oldValue = { ...evidence };

    Object.assign(evidence, dto, { updatedBy: userId });

    const saved = await this.evidenceRepository.save(evidence);

    await this.auditService.recordUpdate(
      'GrcEvidence',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const evidence = await this.findOne(tenantId, id);

    evidence.isDeleted = true;
    evidence.updatedBy = userId;

    await this.evidenceRepository.save(evidence);

    await this.auditService.recordDelete(
      'GrcEvidence',
      evidence,
      userId,
      tenantId,
    );
  }

  async linkToControl(
    tenantId: string,
    evidenceId: string,
    controlId: string,
    userId: string,
  ): Promise<GrcControlEvidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, tenantId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    const existing = await this.controlEvidenceRepository.findOne({
      where: { evidenceId, controlId, tenantId },
    });

    if (existing) {
      throw new BadRequestException(
        `Evidence ${evidenceId} is already linked to control ${controlId}`,
      );
    }

    const controlEvidence = this.controlEvidenceRepository.create({
      evidenceId,
      controlId,
      tenantId,
      evidenceType: ControlEvidenceType.BASELINE,
    });

    const saved = await this.controlEvidenceRepository.save(controlEvidence);

    await this.auditService.recordCreate(
      'GrcControlEvidence',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async unlinkFromControl(
    tenantId: string,
    evidenceId: string,
    controlId: string,
    userId: string,
  ): Promise<void> {
    const controlEvidence = await this.controlEvidenceRepository.findOne({
      where: { evidenceId, controlId, tenantId },
    });

    if (!controlEvidence) {
      throw new NotFoundException(
        `Evidence ${evidenceId} is not linked to control ${controlId}`,
      );
    }

    await this.controlEvidenceRepository.remove(controlEvidence);

    await this.auditService.recordDelete(
      'GrcControlEvidence',
      controlEvidence,
      userId,
      tenantId,
    );
  }

  async linkToTestResult(
    tenantId: string,
    evidenceId: string,
    testResultId: string,
    userId: string,
    dto?: LinkEvidenceTestResultDto,
  ): Promise<GrcEvidenceTestResult> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, tenantId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    const testResult = await this.testResultRepository.findOne({
      where: { id: testResultId, tenantId, isDeleted: false },
    });

    if (!testResult) {
      throw new NotFoundException(
        `Test result with ID ${testResultId} not found`,
      );
    }

    const existing = await this.evidenceTestResultRepository.findOne({
      where: { evidenceId, testResultId, tenantId },
    });

    if (existing) {
      throw new BadRequestException(
        `Evidence ${evidenceId} is already linked to test result ${testResultId}`,
      );
    }

    const evidenceTestResult = this.evidenceTestResultRepository.create({
      evidenceId,
      testResultId,
      tenantId,
      notes: dto?.notes,
    });

    const saved =
      await this.evidenceTestResultRepository.save(evidenceTestResult);

    await this.auditService.recordCreate(
      'GrcEvidenceTestResult',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async unlinkFromTestResult(
    tenantId: string,
    evidenceId: string,
    testResultId: string,
    userId: string,
  ): Promise<void> {
    const evidenceTestResult = await this.evidenceTestResultRepository.findOne({
      where: { evidenceId, testResultId, tenantId },
    });

    if (!evidenceTestResult) {
      throw new NotFoundException(
        `Evidence ${evidenceId} is not linked to test result ${testResultId}`,
      );
    }

    await this.evidenceTestResultRepository.remove(evidenceTestResult);

    await this.auditService.recordDelete(
      'GrcEvidenceTestResult',
      evidenceTestResult,
      userId,
      tenantId,
    );
  }

  async linkToIssue(
    tenantId: string,
    evidenceId: string,
    issueId: string,
    userId: string,
  ): Promise<GrcIssueEvidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, tenantId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    const issue = await this.issueRepository.findOne({
      where: { id: issueId, tenantId, isDeleted: false },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    const existing = await this.issueEvidenceRepository.findOne({
      where: { evidenceId, issueId, tenantId },
    });

    if (existing) {
      throw new BadRequestException(
        `Evidence ${evidenceId} is already linked to issue ${issueId}`,
      );
    }

    const issueEvidence = this.issueEvidenceRepository.create({
      evidenceId,
      issueId,
      tenantId,
    });

    const saved = await this.issueEvidenceRepository.save(issueEvidence);

    await this.auditService.recordCreate(
      'GrcIssueEvidence',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  async unlinkFromIssue(
    tenantId: string,
    evidenceId: string,
    issueId: string,
    userId: string,
  ): Promise<void> {
    const issueEvidence = await this.issueEvidenceRepository.findOne({
      where: { evidenceId, issueId, tenantId },
    });

    if (!issueEvidence) {
      throw new NotFoundException(
        `Evidence ${evidenceId} is not linked to issue ${issueId}`,
      );
    }

    await this.issueEvidenceRepository.remove(issueEvidence);

    await this.auditService.recordDelete(
      'GrcIssueEvidence',
      issueEvidence,
      userId,
      tenantId,
    );
  }

  async getLinkedControls(
    tenantId: string,
    evidenceId: string,
  ): Promise<GrcControlEvidence[]> {
    await this.findOne(tenantId, evidenceId);

    return this.controlEvidenceRepository.find({
      where: { evidenceId, tenantId },
      relations: ['control'],
      order: { createdAt: 'DESC' },
    });
  }

  async getLinkedTestResults(
    tenantId: string,
    evidenceId: string,
  ): Promise<GrcEvidenceTestResult[]> {
    await this.findOne(tenantId, evidenceId);

    return this.evidenceTestResultRepository.find({
      where: { evidenceId, tenantId },
      relations: ['testResult', 'testResult.controlTest'],
      order: { createdAt: 'DESC' },
    });
  }

  async getLinkedIssues(
    tenantId: string,
    evidenceId: string,
  ): Promise<GrcIssueEvidence[]> {
    await this.findOne(tenantId, evidenceId);

    return this.issueEvidenceRepository.find({
      where: { evidenceId, tenantId },
      relations: ['issue'],
      order: { createdAt: 'DESC' },
    });
  }
}
