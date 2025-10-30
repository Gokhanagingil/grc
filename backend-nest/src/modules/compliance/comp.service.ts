import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { RequirementEntity } from './comp.entity';
import { CreateRequirementDto, UpdateRequirementDto, QueryRequirementDto } from './comp.dto';

@Injectable()
export class ComplianceService {
  constructor(@InjectRepository(RequirementEntity) private readonly repo: Repository<RequirementEntity>) {}

  async list(q: QueryRequirementDto) {
    const page = Math.max(parseInt(q.page ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit ?? '20', 10), 1), 200);
    const where: FindOptionsWhere<RequirementEntity> = { deleted_at: IsNull() } as any;
    if (q.search) (where as any).title = ILike(`%${q.search}%`);
    if (q.status) (where as any).status = q.status;
    if (q.regulation) (where as any).regulation = q.regulation;
    if (q.category) (where as any).category = q.category;
    const sortField = (q.sort && ['created_at','title','status','regulation','updated_at'].includes(q.sort)) ? q.sort : 'created_at';
    const order: 'ASC'|'DESC' = (q.order === 'ASC' || q.order === 'DESC') ? q.order : 'DESC';
    const [items, total] = await this.repo.findAndCount({ where, order: { [sortField]: order }, skip: (page-1)*limit, take: limit });
    return { items, total, page, limit };
  }

  async get(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Requirement not found');
    return row;
  }

  create(dto: CreateRequirementDto) {
    const row = this.repo.create({
      title: dto.title,
      description: dto.description,
      regulation: dto.regulation,
      category: dto.category,
      status: dto.status ?? 'pending',
      due_date: dto.dueDate,
      evidence: dto.evidence,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateRequirementDto) {
    const row = await this.get(id);
    Object.assign(row, {
      title: dto.title ?? row.title,
      description: dto.description ?? row.description,
      regulation: dto.regulation ?? row.regulation,
      category: dto.category ?? row.category,
      status: dto.status ?? row.status,
      due_date: dto.dueDate ?? row.due_date,
      evidence: dto.evidence ?? row.evidence,
    });
    return this.repo.save(row);
  }

  async remove(id: string) {
    await this.get(id);
    await this.repo.softDelete(id);
    return { success: true };
  }
}


