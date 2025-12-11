import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { ControlResult } from '../entities/control-result.entity';
import { ProcessControl } from '../entities/process-control.entity';
import { ProcessViolation } from '../entities/process-violation.entity';
import {
  ControlResultType,
  ViolationSeverity,
  ViolationStatus,
  ControlResultSource,
} from '../enums';
import {
  ControlResultFilterDto,
  CONTROL_RESULT_SORTABLE_FIELDS,
  PaginatedResponse,
  createPaginatedResponse,
} from '../dto';
import { AuditService } from '../../audit/audit.service';

/**
 * ControlResult Service
 *
 * Multi-tenant service for managing control execution results.
 * Automatically creates ProcessViolation when a non-compliant result is recorded.
 * Extends MultiTenantServiceBase for tenant-aware CRUD operations.
 */
@Injectable()
export class ControlResultService extends MultiTenantServiceBase<ControlResult> {
  constructor(
    @InjectRepository(ControlResult)
    repository: Repository<ControlResult>,
    @InjectRepository(ProcessControl)
    private readonly controlRepository: Repository<ProcessControl>,
    @InjectRepository(ProcessViolation)
    private readonly violationRepository: Repository<ProcessViolation>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditService?: AuditService,
  ) {
    super(repository);
  }

  /**
   * Create a new control result
   * Automatically creates a ProcessViolation if isCompliant is false
   */
  async createControlResult(
    tenantId: string,
    userId: string,
    data: {
      controlId: string;
      executionDate?: Date;
      executorUserId?: string;
      source?: ControlResultSource;
      resultValueBoolean?: boolean;
      resultValueNumber?: number;
      resultValueText?: string;
      isCompliant: boolean;
      evidenceReference?: string;
    },
  ): Promise<ControlResult> {
    // Verify control exists and get its expected result type
    const control = await this.controlRepository.findOne({
      where: { id: data.controlId, tenantId, isDeleted: false },
      relations: ['process'],
    });

    if (!control) {
      throw new NotFoundException(
        `ProcessControl with ID ${data.controlId} not found`,
      );
    }

    // Validate result value based on expected result type
    this.validateResultValue(control.expectedResultType, data);

    // Create the control result
    const result = await this.createForTenant(tenantId, {
      controlId: data.controlId,
      executionDate: data.executionDate || new Date(),
      executorUserId: data.executorUserId || userId,
      source: data.source || ControlResultSource.MANUAL,
      resultValueBoolean: data.resultValueBoolean,
      resultValueNumber: data.resultValueNumber,
      resultValueText: data.resultValueText,
      isCompliant: data.isCompliant,
      evidenceReference: data.evidenceReference,
      createdBy: userId,
      isDeleted: false,
    });

    await this.auditService?.recordCreate(
      'ControlResult',
      result,
      userId,
      tenantId,
    );

    // If non-compliant, automatically create a violation
    if (!data.isCompliant) {
      await this.createViolationForResult(tenantId, userId, result, control);
    }

    this.eventEmitter.emit('controlResult.created', {
      resultId: result.id,
      controlId: result.controlId,
      processId: control.processId,
      tenantId,
      userId,
      isCompliant: result.isCompliant,
    });

    return result;
  }

  /**
   * Validate that the correct result value field is provided based on expected result type
   */
  private validateResultValue(
    expectedResultType: ControlResultType,
    data: {
      resultValueBoolean?: boolean;
      resultValueNumber?: number;
      resultValueText?: string;
    },
  ): void {
    switch (expectedResultType) {
      case ControlResultType.BOOLEAN:
        if (data.resultValueBoolean === undefined) {
          throw new BadRequestException(
            'resultValueBoolean is required for BOOLEAN control type',
          );
        }
        break;
      case ControlResultType.NUMERIC:
        if (data.resultValueNumber === undefined) {
          throw new BadRequestException(
            'resultValueNumber is required for NUMERIC control type',
          );
        }
        break;
      case ControlResultType.QUALITATIVE:
        if (!data.resultValueText) {
          throw new BadRequestException(
            'resultValueText is required for QUALITATIVE control type',
          );
        }
        break;
    }
  }

  /**
   * Create a ProcessViolation for a non-compliant result
   */
  private async createViolationForResult(
    tenantId: string,
    userId: string,
    result: ControlResult,
    control: ProcessControl,
  ): Promise<ProcessViolation> {
    // Check if a violation already exists for this result
    const existingViolation = await this.violationRepository.findOne({
      where: { tenantId, controlResultId: result.id },
    });

    if (existingViolation) {
      return existingViolation;
    }

    // Generate violation title
    const executionDateStr = result.executionDate.toISOString().split('T')[0];
    const title = `Violation: ${control.name} - ${executionDateStr}`;

    // Create the violation
    const violation = this.violationRepository.create({
      tenantId,
      controlId: control.id,
      controlResultId: result.id,
      severity: ViolationSeverity.MEDIUM, // Default severity
      status: ViolationStatus.OPEN,
      title,
      description: `Non-compliant result recorded for control "${control.name}" on ${executionDateStr}`,
      createdBy: userId,
      isDeleted: false,
    });

    const savedViolation = await this.violationRepository.save(violation);

    await this.auditService?.recordCreate(
      'ProcessViolation',
      savedViolation,
      userId,
      tenantId,
    );

    this.eventEmitter.emit('processViolation.created', {
      violationId: savedViolation.id,
      controlId: control.id,
      controlResultId: result.id,
      processId: control.processId,
      tenantId,
      userId,
    });

    return savedViolation;
  }

  /**
   * Find one control result for a tenant
   */
  async findOneForTenantById(
    tenantId: string,
    id: string,
  ): Promise<ControlResult | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  /**
   * Find one control result with relations
   */
  async findWithRelations(
    tenantId: string,
    id: string,
  ): Promise<ControlResult | null> {
    return this.repository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['control', 'control.process', 'executor', 'violation'],
    });
  }

  /**
   * Find all results for a control
   */
  async findByControl(
    tenantId: string,
    controlId: string,
  ): Promise<ControlResult[]> {
    return this.repository.find({
      where: { tenantId, controlId, isDeleted: false },
      order: { executionDate: 'DESC' },
    });
  }

  /**
   * Find control results with pagination, sorting, and filtering
   */
  async findWithFilters(
    tenantId: string,
    filterDto: ControlResultFilterDto,
  ): Promise<PaginatedResponse<ControlResult>> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'executionDate',
      sortOrder = 'DESC',
      processId,
      controlId,
      isCompliant,
      source,
      executionDateFrom,
      executionDateTo,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('result');
    qb.leftJoinAndSelect('result.control', 'control');

    qb.where('result.tenantId = :tenantId', { tenantId });
    qb.andWhere('result.isDeleted = :isDeleted', { isDeleted: false });

    if (processId) {
      qb.andWhere('control.processId = :processId', { processId });
    }

    if (controlId) {
      qb.andWhere('result.controlId = :controlId', { controlId });
    }

    if (isCompliant !== undefined) {
      qb.andWhere('result.isCompliant = :isCompliant', { isCompliant });
    }

    if (source) {
      qb.andWhere('result.source = :source', { source });
    }

    if (executionDateFrom) {
      qb.andWhere('result.executionDate >= :executionDateFrom', {
        executionDateFrom,
      });
    }

    if (executionDateTo) {
      qb.andWhere('result.executionDate <= :executionDateTo', {
        executionDateTo,
      });
    }

    const total = await qb.getCount();

    const validSortBy = CONTROL_RESULT_SORTABLE_FIELDS.includes(sortBy)
      ? sortBy
      : 'executionDate';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`result.${validSortBy}`, validSortOrder);

    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();

    return createPaginatedResponse(items, total, page, pageSize);
  }

  /**
   * Get results for compliance score calculation
   */
  async getResultsForComplianceScore(
    tenantId: string,
    processId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<{ compliant: number; total: number }> {
    const qb = this.repository.createQueryBuilder('result');
    qb.leftJoin('result.control', 'control');

    qb.where('result.tenantId = :tenantId', { tenantId });
    qb.andWhere('result.isDeleted = :isDeleted', { isDeleted: false });
    qb.andWhere('control.processId = :processId', { processId });
    qb.andWhere('control.isDeleted = :controlDeleted', {
      controlDeleted: false,
    });

    if (fromDate) {
      qb.andWhere('result.executionDate >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('result.executionDate <= :toDate', { toDate });
    }

    const total = await qb.getCount();

    qb.andWhere('result.isCompliant = :isCompliant', { isCompliant: true });
    const compliant = await qb.getCount();

    return { compliant, total };
  }
}
