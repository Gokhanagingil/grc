import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { GrcFramework } from '../entities/grc-framework.entity';
import { GrcTenantFramework } from '../entities/grc-tenant-framework.entity';

export interface FrameworkDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

@Injectable()
export class GrcFrameworksService {
  constructor(
    @InjectRepository(GrcFramework)
    private readonly frameworkRepository: Repository<GrcFramework>,
    @InjectRepository(GrcTenantFramework)
    private readonly tenantFrameworkRepository: Repository<GrcTenantFramework>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllActive(): Promise<FrameworkDto[]> {
    const frameworks = await this.frameworkRepository.find({
      where: { isActive: true },
      order: { key: 'ASC' },
    });

    return frameworks.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      isActive: f.isActive,
    }));
  }

  async getTenantFrameworkKeys(tenantId: string): Promise<string[]> {
    const tenantFrameworks = await this.tenantFrameworkRepository.find({
      where: { tenantId },
      relations: ['framework'],
    });

    return tenantFrameworks
      .filter((tf) => tf.framework && tf.framework.isActive)
      .map((tf) => tf.framework.key)
      .sort();
  }

  async setTenantFrameworks(
    tenantId: string,
    activeKeys: string[],
  ): Promise<string[]> {
    if (!Array.isArray(activeKeys)) {
      throw new BadRequestException('activeKeys must be an array');
    }

    const uniqueKeys = [...new Set(activeKeys)];

    const frameworks = await this.frameworkRepository.find({
      where: { key: In(uniqueKeys), isActive: true },
    });

    const foundKeys = frameworks.map((f) => f.key);
    const invalidKeys = uniqueKeys.filter((k) => !foundKeys.includes(k));

    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        `Invalid or inactive framework keys: ${invalidKeys.join(', ')}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(GrcTenantFramework, { tenantId });

      for (const framework of frameworks) {
        const tenantFramework = queryRunner.manager.create(GrcTenantFramework, {
          tenantId,
          frameworkId: framework.id,
        });
        await queryRunner.manager.save(tenantFramework);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    return this.getTenantFrameworkKeys(tenantId);
  }
}
