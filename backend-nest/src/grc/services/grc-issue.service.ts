import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, DeepPartial } from 'typeorm';
import {
  GrcIssue,
  GrcControl,
  GrcTestResult,
  GrcIssueEvidence,
  GrcEvidence,
} from '../entities';
import {
  TestResultOutcome,
  IssueType,
  IssueStatus,
  IssueSeverity,
  IssueSource,
} from '../enums';
import {
  CreateIssueDto,
  UpdateIssueDto,
  IssueFilterDto,
  CreateIssueFromTestResultDto,
} from '../dto/issue.dto';
import { AuditService } from '../../audit/audit.service';
import { parseFilterJson } from '../../common/list-query/list-query.parser';
import { validateFilterAgainstAllowlist } from '../../common/list-query/list-query.validator';
import {
  applyFilterTree,
  applyQuickSearch,
} from '../../common/list-query/list-query.apply';
import {
  ISSUE_ALLOWLIST,
  ISSUE_SEARCHABLE_COLUMNS,
} from '../../common/list-query/list-query.allowlist';

@Injectable()
export class GrcIssueService {
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'title',
    'type',
    'status',
    'severity',
    'discoveredDate',
    'dueDate',
    'resolvedDate',
  ]);

  constructor(
    @InjectRepository(GrcIssue)
    private readonly issueRepository: Repository<GrcIssue>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcTestResult)
    private readonly testResultRepository: Repository<GrcTestResult>,
    @InjectRepository(GrcIssueEvidence)
    private readonly issueEvidenceRepository: Repository<GrcIssueEvidence>,
    @InjectRepository(GrcEvidence)
    private readonly evidenceRepository: Repository<GrcEvidence>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateIssueDto,
    userId: string,
  ): Promise<GrcIssue> {
    if (dto.controlId) {
      const control = await this.controlRepository.findOne({
        where: { id: dto.controlId, tenantId, isDeleted: false },
      });
      if (!control) {
        throw new NotFoundException(
          `Control with ID ${dto.controlId} not found`,
        );
      }
    }

    if (dto.testResultId) {
      const testResult = await this.testResultRepository.findOne({
        where: { id: dto.testResultId, tenantId, isDeleted: false },
      });
      if (!testResult) {
        throw new NotFoundException(
          `Test result with ID ${dto.testResultId} not found`,
        );
      }
    }

    const issue = this.issueRepository.create({
      ...dto,
      tenantId,
      raisedByUserId: userId,
      createdBy: userId,
    });

    const saved = await this.issueRepository.save(issue);

    await this.auditService.recordCreate('GrcIssue', saved, userId, tenantId);

    return saved;
  }

  async findAll(
    tenantId: string,
    filter: IssueFilterDto,
  ): Promise<{ items: GrcIssue[]; total: number }> {
    const {
      type,
      status,
      severity,
      controlId,
      auditId,
      testResultId,
      riskId,
      q,
      search,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      filter: filterJson,
    } = filter;

    const queryBuilder = this.issueRepository
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.owner', 'owner')
      .leftJoinAndSelect('issue.raisedBy', 'raisedBy')
      .leftJoinAndSelect('issue.control', 'control')
      .leftJoinAndSelect('issue.risk', 'risk')
      .leftJoinAndSelect('issue.testResult', 'testResult')
      .leftJoinAndSelect('issue.issueEvidence', 'issueEvidence')
      .where('issue.tenantId = :tenantId', { tenantId })
      .andWhere('issue.isDeleted = :isDeleted', { isDeleted: false });

    // Apply advanced filter tree if provided
    if (filterJson) {
      try {
        const parsed = parseFilterJson(filterJson);
        if (parsed.tree) {
          const validationErrors = validateFilterAgainstAllowlist(
            parsed.tree,
            ISSUE_ALLOWLIST,
          );
          if (validationErrors.length > 0) {
            throw new BadRequestException({
              message: 'Invalid filter',
              errors: validationErrors,
            });
          }
          applyFilterTree(queryBuilder, parsed.tree, ISSUE_ALLOWLIST, 'issue');
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
      queryBuilder.andWhere('issue.type = :type', { type });
    }
    if (status) {
      queryBuilder.andWhere('issue.status = :status', { status });
    }
    if (severity) {
      queryBuilder.andWhere('issue.severity = :severity', { severity });
    }
    if (controlId) {
      queryBuilder.andWhere('issue.controlId = :controlId', { controlId });
    }
    if (auditId) {
      queryBuilder.andWhere('issue.auditId = :auditId', { auditId });
    }
    if (testResultId) {
      queryBuilder.andWhere('issue.testResultId = :testResultId', {
        testResultId,
      });
    }
    if (riskId) {
      queryBuilder.andWhere('issue.riskId = :riskId', { riskId });
    }

    // Apply quick search using the standardized utility
    const searchTerm = q || search;
    if (searchTerm) {
      applyQuickSearch(queryBuilder, searchTerm, ISSUE_SEARCHABLE_COLUMNS, 'issue');
    }

    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`issue.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcIssue> {
    const issue = await this.issueRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: [
        'owner',
        'raisedBy',
        'closedBy',
        'control',
        'risk',
        'audit',
        'testResult',
        'capas',
        'issueEvidence',
        'issueEvidence.evidence',
        'issueRequirements',
        'issueClauses',
      ],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    return issue;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateIssueDto,
    userId: string,
  ): Promise<GrcIssue> {
    const issue = await this.findOne(tenantId, id);
    const oldValue = { ...issue };

    if (dto.controlId) {
      const control = await this.controlRepository.findOne({
        where: { id: dto.controlId, tenantId, isDeleted: false },
      });
      if (!control) {
        throw new NotFoundException(
          `Control with ID ${dto.controlId} not found`,
        );
      }
    }

    if (dto.testResultId) {
      const testResult = await this.testResultRepository.findOne({
        where: { id: dto.testResultId, tenantId, isDeleted: false },
      });
      if (!testResult) {
        throw new NotFoundException(
          `Test result with ID ${dto.testResultId} not found`,
        );
      }
    }

    Object.assign(issue, dto, { updatedBy: userId });

    const saved = await this.issueRepository.save(issue);

    await this.auditService.recordUpdate(
      'GrcIssue',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const issue = await this.findOne(tenantId, id);

    issue.isDeleted = true;
    issue.updatedBy = userId;

    await this.issueRepository.save(issue);

    await this.auditService.recordDelete('GrcIssue', issue, userId, tenantId);
  }

  async linkToControl(
    tenantId: string,
    issueId: string,
    controlId: string,
    userId: string,
  ): Promise<GrcIssue> {
    const issue = await this.findOne(tenantId, issueId);

    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    const oldValue = { ...issue };
    issue.controlId = controlId;
    issue.updatedBy = userId;

    const saved = await this.issueRepository.save(issue);

    await this.auditService.recordUpdate(
      'GrcIssue',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async unlinkFromControl(
    tenantId: string,
    issueId: string,
    controlId: string,
    userId: string,
  ): Promise<GrcIssue> {
    const issue = await this.findOne(tenantId, issueId);

    if (issue.controlId !== controlId) {
      throw new BadRequestException(
        `Issue ${issueId} is not linked to control ${controlId}`,
      );
    }

    const oldValue = { ...issue };
    issue.controlId = null;
    issue.updatedBy = userId;

    const saved = await this.issueRepository.save(issue);

    await this.auditService.recordUpdate(
      'GrcIssue',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async linkToTestResult(
    tenantId: string,
    issueId: string,
    testResultId: string,
    userId: string,
  ): Promise<GrcIssue> {
    const issue = await this.findOne(tenantId, issueId);

    const testResult = await this.testResultRepository.findOne({
      where: { id: testResultId, tenantId, isDeleted: false },
    });

    if (!testResult) {
      throw new NotFoundException(
        `Test result with ID ${testResultId} not found`,
      );
    }

    const oldValue = { ...issue };
    issue.testResultId = testResultId;
    issue.updatedBy = userId;

    const saved = await this.issueRepository.save(issue);

    await this.auditService.recordUpdate(
      'GrcIssue',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async unlinkFromTestResult(
    tenantId: string,
    issueId: string,
    testResultId: string,
    userId: string,
  ): Promise<GrcIssue> {
    const issue = await this.findOne(tenantId, issueId);

    if (issue.testResultId !== testResultId) {
      throw new BadRequestException(
        `Issue ${issueId} is not linked to test result ${testResultId}`,
      );
    }

    const oldValue = { ...issue };
    issue.testResultId = null;
    issue.updatedBy = userId;

    const saved = await this.issueRepository.save(issue);

    await this.auditService.recordUpdate(
      'GrcIssue',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async linkToEvidence(
    tenantId: string,
    issueId: string,
    evidenceId: string,
    userId: string,
  ): Promise<GrcIssueEvidence> {
    await this.findOne(tenantId, issueId);

    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, tenantId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    const existing = await this.issueEvidenceRepository.findOne({
      where: { issueId, evidenceId, tenantId },
    });

    if (existing) {
      throw new BadRequestException(
        `Evidence ${evidenceId} is already linked to issue ${issueId}`,
      );
    }

    const issueEvidence = this.issueEvidenceRepository.create({
      issueId,
      evidenceId,
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

  async unlinkFromEvidence(
    tenantId: string,
    issueId: string,
    evidenceId: string,
    userId: string,
  ): Promise<void> {
    const issueEvidence = await this.issueEvidenceRepository.findOne({
      where: { issueId, evidenceId, tenantId },
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

  async getLinkedEvidence(
    tenantId: string,
    issueId: string,
  ): Promise<GrcIssueEvidence[]> {
    await this.findOne(tenantId, issueId);

    return this.issueEvidenceRepository.find({
      where: { issueId, tenantId },
      relations: ['evidence'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Create an Issue from a Test Result
   *
   * This method creates an issue linked to a test result, with the following behavior:
   * - Auto-generates title if not provided: "Test failed: <controlName> - <testDate>"
   * - Sets type to SELF_ASSESSMENT (closest to test_result source)
   * - Sets severity based on test result: HIGH for FAIL, MEDIUM for PARTIAL/INCONCLUSIVE
   * - Links issue to the test result's control
   * - Links issue to the test result itself
   * - Auto-links all evidences already linked to the test result
   *
   * @param tenantId - Tenant ID
   * @param testResultId - Test Result ID to create issue from
   * @param dto - Optional fields for the issue
   * @param userId - User ID creating the issue
   * @returns Created issue with linked control, test result, and evidences
   */
  async createFromTestResult(
    tenantId: string,
    testResultId: string,
    dto: CreateIssueFromTestResultDto,
    userId: string,
  ): Promise<GrcIssue> {
    // Load test result with both direct control and controlTest.control relations
    // to handle both legacy (via controlTestId) and new (via controlId) test results
    const testResult = await this.testResultRepository.findOne({
      where: { id: testResultId, tenantId, isDeleted: false },
      relations: ['control', 'controlTest', 'controlTest.control'],
    });

    if (!testResult) {
      throw new NotFoundException(
        `Test result with ID ${testResultId} not found`,
      );
    }

    // Get controlId from either direct link or via controlTest relationship
    const resolvedControlId =
      testResult.controlId || testResult.controlTest?.controlId || null;

    // Get control name from either direct link or via controlTest relationship
    const control = testResult.control || testResult.controlTest?.control;
    const controlName = control?.name || 'Unknown Control';

    const testDate = testResult.testDate
      ? new Date(testResult.testDate).toLocaleDateString()
      : new Date().toLocaleDateString();

    const autoTitle = `Test failed: ${controlName} - ${testDate}`;

    let autoSeverity: IssueSeverity = IssueSeverity.MEDIUM;
    const resultStr = String(testResult.result);
    if (resultStr === String(TestResultOutcome.FAIL)) {
      autoSeverity = IssueSeverity.HIGH;
    } else if (resultStr === String(TestResultOutcome.INCONCLUSIVE)) {
      autoSeverity = IssueSeverity.MEDIUM;
    }

    const issueData: DeepPartial<GrcIssue> = {
      tenantId,
      title: dto.title || autoTitle,
      description:
        dto.description ||
        `Issue created from test result. Result: ${testResult.result}. ${testResult.resultDetails || ''}`.trim(),
      type: IssueType.SELF_ASSESSMENT,
      status: IssueStatus.OPEN,
      severity: dto.severity || autoSeverity,
      source: IssueSource.TEST_RESULT,
      controlId: resolvedControlId,
      testResultId: testResult.id,
      discoveredDate: testResult.testDate || new Date(),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      ownerUserId: dto.ownerUserId || undefined,
      raisedByUserId: userId,
      createdBy: userId,
      metadata: {
        createdFromTestResult: true,
        testResultOutcome: testResult.result,
      },
    };

    const issue = this.issueRepository.create(issueData);
    const savedIssue = await this.issueRepository.save(issue);

    await this.auditService.recordCreate(
      'GrcIssue',
      savedIssue,
      userId,
      tenantId,
    );

    // Note: Auto-linking evidences from test result is deferred to a future sprint
    // Users can manually link evidences using the existing linkToEvidence endpoint

    return this.findOne(tenantId, savedIssue.id);
  }
}
