import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { RiskEntity } from './risk.entity';
import { CreateRiskDto, UpdateRiskDto, QueryRiskDto } from './risk.dto';
import { tenantWhere } from '../../common/tenant/tenant-query.util';

@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(RiskEntity) private readonly repo: Repository<RiskEntity>,
  ) {}

  async list(q: QueryRiskDto, tenantId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    const page = Math.max(parseInt(q.page ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit ?? '20', 10), 1), 200);
    const where: FindOptionsWhere<RiskEntity> = {
      deleted_at: IsNull(),
      ...tenantWhere(tenantId),
    } as any;

    if (q.search) (where as any).title = ILike(`%${q.search}%`);
    if (q.severity) (where as any).severity = q.severity;
    if (q.status) (where as any).status = q.status;
    if (q.category) (where as any).category = q.category;

    const sortField =
      q.sort &&
      ['created_at', 'title', 'status', 'severity', 'updated_at'].includes(
        q.sort,
      )
        ? q.sort
        : 'created_at';
    const order: 'ASC' | 'DESC' =
      q.order === 'ASC' || q.order === 'DESC' ? q.order : 'DESC';

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async get(id: string, tenantId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    const row = await this.repo.findOne({
      where: { id, ...tenantWhere(tenantId) } as any,
    });
    if (!row) throw new NotFoundException('Risk not found');
    return row;
  }

  async create(dto: CreateRiskDto, tenantId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    const row = this.repo.create({
      tenant_id: tenantId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      severity: dto.severity ?? 'Medium',
      likelihood: dto.likelihood ?? 'Medium',
      impact: dto.impact ?? 'Medium',
      risk_score: dto.riskScore ?? 0,
      status: dto.status ?? 'open',
      mitigation_plan: dto.mitigationPlan,
      due_date: dto.dueDate,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateRiskDto, tenantId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    const row = await this.get(id, tenantId); // This already checks tenant
    Object.assign(row, {
      title: dto.title ?? row.title,
      description: dto.description ?? row.description,
      category: dto.category ?? row.category,
      severity: dto.severity ?? row.severity,
      likelihood: dto.likelihood ?? row.likelihood,
      impact: dto.impact ?? row.impact,
      risk_score: dto.riskScore ?? row.risk_score,
      status: dto.status ?? row.status,
      mitigation_plan: dto.mitigationPlan ?? row.mitigation_plan,
      due_date: dto.dueDate ?? row.due_date,
    });
    return this.repo.save(row);
  }

  async remove(id: string, tenantId: string) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }
    const row = await this.get(id, tenantId); // This already checks tenant
    await this.repo.softDelete(id);
    return { success: true };
  }
}
