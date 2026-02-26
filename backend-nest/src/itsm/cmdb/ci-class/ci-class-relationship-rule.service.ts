/**
 * CMDB CI Class Relationship Rule Service
 *
 * Provides CRUD + inheritance-aware effective rule computation.
 *
 * Effective rules merge strategy:
 * 1. Walk the ancestor chain from root → ... → parent → self
 * 2. Union all rules from each ancestor
 * 3. On collision key (relationshipTypeId + targetClassId),
 *    the nearest ancestor (or self) wins (override).
 * 4. Each effective rule carries its origin (which class defined it).
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmdbCiClassRelationshipRule } from './ci-class-relationship-rule.entity';
import { CmdbCiClass } from './ci-class.entity';
import { CiClassInheritanceService } from './ci-class-inheritance.service';
import { CmdbRelationshipType } from '../relationship-type/relationship-type.entity';

// ============================================================================
// Types
// ============================================================================

export interface EffectiveRuleEntry {
  /** The rule ID (from the defining class's rule row) */
  ruleId: string;
  sourceClassId: string;
  sourceClassName: string;
  sourceClassLabel: string;
  relationshipTypeId: string;
  relationshipTypeName: string;
  relationshipTypeLabel: string;
  targetClassId: string;
  targetClassName: string;
  targetClassLabel: string;
  direction: string;
  propagationOverride: string | null;
  propagationWeight: string | null;
  defaultPropagation: string;
  directionality: string;
  isActive: boolean;
  isSystem: boolean;
  /** Which class defined this rule (origin) */
  originClassId: string;
  originClassName: string;
  originClassLabel: string;
  /** Whether this rule is inherited (true) or locally defined (false) */
  inherited: boolean;
  /** Inheritance depth of the origin (0 = self) */
  inheritanceDepth: number;
}

export interface EffectiveRulesResult {
  classId: string;
  className: string;
  classLabel: string;
  effectiveRules: EffectiveRuleEntry[];
  totalRuleCount: number;
  inheritedRuleCount: number;
  localRuleCount: number;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class CiClassRelationshipRuleService {
  constructor(
    @InjectRepository(CmdbCiClassRelationshipRule)
    private readonly ruleRepo: Repository<CmdbCiClassRelationshipRule>,
    @InjectRepository(CmdbCiClass)
    private readonly classRepo: Repository<CmdbCiClass>,
    @InjectRepository(CmdbRelationshipType)
    private readonly relTypeRepo: Repository<CmdbRelationshipType>,
    private readonly inheritanceService: CiClassInheritanceService,
  ) {}

  // ========================================================================
  // CRUD
  // ========================================================================

  async findAllForTenant(
    tenantId: string,
    filters?: {
      sourceClassId?: string;
      targetClassId?: string;
      relationshipTypeId?: string;
      isActive?: boolean;
    },
  ): Promise<CmdbCiClassRelationshipRule[]> {
    const qb = this.ruleRepo.createQueryBuilder('rule');
    qb.where('rule.tenantId = :tenantId', { tenantId });
    qb.andWhere('rule.isDeleted = :isDeleted', { isDeleted: false });

    if (filters?.sourceClassId) {
      qb.andWhere('rule.sourceClassId = :sourceClassId', {
        sourceClassId: filters.sourceClassId,
      });
    }
    if (filters?.targetClassId) {
      qb.andWhere('rule.targetClassId = :targetClassId', {
        targetClassId: filters.targetClassId,
      });
    }
    if (filters?.relationshipTypeId) {
      qb.andWhere('rule.relationshipTypeId = :relationshipTypeId', {
        relationshipTypeId: filters.relationshipTypeId,
      });
    }
    if (filters?.isActive !== undefined) {
      qb.andWhere('rule.isActive = :isActive', { isActive: filters.isActive });
    }

    qb.orderBy('rule.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOneForTenant(
    tenantId: string,
    id: string,
  ): Promise<CmdbCiClassRelationshipRule | null> {
    return this.ruleRepo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
  }

  async createRule(
    tenantId: string,
    userId: string,
    data: Partial<CmdbCiClassRelationshipRule>,
  ): Promise<CmdbCiClassRelationshipRule> {
    // Validate references exist
    await this.validateRuleReferences(tenantId, data);

    // Check for duplicate
    const existing = await this.ruleRepo.findOne({
      where: {
        tenantId,
        sourceClassId: data.sourceClassId,
        relationshipTypeId: data.relationshipTypeId,
        targetClassId: data.targetClassId,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A rule with this source class, relationship type, and target class already exists.',
      );
    }

    const entity = this.ruleRepo.create({
      ...data,
      tenantId,
      createdBy: userId,
      isDeleted: false,
    });
    return this.ruleRepo.save(entity);
  }

  async updateRule(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<CmdbCiClassRelationshipRule>,
  ): Promise<CmdbCiClassRelationshipRule | null> {
    const existing = await this.findOneForTenant(tenantId, id);
    if (!existing) return null;

    // Protect system rules from modification of key fields
    if (existing.isSystem) {
      if (
        data.sourceClassId !== undefined ||
        data.relationshipTypeId !== undefined ||
        data.targetClassId !== undefined
      ) {
        throw new BadRequestException(
          'Cannot modify source, relationship type, or target on a system-defined rule.',
        );
      }
    }

    Object.assign(existing, data, { updatedBy: userId });
    return this.ruleRepo.save(existing);
  }

  async softDeleteRule(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const existing = await this.findOneForTenant(tenantId, id);
    if (!existing) return false;

    existing.isDeleted = true;
    existing.updatedBy = userId;
    await this.ruleRepo.save(existing);
    return true;
  }

  // ========================================================================
  // Effective Rules (Inheritance-Aware)
  // ========================================================================

  /**
   * Compute effective relationship rules for a class by merging ancestor rules.
   *
   * Resolution order: root → ... → grandparent → parent → self
   * On collision (same relationshipTypeId + targetClassId),
   * the nearer class overrides.
   */
  async getEffectiveRules(
    tenantId: string,
    classId: string,
  ): Promise<EffectiveRulesResult> {
    // Load target class
    const targetClass = await this.classRepo.findOne({
      where: { id: classId, tenantId, isDeleted: false },
    });
    if (!targetClass) {
      throw new BadRequestException(`Class ${classId} not found`);
    }

    // Get ancestor chain
    const ancestors = await this.inheritanceService.getAncestorChain(
      tenantId,
      classId,
    );

    // Build resolution stack: root first, then down to self
    // ancestors is [parent, grandparent, ...root], so reverse it
    const resolutionStack: Array<{
      classId: string;
      className: string;
      classLabel: string;
      depth: number;
    }> = [];

    for (let i = ancestors.length - 1; i >= 0; i--) {
      resolutionStack.push({
        classId: ancestors[i].id,
        className: ancestors[i].name,
        classLabel: ancestors[i].label,
        depth: ancestors[i].depth,
      });
    }

    // Self at the end (depth 0)
    resolutionStack.push({
      classId: targetClass.id,
      className: targetClass.name,
      classLabel: targetClass.label,
      depth: 0,
    });

    // Load all relationship types and classes for enrichment
    const allRelTypes = await this.relTypeRepo.find({
      where: { tenantId, isDeleted: false },
    });
    const relTypeMap = new Map(allRelTypes.map((rt) => [rt.id, rt]));

    const allClasses = await this.classRepo.find({
      where: { tenantId, isDeleted: false },
      select: ['id', 'name', 'label'],
    });
    const classMap = new Map(allClasses.map((c) => [c.id, c]));

    // Merge rules: later (nearer to self) overrides earlier
    const ruleMap = new Map<string, EffectiveRuleEntry>();

    for (const layer of resolutionStack) {
      const rulesForClass = await this.ruleRepo.find({
        where: {
          tenantId,
          sourceClassId: layer.classId,
          isDeleted: false,
        },
      });

      for (const rule of rulesForClass) {
        const key = `${rule.relationshipTypeId}::${rule.targetClassId}`;
        const relType = relTypeMap.get(rule.relationshipTypeId);
        const sourceClass = classMap.get(rule.sourceClassId);
        const targetClassRef = classMap.get(rule.targetClassId);

        ruleMap.set(key, {
          ruleId: rule.id,
          sourceClassId: rule.sourceClassId,
          sourceClassName: sourceClass?.name ?? '',
          sourceClassLabel: sourceClass?.label ?? '',
          relationshipTypeId: rule.relationshipTypeId,
          relationshipTypeName: relType?.name ?? '',
          relationshipTypeLabel: relType?.label ?? '',
          targetClassId: rule.targetClassId,
          targetClassName: targetClassRef?.name ?? '',
          targetClassLabel: targetClassRef?.label ?? '',
          direction: rule.direction,
          propagationOverride: rule.propagationOverride,
          propagationWeight: rule.propagationWeight,
          defaultPropagation: relType?.riskPropagation ?? 'none',
          directionality: relType?.directionality ?? 'unidirectional',
          isActive: rule.isActive,
          isSystem: rule.isSystem,
          originClassId: layer.classId,
          originClassName: layer.className,
          originClassLabel: layer.classLabel,
          inherited: layer.classId !== classId,
          inheritanceDepth: layer.depth,
        });
      }
    }

    const effectiveRules = Array.from(ruleMap.values());
    const inheritedCount = effectiveRules.filter((r) => r.inherited).length;

    return {
      classId,
      className: targetClass.name,
      classLabel: targetClass.label,
      effectiveRules,
      totalRuleCount: effectiveRules.length,
      inheritedRuleCount: inheritedCount,
      localRuleCount: effectiveRules.length - inheritedCount,
    };
  }

  // ========================================================================
  // Validation helpers
  // ========================================================================

  private async validateRuleReferences(
    tenantId: string,
    data: Partial<CmdbCiClassRelationshipRule>,
  ): Promise<void> {
    if (data.sourceClassId) {
      const sourceClass = await this.classRepo.findOne({
        where: { id: data.sourceClassId, tenantId, isDeleted: false },
      });
      if (!sourceClass) {
        throw new BadRequestException(
          `Source class ${data.sourceClassId} not found`,
        );
      }
    }

    if (data.targetClassId) {
      const targetClass = await this.classRepo.findOne({
        where: { id: data.targetClassId, tenantId, isDeleted: false },
      });
      if (!targetClass) {
        throw new BadRequestException(
          `Target class ${data.targetClassId} not found`,
        );
      }
    }

    if (data.relationshipTypeId) {
      const relType = await this.relTypeRepo.findOne({
        where: { id: data.relationshipTypeId, tenantId, isDeleted: false },
      });
      if (!relType) {
        throw new BadRequestException(
          `Relationship type ${data.relationshipTypeId} not found`,
        );
      }
    }
  }
}
