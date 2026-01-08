import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GrcTestResult,
  GrcControlTest,
  GrcControl,
  GrcStatusHistory,
} from '../entities';
import { ControlTestStatus } from '../enums';
import {
  CreateTestResultDto,
  UpdateTestResultDto,
  ReviewTestResultDto,
  TestResultFilterDto,
} from '../dto/test-result.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class GrcTestResultService {
  // Whitelist of allowed sort fields to prevent SQL injection
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'result',
    'effectivenessRating',
    'reviewedAt',
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
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateTestResultDto,
    userId: string,
  ): Promise<GrcTestResult> {
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

    const testResult = this.testResultRepository.create({
      ...dto,
      tenantId,
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

  async findAll(
    tenantId: string,
    filter: TestResultFilterDto,
  ): Promise<{ items: GrcTestResult[]; total: number }> {
    const {
      controlTestId,
      result,
      effectivenessRating,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const queryBuilder = this.testResultRepository
      .createQueryBuilder('testResult')
      .leftJoinAndSelect('testResult.controlTest', 'controlTest')
      .leftJoinAndSelect('controlTest.control', 'control')
      .leftJoinAndSelect('testResult.reviewedBy', 'reviewedBy')
      .where('testResult.tenantId = :tenantId', { tenantId })
      .andWhere('testResult.isDeleted = :isDeleted', { isDeleted: false });

    if (controlTestId) {
      queryBuilder.andWhere('testResult.controlTestId = :controlTestId', {
        controlTestId,
      });
    }
    if (result) {
      queryBuilder.andWhere('testResult.result = :result', { result });
    }
    if (effectivenessRating) {
      queryBuilder.andWhere(
        'testResult.effectivenessRating = :effectivenessRating',
        { effectivenessRating },
      );
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
