import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { GovPolicy } from './gov.entity';
import { CreateGovPolicyDto, UpdateGovPolicyDto, QueryGovDto } from './gov.dto';

@Injectable()
export class GovService {
  constructor(@InjectRepository(GovPolicy) private readonly repo: Repository<GovPolicy>) {}

  async list(q: QueryGovDto) {
    const page = Math.max(parseInt(q.page ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit ?? '20', 10), 1), 200);
    const where: FindOptionsWhere<GovPolicy> = { deleted_at: IsNull() } as any;
    if (q.search) (where as any).title = ILike(`%${q.search}%`);
    if (q.status) (where as any).status = q.status;
    if (q.category) (where as any).category = q.category;
    const sortField = (q.sort && ['created_at','title','status','category','updated_at'].includes(q.sort)) ? q.sort : 'created_at';
    const order: 'ASC'|'DESC' = (q.order === 'ASC' || q.order === 'DESC') ? q.order : 'DESC';
    const [items, total] = await this.repo.findAndCount({ where, order: { [sortField]: order }, skip: (page-1)*limit, take: limit });
    return { items, total, page, limit };
  }

  async get(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Gov policy not found');
    return row;
  }

  async create(dto: CreateGovPolicyDto) {
    const row = this.repo.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      version: dto.version ?? '1.0',
      status: dto.status ?? 'draft',
      effective_date: dto.effectiveDate,
      review_date: dto.reviewDate,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateGovPolicyDto) {
    const row = await this.get(id);
    Object.assign(row, {
      title: dto.title ?? row.title,
      description: dto.description ?? row.description,
      category: dto.category ?? row.category,
      version: dto.version ?? row.version,
      status: dto.status ?? row.status,
      effective_date: dto.effectiveDate ?? row.effective_date,
      review_date: dto.reviewDate ?? row.review_date,
    });
    return this.repo.save(row);
  }

  async remove(id: string) {
    await this.get(id);
    await this.repo.softDelete(id);
    return { success: true };
  }
}


