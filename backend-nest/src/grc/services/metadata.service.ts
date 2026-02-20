import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcFieldMetadata } from '../entities/grc-field-metadata.entity';
import { GrcClassificationTag } from '../entities/grc-classification-tag.entity';
import { GrcFieldMetadataTag } from '../entities/grc-field-metadata-tag.entity';
import { ClassificationTagType } from '../enums';

/**
 * Metadata Service
 *
 * Multi-tenant service for managing field metadata and classification tags.
 * Provides CRUD operations for metadata and tag assignment functionality.
 */
@Injectable()
export class MetadataService extends MultiTenantServiceBase<GrcFieldMetadata> {
  constructor(
    @InjectRepository(GrcFieldMetadata)
    repository: Repository<GrcFieldMetadata>,
    @InjectRepository(GrcClassificationTag)
    private readonly tagRepository: Repository<GrcClassificationTag>,
    @InjectRepository(GrcFieldMetadataTag)
    private readonly fieldMetadataTagRepository: Repository<GrcFieldMetadataTag>,
  ) {
    super(repository);
  }

  /**
   * Get all field metadata for a tenant
   */
  async getFieldMetadata(
    tenantId: string,
    filters?: {
      tableName?: string;
      isSensitive?: boolean;
      isPii?: boolean;
    },
  ): Promise<GrcFieldMetadata[]> {
    const qb = this.repository.createQueryBuilder('fm');
    qb.where('fm.tenantId = :tenantId', { tenantId });
    qb.andWhere('fm.isDeleted = :isDeleted', { isDeleted: false });

    if (filters?.tableName) {
      qb.andWhere('fm.tableName = :tableName', {
        tableName: filters.tableName,
      });
    }

    if (filters?.isSensitive !== undefined) {
      qb.andWhere('fm.isSensitive = :isSensitive', {
        isSensitive: filters.isSensitive,
      });
    }

    if (filters?.isPii !== undefined) {
      qb.andWhere('fm.isPii = :isPii', { isPii: filters.isPii });
    }

    qb.leftJoinAndSelect('fm.fieldMetadataTags', 'fmt');
    qb.leftJoinAndSelect('fmt.classificationTag', 'ct');
    qb.orderBy('fm.tableName', 'ASC');
    qb.addOrderBy('fm.fieldName', 'ASC');

    return qb.getMany();
  }

  /**
   * Get field metadata by ID
   */
  async getFieldMetadataById(
    tenantId: string,
    fieldMetadataId: string,
  ): Promise<GrcFieldMetadata> {
    const fieldMetadata = await this.repository.findOne({
      where: { id: fieldMetadataId, tenantId, isDeleted: false },
      relations: ['fieldMetadataTags', 'fieldMetadataTags.classificationTag'],
    });

    if (!fieldMetadata) {
      throw new NotFoundException(
        `Field metadata with ID ${fieldMetadataId} not found`,
      );
    }

    return fieldMetadata;
  }

  /**
   * Create field metadata
   */
  async createFieldMetadata(
    tenantId: string,
    userId: string,
    data: {
      tableName: string;
      fieldName: string;
      label?: string;
      description?: string;
      dataType?: string;
      isSensitive?: boolean;
      isPii?: boolean;
    },
  ): Promise<GrcFieldMetadata> {
    const existing = await this.repository.findOne({
      where: {
        tenantId,
        tableName: data.tableName,
        fieldName: data.fieldName,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Field metadata for ${data.tableName}.${data.fieldName} already exists`,
      );
    }

    return this.createForTenant(tenantId, {
      ...data,
      createdBy: userId,
      isDeleted: false,
    });
  }

  /**
   * Update field metadata
   */
  async updateFieldMetadata(
    tenantId: string,
    userId: string,
    fieldMetadataId: string,
    data: Partial<{
      label: string;
      description: string;
      dataType: string;
      isSensitive: boolean;
      isPii: boolean;
    }>,
  ): Promise<GrcFieldMetadata> {
    // Validate field exists before updating
    await this.getFieldMetadataById(tenantId, fieldMetadataId);

    const updated = await this.updateForTenant(tenantId, fieldMetadataId, {
      ...data,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(
        `Field metadata with ID ${fieldMetadataId} not found`,
      );
    }

    return updated;
  }

  /**
   * Delete field metadata (soft delete)
   */
  async deleteFieldMetadata(
    tenantId: string,
    userId: string,
    fieldMetadataId: string,
  ): Promise<boolean> {
    // Validate field exists before deleting
    await this.getFieldMetadataById(tenantId, fieldMetadataId);

    await this.updateForTenant(tenantId, fieldMetadataId, {
      isDeleted: true,
      updatedBy: userId,
    });

    return true;
  }

  /**
   * Get all classification tags for a tenant
   */
  async getTags(
    tenantId: string,
    filters?: {
      tagType?: ClassificationTagType;
      isSystem?: boolean;
    },
  ): Promise<GrcClassificationTag[]> {
    const qb = this.tagRepository.createQueryBuilder('tag');
    qb.where('tag.tenantId = :tenantId', { tenantId });
    qb.andWhere('tag.isDeleted = :isDeleted', { isDeleted: false });

    if (filters?.tagType) {
      qb.andWhere('tag.tagType = :tagType', { tagType: filters.tagType });
    }

    if (filters?.isSystem !== undefined) {
      qb.andWhere('tag.isSystem = :isSystem', { isSystem: filters.isSystem });
    }

    qb.orderBy('tag.tagType', 'ASC');
    qb.addOrderBy('tag.tagName', 'ASC');

    return qb.getMany();
  }

  /**
   * Get tag by ID
   */
  async getTagById(
    tenantId: string,
    tagId: string,
  ): Promise<GrcClassificationTag> {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, tenantId, isDeleted: false },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${tagId} not found`);
    }

    return tag;
  }

  /**
   * Create a classification tag
   */
  async createTag(
    tenantId: string,
    userId: string,
    data: {
      tagName: string;
      tagType: ClassificationTagType;
      description?: string;
      color?: string;
      isSystem?: boolean;
    },
  ): Promise<GrcClassificationTag> {
    const existing = await this.tagRepository.findOne({
      where: { tenantId, tagName: data.tagName, isDeleted: false },
    });

    if (existing) {
      throw new ConflictException(`Tag '${data.tagName}' already exists`);
    }

    const tag = this.tagRepository.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });

    return this.tagRepository.save(tag);
  }

  /**
   * Update a classification tag
   */
  async updateTag(
    tenantId: string,
    userId: string,
    tagId: string,
    data: Partial<{
      tagName: string;
      tagType: ClassificationTagType;
      description: string;
      color: string;
    }>,
  ): Promise<GrcClassificationTag> {
    const tag = await this.getTagById(tenantId, tagId);

    if (tag.isSystem) {
      throw new ConflictException('System tags cannot be modified');
    }

    Object.assign(tag, data, { updatedBy: userId });
    return this.tagRepository.save(tag);
  }

  /**
   * Delete a classification tag (soft delete)
   */
  async deleteTag(
    tenantId: string,
    userId: string,
    tagId: string,
  ): Promise<boolean> {
    const tag = await this.getTagById(tenantId, tagId);

    if (tag.isSystem) {
      throw new ConflictException('System tags cannot be deleted');
    }

    tag.isDeleted = true;
    tag.updatedBy = userId;
    await this.tagRepository.save(tag);

    return true;
  }

  /**
   * Assign a tag to field metadata
   */
  async assignTag(
    tenantId: string,
    fieldMetadataId: string,
    tagId: string,
  ): Promise<GrcFieldMetadataTag> {
    await this.getFieldMetadataById(tenantId, fieldMetadataId);
    await this.getTagById(tenantId, tagId);

    const existing = await this.fieldMetadataTagRepository.findOne({
      where: {
        tenantId,
        fieldMetadataId,
        classificationTagId: tagId,
      },
    });

    if (existing) {
      throw new ConflictException('Tag is already assigned to this field');
    }

    const assignment = this.fieldMetadataTagRepository.create({
      tenantId,
      fieldMetadataId,
      classificationTagId: tagId,
    });

    return this.fieldMetadataTagRepository.save(assignment);
  }

  /**
   * Remove a tag from field metadata
   */
  async removeTag(
    tenantId: string,
    fieldMetadataId: string,
    tagId: string,
  ): Promise<boolean> {
    const assignment = await this.fieldMetadataTagRepository.findOne({
      where: {
        tenantId,
        fieldMetadataId,
        classificationTagId: tagId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Tag assignment not found');
    }

    await this.fieldMetadataTagRepository.remove(assignment);
    return true;
  }

  /**
   * Get tags assigned to a field
   */
  async getTagsForField(
    tenantId: string,
    fieldMetadataId: string,
  ): Promise<GrcClassificationTag[]> {
    const assignments = await this.fieldMetadataTagRepository.find({
      where: { tenantId, fieldMetadataId },
      relations: ['classificationTag'],
    });

    return assignments
      .map((a) => a.classificationTag)
      .filter((t) => t && !t.isDeleted);
  }

  /**
   * Get fields with a specific tag
   */
  async getFieldsWithTag(
    tenantId: string,
    tagId: string,
  ): Promise<GrcFieldMetadata[]> {
    const assignments = await this.fieldMetadataTagRepository.find({
      where: { tenantId, classificationTagId: tagId },
      relations: ['fieldMetadata'],
    });

    return assignments
      .map((a) => a.fieldMetadata)
      .filter((f) => f && !f.isDeleted);
  }

  /**
   * Get distinct table names
   */
  async getTableNames(tenantId: string): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('fm')
      .select('DISTINCT fm.tableName', 'tableName')
      .where('fm.tenantId = :tenantId', { tenantId })
      .andWhere('fm.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('fm.tableName', 'ASC')
      .getRawMany<{ tableName: string }>();

    return result.map((r) => r.tableName);
  }

  /**
   * Seed default classification tags for a tenant
   */
  async seedDefaultTags(tenantId: string, userId: string): Promise<void> {
    const defaultTags = [
      {
        tagName: 'Personal Data',
        tagType: ClassificationTagType.PRIVACY,
        description: 'Data that can identify an individual',
        color: '#2196F3',
        isSystem: true,
      },
      {
        tagName: 'Sensitive Personal Data',
        tagType: ClassificationTagType.PRIVACY,
        description:
          'Special categories of personal data (health, biometric, etc.)',
        color: '#F44336',
        isSystem: true,
      },
      {
        tagName: 'Confidential',
        tagType: ClassificationTagType.SECURITY,
        description: 'Confidential business information',
        color: '#FF9800',
        isSystem: true,
      },
      {
        tagName: 'Critical Asset Identifier',
        tagType: ClassificationTagType.SECURITY,
        description: 'Identifies critical business assets',
        color: '#9C27B0',
        isSystem: true,
      },
      {
        tagName: 'Regulated Data',
        tagType: ClassificationTagType.COMPLIANCE,
        description: 'Data subject to regulatory requirements',
        color: '#4CAF50',
        isSystem: true,
      },
    ];

    for (const tagData of defaultTags) {
      const existing = await this.tagRepository.findOne({
        where: { tenantId, tagName: tagData.tagName },
      });

      if (!existing) {
        const tag = this.tagRepository.create({
          ...tagData,
          tenantId,
          createdBy: userId,
          isDeleted: false,
        });
        await this.tagRepository.save(tag);
      }
    }
  }
}
