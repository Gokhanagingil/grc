import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbHealthRule } from './cmdb-health-rule.entity';

@Injectable()
export class HealthRuleService extends MultiTenantServiceBase<CmdbHealthRule> {
  constructor(
    @InjectRepository(CmdbHealthRule)
    repository: Repository<CmdbHealthRule>,
  ) {
    super(repository);
  }

  async findEnabledRules(tenantId: string): Promise<CmdbHealthRule[]> {
    return this.repository.find({
      where: { tenantId, enabled: true, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
  }

  async findActiveRules(tenantId: string): Promise<CmdbHealthRule[]> {
    return this.repository.find({
      where: { tenantId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }
}
