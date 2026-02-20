import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbImportSource } from './cmdb-import-source.entity';
import { ImportSourceFilterDto } from './dto/import-source.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../grc/dto/pagination.dto';

@Injectable()
export class ImportSourceService extends MultiTenantServiceBase<CmdbImportSource> {
  constructor(
    @InjectRepository(CmdbImportSource)
    repository: Repository<CmdbImportSource>,
  ) {
    super(repository);
  }

  async findWithFilters(
    tenantId: string,
    filterDto: ImportSourceFilterDto,
  ): Promise<PaginatedResponse<CmdbImportSource>> {
    const {
      page = 1,
      pageSize = 20,
      search,
      q,
    } = filterDto;

    const qb = this.repository.createQueryBuilder('src');
    qb.where('src.tenantId = :tenantId', { tenantId });
    qb.andWhere('src.isDeleted = :isDeleted', { isDeleted: false });

    const searchTerm = search || q;
    if (searchTerm) {
      qb.andWhere('src.name ILIKE :search', { search: `%${searchTerm}%` });
    }

    const total = await qb.getCount();
    qb.orderBy('src.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);

    const items = await qb.getMany();
    return createPaginatedResponse(items, total, page, pageSize);
  }
}
