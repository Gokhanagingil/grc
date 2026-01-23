import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GrcTestResult,
  GrcControlTest,
  GrcControl,
  GrcStatusHistory,
  GrcEvidenceTestResult,
  GrcEvidence,
} from '../entities';
import { ControlTestStatus, TestMethod, TestResultStatus } from '../enums';
import {
  CreateTestResultDto,
  UpdateTestResultDto,
  ReviewTestResultDto,
  TestResultFilterDto,
} from '../dto/test-result.dto';
import { AuditService } from '../../audit/audit.service';
import { CodeGeneratorService, CodePrefix } from './code-generator.service';

@Injectable()
export class GrcTestResultService {
  // Whitelist of allowed sort fields to prevent SQL injection
  // Test/Result Sprint: Added testDate, method, status to sort allowlist
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'result',
    'effectivenessRating',
    'reviewedAt',
    'testDate',
    'method',
    'status',
  ]);

  constructor(
    @InjectRepository(GrcTestResult)
    private readonly testResultRepository: Repository<GrcTestResult>,
    @InjectRepository(GrcControlTest)
    private readonly controlTestRepository: Repository<GrcControlTest>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcStatusHistory)
    private readonly statusHistoryRepository: Repository<GrcStatusHistory>,
    @InjectRepository(GrcEvidenceTestResult)
    private readonly evidenceTestResultRepository: Repository<GrcEvidenceTestResult>,
    @InjectRepository(GrcEvidence)
    private readonly evidenceRepository: Repository<GrcEvidence>,
    private readonly auditService: AuditService,
    @Optional() private readonly codeGeneratorService?: CodeGeneratorService,
  ) {}

  /**
   * Create a new test result
   *
   * Test/Result Sprint: Now supports two modes:
   * 1. Legacy mode: Create via controlTestId (existing behavior)
   * 2. Direct mode: Create via controlId (new behavior for sprint)
   */
  async create(
    tenantId: string,
    dto: CreateTestResultDto,
    userId: string,
  ): Promise<GrcTestResult> {
    // Test/Result Sprint: Support direct control linkage
    if (dto.controlId && !dto.controlTestId) {
      return this.createDirect(tenantId, dto, userId);
    }

    // Legacy mode: Create via controlTestId
    if (!dto.controlTestId) {
      throw new BadRequestException(
        'Either controlTestId or controlId must be provided',
      );
    }

    const controlTest = await this.controlTestRepository.findOne({
      where: { id: dto.controlTestId, tenantId, isDeleted: false },
      relations: ['control'],
    });

    if (!controlTest) {
      throw new NotFoundException(
        `Control test with ID ${dto.controlTestId} not found`,
      );
    }

    if (controlTest.status !== ControlTestStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot create test result for control test with status ${controlTest.status}. ` +
          `Control test must be IN_PROGRESS.`,
      );
    }

    const existingResult = await this.testResultRepository.findOne({
      where: { controlTestId: dto.controlTestId, tenantId, isDeleted: false },
    });

    if (existingResult) {
      throw new BadRequestException(
        `A test result already exists for control test ${dto.controlTestId}`,
      );
    }

    // Generate code if not provided
    let code: string | undefined;
    if (this.codeGeneratorService) {
      code = await this.codeGeneratorService.generateCode(
        tenantId,
        CodePrefix.TEST_RESULT,
      );
    }

    const testResult = this.testResultRepository.create({
      ...dto,
      code,
      tenantId,
      // Also set controlId from the control test's control
      controlId: controlTest.control?.id || null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.testResultRepository.save(testResult);

    controlTest.status = ControlTestStatus.COMPLETED;
    controlTest.completedAt = new Date();
    controlTest.updatedBy = userId;
    await this.controlTestRepository.save(controlTest);

    await this.createStatusHistory(
      tenantId,
      controlTest.id,
      ControlTestStatus.IN_PROGRESS,
      ControlTestStatus.COMPLETED,
      userId,
      'Test result recorded',
    );

    if (controlTest.control) {
      controlTest.control.lastTestResult = dto.result;
      controlTest.control.lastTestedDate = new Date();
      controlTest.control.updatedBy = userId;
      await this.controlRepository.save(controlTest.control);
    }

    await this.auditService.recordCreate(
      'GrcTestResult',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Test/Result Sprint: Create test result directly linked to a control
   * This bypasses the ControlTest requirement for simpler test result creation.
   */
  private async createDirect(
    tenantId: string,
    dto: CreateTestResultDto,
    userId: string,
  ): Promise<GrcTestResult> {
    // Verify control exists and belongs to tenant
    const control = await this.controlRepository.findOne({
      where: { id: dto.controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${dto.controlId} not found`);
    }

    // Generate code if not provided
    let code: string | undefined;
    if (this.codeGeneratorService) {
      code = await this.codeGeneratorService.generateCode(
        tenantId,
        CodePrefix.TEST_RESULT,
      );
    }

    const testResult = this.testResultRepository.create({
      ...dto,
      code,
      tenantId,
      controlId: dto.controlId,
      testDate: dto.testDate ? new Date(dto.testDate) : new Date(),
      method: dto.method || TestMethod.OTHER,
      status: dto.status || TestResultStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.testResultRepository.save(testResult);

    // Update control's last test info
    control.lastTestResult = dto.result;
    control.lastTestedDate = new Date();
    control.updatedBy = userId;
    await this.controlRepository.save(control);

    await this.auditService.recordCreate(
      'GrcTestResult',
      saved,
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * List Contract v1 compliant findAll method
   *
   * Test/Result Sprint: Enhanced with:
   * - q (text search on summary)
   * - controlId filter
   * - method filter
   * - status filter
   * - testDate range filters (testDateAfter, testDateBefore)
   * - Evidence count loading
   */
  async findAll(
    tenantId: string,
    filter: TestResultFilterDto,
  ): Promise<{ items: GrcTestResult[]; total: number }> {
    const {
      controlTestId,
      controlId,
      result,
      method,
      status,
      effectivenessRating,
      testDateAfter,
      testDateBefore,
      q,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const queryBuilder = this.testResultRepository
      .createQueryBuilder('testResult')
      .leftJoinAndSelect('testResult.controlTest', 'controlTest')
      .leftJoinAndSelect('controlTest.control', 'ctControl')
      .leftJoinAndSelect('testResult.control', 'directControl')
      .leftJoinAndSelect('testResult.reviewedBy', 'reviewedBy')
      .leftJoinAndSelect(
        'testResult.evidenceTestResults',
        'evidenceTestResults',
      )
      .where('testResult.tenantId = :tenantId', { tenantId })
      .andWhere('testResult.isDeleted = :isDeleted', { isDeleted: false });

    if (controlTestId) {
      queryBuilder.andWhere('testResult.controlTestId = :controlTestId', {
        controlTestId,
      });
    }

    // Test/Result Sprint: Direct control filter
    if (controlId) {
      queryBuilder.andWhere('testResult.controlId = :controlId', {
        controlId,
      });
    }

    if (result) {
      queryBuilder.andWhere('testResult.result = :result', { result });
    }

    // Test/Result Sprint: Method filter
    if (method) {
      queryBuilder.andWhere('testResult.method = :method', { method });
    }

    // Test/Result Sprint: Status filter
    if (status) {
      queryBuilder.andWhere('testResult.status = :status', { status });
    }

    if (effectivenessRating) {
      queryBuilder.andWhere(
        'testResult.effectivenessRating = :effectivenessRating',
        { effectivenessRating },
      );
    }

    // Test/Result Sprint: Date range filters
    if (testDateAfter) {
      queryBuilder.andWhere('testResult.testDate >= :testDateAfter', {
        testDateAfter,
      });
    }
    if (testDateBefore) {
      queryBuilder.andWhere('testResult.testDate <= :testDateBefore', {
        testDateBefore,
      });
    }

    // Test/Result Sprint: Text search on summary
    if (q) {
      queryBuilder.andWhere('testResult.summary ILIKE :q', { q: `%${q}%` });
    }

    // Validate sortBy to prevent SQL injection
    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`testResult.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  /**
   * Test/Result Sprint: Find test results by control ID
   * Control-centric navigation endpoint
   */
  async findByControlId(
    tenantId: string,
    controlId: string,
    filter: TestResultFilterDto,
  ): Promise<{ items: GrcTestResult[]; total: number }> {
    // Verify control exists and belongs to tenant
    const control = await this.controlRepository.findOne({
      where: { id: controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${controlId} not found`);
    }

    // Use findAll with controlId filter
    return this.findAll(tenantId, { ...filter, controlId });
  }

  async findOne(tenantId: string, id: string): Promise<GrcTestResult> {
    const testResult = await this.testResultRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['controlTest', 'controlTest.control', 'reviewedBy'],
    });

    if (!testResult) {
      throw new NotFoundException(`Test result with ID ${id} not found`);
    }

    return testResult;
  }

  async findByControlTestId(
    tenantId: string,
    controlTestId: string,
  ): Promise<GrcTestResult | null> {
    return this.testResultRepository.findOne({
      where: { controlTestId, tenantId, isDeleted: false },
      relations: ['controlTest', 'reviewedBy'],
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTestResultDto,
    userId: string,
  ): Promise<GrcTestResult> {
    const testResult = await this.findOne(tenantId, id);
    const oldValue = { ...testResult };

    Object.assign(testResult, dto, { updatedBy: userId });

    const saved = await this.testResultRepository.save(testResult);

    await this.auditService.recordUpdate(
      'GrcTestResult',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async review(
    tenantId: string,
    id: string,
    dto: ReviewTestResultDto,
    userId: string,
  ): Promise<GrcTestResult> {
    const testResult = await this.findOne(tenantId, id);

    if (testResult.reviewedAt) {
      throw new BadRequestException('Test result has already been reviewed');
    }

    testResult.reviewedAt = new Date();
    testResult.reviewedByUserId = userId;
    testResult.updatedBy = userId;

    if (dto.reviewNotes) {
      testResult.metadata = {
        ...testResult.metadata,
        reviewNotes: dto.reviewNotes,
      };
    }

    const saved = await this.testResultRepository.save(testResult);

    await this.auditService.recordUpdate(
      'GrcTestResult',
      saved.id,
      { reviewedAt: null, reviewedByUserId: null },
      {
        reviewedAt: saved.reviewedAt,
        reviewedByUserId: saved.reviewedByUserId,
      },
      userId,
      tenantId,
    );

    return saved;
  }

  async softDelete(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<void> {
    const testResult = await this.findOne(tenantId, id);

    testResult.isDeleted = true;
    testResult.updatedBy = userId;

    await this.testResultRepository.save(testResult);

    await this.auditService.recordDelete(
      'GrcTestResult',
      testResult,
      userId,
      tenantId,
    );
  }

  // ============================================================================
  // Test/Result Sprint: Evidence Linking Methods
  // ============================================================================

  /**
   * Get all evidences linked to a test result
   */
  async getEvidences(
    tenantId: string,
    testResultId: string,
  ): Promise<GrcEvidence[]> {
    // Verify test result exists and belongs to tenant
    await this.findOne(tenantId, testResultId);

    const links = await this.evidenceTestResultRepository.find({
      where: { testResultId, tenantId },
      relations: ['evidence'],
    });

    return links.map((link) => link.evidence);
  }

  /**
   * Link an evidence to a test result
   * Prevents cross-tenant linking
   */
  async linkEvidence(
    tenantId: string,
    testResultId: string,
    evidenceId: string,
    userId: string,
  ): Promise<GrcEvidenceTestResult> {
    // Verify test result exists and belongs to tenant
    await this.findOne(tenantId, testResultId);

    // Verify evidence exists and belongs to same tenant
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId, tenantId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    // Check if link already exists
    const existingLink = await this.evidenceTestResultRepository.findOne({
      where: { testResultId, evidenceId, tenantId },
    });

    if (existingLink) {
      throw new BadRequestException(
        `Evidence ${evidenceId} is already linked to test result ${testResultId}`,
      );
    }

    const link = this.evidenceTestResultRepository.create({
      tenantId,
      testResultId,
      evidenceId,
    });

    const saved = await this.evidenceTestResultRepository.save(link);

    await this.auditService.recordCreate(
      'GrcEvidenceTestResult',
      { id: saved.id },
      userId,
      tenantId,
    );

    return saved;
  }

  /**
   * Unlink an evidence from a test result
   */
  async unlinkEvidence(
    tenantId: string,
    testResultId: string,
    evidenceId: string,
    userId: string,
  ): Promise<void> {
    // Verify test result exists and belongs to tenant
    await this.findOne(tenantId, testResultId);

    const link = await this.evidenceTestResultRepository.findOne({
      where: { testResultId, evidenceId, tenantId },
    });

    if (!link) {
      throw new NotFoundException(
        `Evidence ${evidenceId} is not linked to test result ${testResultId}`,
      );
    }

    await this.evidenceTestResultRepository.remove(link);

    await this.auditService.recordDelete(
      'GrcEvidenceTestResult',
      link,
      userId,
      tenantId,
    );
  }

  /**
   * Get evidence count for a test result
   */
  async getEvidenceCount(
    tenantId: string,
    testResultId: string,
  ): Promise<number> {
    return this.evidenceTestResultRepository.count({
      where: { testResultId, tenantId },
    });
  }

  private async createStatusHistory(
    tenantId: string,
    entityId: string,
    previousStatus: string | null,
    newStatus: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const history = this.statusHistoryRepository.create({
      tenantId,
      entityType: 'CONTROL_TEST',
      entityId,
      previousStatus,
      newStatus,
      changedByUserId: userId,
      changeReason: reason,
    });

    await this.statusHistoryRepository.save(history);
  }
}
