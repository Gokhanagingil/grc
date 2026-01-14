import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import {
  GrcIssue,
  GrcControl,
  GrcTestResult,
  GrcIssueEvidence,
  GrcEvidence,
} from '../entities';
import {
  CreateIssueDto,
  UpdateIssueDto,
  IssueFilterDto,
} from '../dto/issue.dto';
import { AuditService } from '../../audit/audit.service';

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

    const searchTerm = q || search;
    if (searchTerm) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(issue.title) LIKE LOWER(:searchTerm)', {
            searchTerm: `%${searchTerm}%`,
          }).orWhere('LOWER(issue.description) LIKE LOWER(:searchTerm)', {
            searchTerm: `%${searchTerm}%`,
          });
        }),
      );
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
}
