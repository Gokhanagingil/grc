import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from './policy.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { PolicyStatus } from './policy-status.enum';

@Injectable()
export class PolicyService {
  constructor(@InjectRepository(Policy) private readonly repo: Repository<Policy>) {}

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Policy ${id} not found`);
    return row;
  }

  async create(dto: CreatePolicyDto) {
    const row = this.repo.create({ name: dto.name, status: dto.status ?? PolicyStatus.DRAFT });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdatePolicyDto) {
    const row = await this.findOne(id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(id: string) {
    const row = await this.findOne(id);
    await this.repo.remove(row);
    return { deleted: true, id };
  }
}