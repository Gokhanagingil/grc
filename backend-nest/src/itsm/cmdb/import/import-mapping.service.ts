import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../../common/multi-tenant-service.base';
import { CmdbImportMapping } from './cmdb-import-mapping.entity';
import { ALLOWED_TRANSFORMS, TransformDef } from './engine/safe-transforms';

@Injectable()
export class ImportMappingService extends MultiTenantServiceBase<CmdbImportMapping> {
  constructor(
    @InjectRepository(CmdbImportMapping)
    repository: Repository<CmdbImportMapping>,
  ) {
    super(repository);
  }

  async findBySource(
    tenantId: string,
    sourceId: string,
  ): Promise<CmdbImportMapping[]> {
    return this.repository.find({
      where: { tenantId, sourceId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  validateTransforms(transforms: TransformDef[]): string[] {
    const errors: string[] = [];
    for (const t of transforms) {
      if (!ALLOWED_TRANSFORMS.has(t.name)) {
        errors.push(
          `Unsafe transform rejected: "${t.name}". Allowed: ${[...ALLOWED_TRANSFORMS].join(', ')}`,
        );
      }
    }
    return errors;
  }
}
