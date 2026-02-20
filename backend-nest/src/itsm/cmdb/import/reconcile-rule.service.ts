import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbReconcileRule } from './cmdb-reconcile-rule.entity';
import { ReconcileRuleFilterDto } from './dto/reconcile-rule.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';

@Injectable()
export class ReconcileRuleService extends MultiTenantServiceBase<CmdbReconcileRule> {
  constructor(
    @InjectRepository(CmdbReconcileRule)
    repository: Repository<CmdbReconcileRule>,
  ) {
    super(repository);
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ReconcileRuleFilterDto,
  ): Promise<PaginatedResponse<CmdbReconcileRule>> {
    const {
      page = 1,
      pageSize = 20,
      search,
      q,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('rule');
    qb.where('rule.tenantId = :tenantId', { tenantId });
    qb.andWhere('rule.isDeleted = :isDeleted', { isDeleted: false });

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('rule.name ILIKE :search', { search: `%${searchTerm}%` });
    }

    const total = await qb.getCount();
    qb.orderBy('rule.precedence', 'ASC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }

  async findActiveRules(tenantId: string): Promise<CmdbReconcileRule[]> {
    return this.repository.find({
      where: { tenantId, enabled: true, isDeleted: false },
      order: { precedence: 'ASC' },
    });
  }
}
