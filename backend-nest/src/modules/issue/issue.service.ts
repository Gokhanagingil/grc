import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { IssueEntity } from './issue.entity';

@Injectable()
export class IssueService {
  constructor(
    @InjectRepository(IssueEntity)
    private readonly repo: Repository<IssueEntity>,
  ) {}

  async findAll() {
    return this.repo.find({
      where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    });
  }
}
