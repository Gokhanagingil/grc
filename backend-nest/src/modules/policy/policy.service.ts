import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, FindOptionsWhere } from 'typeorm';
import { Policy } from './policy.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy) private readonly repo: Repository<Policy>,
  ) {}

  async findAll(q: QueryPolicyDto) {
    const page = Math.max(parseInt(q.page ?? '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit ?? '20', 10), 1), 200);
    const where: FindOptionsWhere<Policy> = {};

    if (q.status) where.status = q.status;
    if (q.search) {
      where.name = ILike(`%${q.search}%`);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Policy ${id} not found`);
    return row;
  }

  async create(dto: CreatePolicyDto) {
    const row = this.repo.create(dto);
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdatePolicyDto) {
    const row = await this.findOne(id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.softDelete(id);
    return { success: true };
  }
}
