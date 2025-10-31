import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AuditEntity } from './audit.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditEntity) private readonly repo: Repository<AuditEntity>) {}

  async findAll() {
    return this.repo.find({ where: { deleted_at: IsNull() }, order: { created_at: 'DESC' } });
  }
}

