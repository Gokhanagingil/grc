import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MultiTenantServiceBase } from '../../common/multi-tenant-service.base';
import { GrcPolicyVersion } from '../entities/grc-policy-version.entity';
import { GrcPolicy } from '../entities/grc-policy.entity';
import { PolicyVersionStatus, VersionType } from '../enums';

/**
 * GRC Policy Version Service
 *
 * Multi-tenant service for managing policy versions.
 * Provides version creation, publishing, and lifecycle management.
 */
@Injectable()
export class GrcPolicyVersionService extends MultiTenantServiceBase<GrcPolicyVersion> {
  constructor(
    @InjectRepository(GrcPolicyVersion)
    repository: Repository<GrcPolicyVersion>,
    @InjectRepository(GrcPolicy)
    private readonly policyRepository: Repository<GrcPolicy>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(repository);
  }

  /**
   * Get all versions for a policy
   */
  async getVersionsForPolicy(
    tenantId: string,
    policyId: string,
  ): Promise<GrcPolicyVersion[]> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId, isDeleted: false },
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    return this.repository.find({
      where: { tenantId, policyId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific version
   */
  async getVersion(
    tenantId: string,
    policyId: string,
    versionId: string,
  ): Promise<GrcPolicyVersion> {
    const version = await this.repository.findOne({
      where: { id: versionId, tenantId, policyId, isDeleted: false },
      relations: ['publishedBy', 'approvedBy'],
    });

    if (!version) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    return version;
  }

  /**
   * Create a new draft version for a policy
   * Automatically increments version number based on type (major/minor)
   */
  async createDraftVersion(
    tenantId: string,
    userId: string,
    policyId: string,
    data: {
      content?: string;
      changeSummary?: string;
      effectiveDate?: Date;
      versionType?: VersionType;
    },
  ): Promise<GrcPolicyVersion> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId, isDeleted: false },
    });

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    const latestVersion = await this.getLatestVersion(tenantId, policyId);
    const newVersionNumber = this.incrementVersion(
      latestVersion?.versionNumber || '0.0',
      data.versionType || VersionType.MINOR,
    );

    const existingDraft = await this.repository.findOne({
      where: {
        tenantId,
        policyId,
        status: PolicyVersionStatus.DRAFT,
        isDeleted: false,
      },
    });

    if (existingDraft) {
      throw new BadRequestException(
        'A draft version already exists for this policy. Please update or delete the existing draft.',
      );
    }

    const version = await this.createForTenant(tenantId, {
      policyId,
      versionNumber: newVersionNumber,
      content: data.content || latestVersion?.content || policy.content,
      changeSummary: data.changeSummary,
      effectiveDate: data.effectiveDate,
      status: PolicyVersionStatus.DRAFT,
      createdBy: userId,
      isDeleted: false,
    });

    this.eventEmitter.emit('policy-version.created', {
      versionId: version.id,
      policyId,
      tenantId,
      userId,
      versionNumber: newVersionNumber,
    });

    return version;
  }

  /**
   * Update a draft version
   */
  async updateDraftVersion(
    tenantId: string,
    userId: string,
    policyId: string,
    versionId: string,
    data: {
      content?: string;
      changeSummary?: string;
      effectiveDate?: Date;
    },
  ): Promise<GrcPolicyVersion> {
    const version = await this.getVersion(tenantId, policyId, versionId);

    if (version.status !== PolicyVersionStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft versions can be updated. Create a new draft to make changes.',
      );
    }

    const updated = await this.updateForTenant(tenantId, versionId, {
      ...data,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    return updated;
  }

  /**
   * Submit a version for review
   */
  async submitForReview(
    tenantId: string,
    userId: string,
    policyId: string,
    versionId: string,
  ): Promise<GrcPolicyVersion> {
    const version = await this.getVersion(tenantId, policyId, versionId);

    if (version.status !== PolicyVersionStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft versions can be submitted for review.',
      );
    }

    const updated = await this.updateForTenant(tenantId, versionId, {
      status: PolicyVersionStatus.IN_REVIEW,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    this.eventEmitter.emit('policy-version.submitted-for-review', {
      versionId,
      policyId,
      tenantId,
      userId,
    });

    return updated;
  }

  /**
   * Approve a version
   */
  async approveVersion(
    tenantId: string,
    userId: string,
    policyId: string,
    versionId: string,
  ): Promise<GrcPolicyVersion> {
    const version = await this.getVersion(tenantId, policyId, versionId);

    if (version.status !== PolicyVersionStatus.IN_REVIEW) {
      throw new BadRequestException(
        'Only versions in review can be approved.',
      );
    }

    const updated = await this.updateForTenant(tenantId, versionId, {
      status: PolicyVersionStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: userId,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    this.eventEmitter.emit('policy-version.approved', {
      versionId,
      policyId,
      tenantId,
      userId,
    });

    return updated;
  }

  /**
   * Publish a version (makes it the active version)
   */
  async publishVersion(
    tenantId: string,
    userId: string,
    policyId: string,
    versionId: string,
  ): Promise<GrcPolicyVersion> {
    const version = await this.getVersion(tenantId, policyId, versionId);

    if (
      version.status !== PolicyVersionStatus.APPROVED &&
      version.status !== PolicyVersionStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Only approved or draft versions can be published.',
      );
    }

    await this.repository.update(
      {
        tenantId,
        policyId,
        status: PolicyVersionStatus.PUBLISHED,
        isDeleted: false,
      },
      { status: PolicyVersionStatus.RETIRED },
    );

    const updated = await this.updateForTenant(tenantId, versionId, {
      status: PolicyVersionStatus.PUBLISHED,
      publishedAt: new Date(),
      publishedByUserId: userId,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    await this.policyRepository.update(
      { id: policyId, tenantId },
      { version: version.versionNumber },
    );

    this.eventEmitter.emit('policy-version.published', {
      versionId,
      policyId,
      tenantId,
      userId,
      versionNumber: version.versionNumber,
    });

    return updated;
  }

  /**
   * Retire a version
   */
  async retireVersion(
    tenantId: string,
    userId: string,
    policyId: string,
    versionId: string,
  ): Promise<GrcPolicyVersion> {
    const version = await this.getVersion(tenantId, policyId, versionId);

    if (version.status === PolicyVersionStatus.RETIRED) {
      throw new BadRequestException('Version is already retired.');
    }

    const updated = await this.updateForTenant(tenantId, versionId, {
      status: PolicyVersionStatus.RETIRED,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    return updated;
  }

  /**
   * Get the latest version for a policy
   */
  async getLatestVersion(
    tenantId: string,
    policyId: string,
  ): Promise<GrcPolicyVersion | null> {
    return this.repository.findOne({
      where: { tenantId, policyId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get the currently published version for a policy
   */
  async getPublishedVersion(
    tenantId: string,
    policyId: string,
  ): Promise<GrcPolicyVersion | null> {
    return this.repository.findOne({
      where: {
        tenantId,
        policyId,
        status: PolicyVersionStatus.PUBLISHED,
        isDeleted: false,
      },
    });
  }

  /**
   * Increment version number based on type
   * Major: 1.0 -> 2.0
   * Minor: 1.0 -> 1.1
   */
  incrementVersion(currentVersion: string, type: VersionType): string {
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0] || '0', 10);
    const minor = parseInt(parts[1] || '0', 10);

    if (type === VersionType.MAJOR) {
      return `${major + 1}.0`;
    } else {
      return `${major}.${minor + 1}`;
    }
  }

  /**
   * Parse version string into components
   */
  parseVersion(version: string): { major: number; minor: number } {
    const parts = version.split('.');
    return {
      major: parseInt(parts[0] || '0', 10),
      minor: parseInt(parts[1] || '0', 10),
    };
  }

  /**
   * Compare two version strings
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  compareVersions(v1: string, v2: string): number {
    const parsed1 = this.parseVersion(v1);
    const parsed2 = this.parseVersion(v2);

    if (parsed1.major !== parsed2.major) {
      return parsed1.major < parsed2.major ? -1 : 1;
    }
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor < parsed2.minor ? -1 : 1;
    }
    return 0;
  }
}
