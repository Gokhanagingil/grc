import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmdbRelationshipType } from './relationship-type.entity';
import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiClass } from '../ci-class/ci-class.entity';
import { CiClassInheritanceService } from '../ci-class/ci-class-inheritance.service';

export interface RelationshipValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface RelationshipValidationResult {
  valid: boolean;
  errors: RelationshipValidationError[];
  warnings: string[];
  /** Resolved semantics for the relationship type (if found) */
  semantics?: {
    name: string;
    label: string;
    directionality: string;
    riskPropagation: string;
  };
}

/**
 * Validates CI relationship creation/updates against the relationship type
 * semantics catalog. Checks:
 * 1. Self-loop policy (is source===target allowed for this type?)
 * 2. Class compatibility (are source/target classes in allowed families?)
 * 3. Relationship type existence (warning if type is not in catalog)
 */
@Injectable()
export class RelationshipSemanticsValidationService {
  constructor(
    @InjectRepository(CmdbRelationshipType)
    private readonly relTypeRepo: Repository<CmdbRelationshipType>,
    @InjectRepository(CmdbCi)
    private readonly ciRepo: Repository<CmdbCi>,
    @InjectRepository(CmdbCiClass)
    private readonly classRepo: Repository<CmdbCiClass>,
    @Optional()
    private readonly inheritanceService?: CiClassInheritanceService,
  ) {}

  /**
   * Validate a proposed CI relationship against semantics catalog.
   */
  async validate(
    tenantId: string,
    sourceCiId: string,
    targetCiId: string,
    type: string,
  ): Promise<RelationshipValidationResult> {
    const errors: RelationshipValidationError[] = [];
    const warnings: string[] = [];

    // 1. Look up the relationship type in the catalog
    const relType = await this.relTypeRepo.findOne({
      where: { tenantId, name: type, isDeleted: false },
    });

    if (!relType) {
      // Not in catalog — warn but don't block (backward compat)
      warnings.push(
        `Relationship type "${type}" is not defined in the semantics catalog. ` +
          `Consider adding it for better governance.`,
      );
      return { valid: true, errors, warnings };
    }

    if (!relType.isActive) {
      errors.push({
        code: 'INACTIVE_RELATIONSHIP_TYPE',
        message: `Relationship type "${type}" is inactive`,
        field: 'type',
      });
      return { valid: false, errors, warnings };
    }

    // 2. Self-loop check
    if (sourceCiId === targetCiId && !relType.allowSelfLoop) {
      errors.push({
        code: 'SELF_LOOP_NOT_ALLOWED',
        message: `Relationship type "${type}" does not allow self-loops (source === target)`,
        field: 'targetCiId',
      });
    }

    // 3. Class compatibility check
    if (
      relType.allowedSourceClasses?.length ||
      relType.allowedTargetClasses?.length
    ) {
      await this.validateClassCompatibility(
        tenantId,
        sourceCiId,
        targetCiId,
        relType,
        errors,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      semantics: {
        name: relType.name,
        label: relType.label,
        directionality: relType.directionality,
        riskPropagation: relType.riskPropagation,
      },
    };
  }

  /**
   * Check if source/target CI classes are in the allowed class families.
   * Uses inheritance: if "Server" is allowed and CI's class is "Linux Server"
   * (child of Server), it passes.
   */
  private async validateClassCompatibility(
    tenantId: string,
    sourceCiId: string,
    targetCiId: string,
    relType: CmdbRelationshipType,
    errors: RelationshipValidationError[],
  ): Promise<void> {
    // Load source and target CIs with their classes
    const [sourceCi, targetCi] = await Promise.all([
      this.ciRepo.findOne({
        where: { id: sourceCiId, tenantId, isDeleted: false },
        relations: ['ciClass'],
      }),
      this.ciRepo.findOne({
        where: { id: targetCiId, tenantId, isDeleted: false },
        relations: ['ciClass'],
      }),
    ]);

    // Check source class compatibility
    if (relType.allowedSourceClasses?.length && sourceCi?.ciClass) {
      const allowed = await this.isClassInFamily(
        tenantId,
        sourceCi.ciClass,
        relType.allowedSourceClasses,
      );
      if (!allowed) {
        errors.push({
          code: 'SOURCE_CLASS_NOT_ALLOWED',
          message:
            `Source CI class "${sourceCi.ciClass.name}" is not in the allowed ` +
            `source classes for "${relType.name}": [${relType.allowedSourceClasses.join(', ')}]`,
          field: 'sourceCiId',
        });
      }
    }

    // Check target class compatibility
    if (relType.allowedTargetClasses?.length && targetCi?.ciClass) {
      const allowed = await this.isClassInFamily(
        tenantId,
        targetCi.ciClass,
        relType.allowedTargetClasses,
      );
      if (!allowed) {
        errors.push({
          code: 'TARGET_CLASS_NOT_ALLOWED',
          message:
            `Target CI class "${targetCi.ciClass.name}" is not in the allowed ` +
            `target classes for "${relType.name}": [${relType.allowedTargetClasses.join(', ')}]`,
          field: 'targetCiId',
        });
      }
    }
  }

  /**
   * Check if a class (or any of its ancestors) is in the allowed list.
   * This enables inheritance-aware compatibility: if "Hardware" is allowed,
   * then "Server" (child of Hardware) also passes.
   */
  private async isClassInFamily(
    tenantId: string,
    ciClass: CmdbCiClass,
    allowedClassNames: string[],
  ): Promise<boolean> {
    // Direct match
    if (allowedClassNames.includes(ciClass.name)) {
      return true;
    }

    // Check ancestor chain
    if (this.inheritanceService) {
      try {
        const ancestors = await this.inheritanceService.getAncestorChain(
          tenantId,
          ciClass.id,
        );
        for (const ancestor of ancestors) {
          if (allowedClassNames.includes(ancestor.name)) {
            return true;
          }
        }
      } catch {
        // If ancestor chain fails, fall through to false
      }
    }

    return false;
  }
}
