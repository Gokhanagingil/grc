import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrcControlEvidence, GrcControl, GrcEvidence } from '../entities';
import {
  CreateControlEvidenceDto,
  UpdateControlEvidenceDto,
  ControlEvidenceFilterDto,
} from '../dto/control-evidence.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class GrcControlEvidenceService {
  // Whitelist of allowed sort fields to prevent SQL injection
  private readonly allowedSortFields: Set<string> = new Set([
    'createdAt',
    'updatedAt',
    'evidenceType',
    'validFrom',
    'validUntil',
  ]);

  constructor(
    @InjectRepository(GrcControlEvidence)
    private readonly controlEvidenceRepository: Repository<GrcControlEvidence>,
    @InjectRepository(GrcControl)
    private readonly controlRepository: Repository<GrcControl>,
    @InjectRepository(GrcEvidence)
    private readonly evidenceRepository: Repository<GrcEvidence>,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    dto: CreateControlEvidenceDto,
    userId: string,
  ): Promise<GrcControlEvidence> {
    const control = await this.controlRepository.findOne({
      where: { id: dto.controlId, tenantId, isDeleted: false },
    });

    if (!control) {
      throw new NotFoundException(`Control with ID ${dto.controlId} not found`);
    }

    const evidence = await this.evidenceRepository.findOne({
      where: { id: dto.evidenceId, tenantId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException(
        `Evidence with ID ${dto.evidenceId} not found`,
      );
    }

    const existing = await this.controlEvidenceRepository.findOne({
      where: {
        controlId: dto.controlId,
        evidenceId: dto.evidenceId,
        tenantId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Evidence ${dto.evidenceId} is already linked to control ${dto.controlId}`,
      );
    }

    const controlEvidence = this.controlEvidenceRepository.create({
      ...dto,
      tenantId,
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

  async findAll(
    tenantId: string,
    filter: ControlEvidenceFilterDto,
  ): Promise<{ items: GrcControlEvidence[]; total: number }> {
    const {
      controlId,
      evidenceId,
      evidenceType,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filter;

    const queryBuilder = this.controlEvidenceRepository
      .createQueryBuilder('controlEvidence')
      .leftJoinAndSelect('controlEvidence.control', 'control')
      .leftJoinAndSelect('controlEvidence.evidence', 'evidence')
      .where('controlEvidence.tenantId = :tenantId', { tenantId });

    if (controlId) {
      queryBuilder.andWhere('controlEvidence.controlId = :controlId', {
        controlId,
      });
    }
    if (evidenceId) {
      queryBuilder.andWhere('controlEvidence.evidenceId = :evidenceId', {
        evidenceId,
      });
    }
    if (evidenceType) {
      queryBuilder.andWhere('controlEvidence.evidenceType = :evidenceType', {
        evidenceType,
      });
    }

    // Validate sortBy to prevent SQL injection
    const safeSortBy = this.allowedSortFields.has(sortBy)
      ? sortBy
      : 'createdAt';

    const [items, total] = await queryBuilder
      .orderBy(`controlEvidence.${safeSortBy}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<GrcControlEvidence> {
    const controlEvidence = await this.controlEvidenceRepository.findOne({
      where: { id, tenantId },
      relations: ['control', 'evidence'],
    });

    if (!controlEvidence) {
      throw new NotFoundException(
        `Control evidence link with ID ${id} not found`,
      );
    }

    return controlEvidence;
  }

  async findByControlId(
    tenantId: string,
    controlId: string,
  ): Promise<GrcControlEvidence[]> {
    return this.controlEvidenceRepository.find({
      where: { controlId, tenantId },
      relations: ['evidence'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByEvidenceId(
    tenantId: string,
    evidenceId: string,
  ): Promise<GrcControlEvidence[]> {
    return this.controlEvidenceRepository.find({
      where: { evidenceId, tenantId },
      relations: ['control'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateControlEvidenceDto,
    userId: string,
  ): Promise<GrcControlEvidence> {
    const controlEvidence = await this.findOne(tenantId, id);
    const oldValue = { ...controlEvidence };

    Object.assign(controlEvidence, dto);

    const saved = await this.controlEvidenceRepository.save(controlEvidence);

    await this.auditService.recordUpdate(
      'GrcControlEvidence',
      saved.id,
      oldValue as unknown as Record<string, unknown>,
      saved as unknown as Record<string, unknown>,
      userId,
      tenantId,
    );

    return saved;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<void> {
    const controlEvidence = await this.findOne(tenantId, id);

    await this.controlEvidenceRepository.remove(controlEvidence);

    await this.auditService.recordDelete(
      'GrcControlEvidence',
      controlEvidence,
      userId,
      tenantId,
    );
  }

  async unlinkEvidence(
    tenantId: string,
    controlId: string,
    evidenceId: string,
    userId: string,
  ): Promise<void> {
    const controlEvidence = await this.controlEvidenceRepository.findOne({
      where: { controlId, evidenceId, tenantId },
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
}
