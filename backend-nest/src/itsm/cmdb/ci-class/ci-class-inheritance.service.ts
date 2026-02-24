import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmdbCiClass, EffectiveFieldDefinition } from './ci-class.entity';

/** Maximum allowed inheritance depth to prevent runaway chains */
const MAX_INHERITANCE_DEPTH = 10;

/**
 * Response shape for a single node in the class tree.
 */
export interface ClassTreeNode {
  id: string;
  name: string;
  label: string;
  icon: string | null;
  parentClassId: string | null;
  isAbstract: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  /** Number of local fields defined on this class */
  localFieldCount: number;
  children: ClassTreeNode[];
}

/**
 * Ancestor chain entry (from child up to root).
 */
export interface AncestorEntry {
  id: string;
  name: string;
  label: string;
  depth: number;
}

/**
 * Validation result for an inheritance change.
 */
export interface InheritanceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Effective depth if the change were applied */
  effectiveDepth?: number;
  /** Duplicate field keys that would be overridden */
  fieldOverrides?: Array<{
    key: string;
    overriddenFrom: string;
    overriddenBy: string;
  }>;
}

@Injectable()
export class CiClassInheritanceService {
  constructor(
    @InjectRepository(CmdbCiClass)
    private readonly classRepo: Repository<CmdbCiClass>,
  ) {}

  // ========================================================================
  // Tree operations
  // ========================================================================

  /**
   * Build a full class hierarchy tree for a tenant.
   * Returns an array of root nodes (classes with no parent), each with nested children.
   */
  async getClassTree(tenantId: string): Promise<ClassTreeNode[]> {
    const allClasses = await this.classRepo.find({
      where: { tenantId, isDeleted: false },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // Build lookup maps
    const byId = new Map<string, CmdbCiClass>();
    const childrenMap = new Map<string, CmdbCiClass[]>();

    for (const cls of allClasses) {
      byId.set(cls.id, cls);
      const parentId = cls.parentClassId ?? '__ROOT__';
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(cls);
    }

    // Recursive builder
    const buildNode = (cls: CmdbCiClass): ClassTreeNode => {
      const kids = childrenMap.get(cls.id) ?? [];
      return {
        id: cls.id,
        name: cls.name,
        label: cls.label,
        icon: cls.icon,
        parentClassId: cls.parentClassId,
        isAbstract: cls.isAbstract,
        isActive: cls.isActive,
        isSystem: cls.isSystem ?? false,
        sortOrder: cls.sortOrder,
        localFieldCount: cls.fieldsSchema?.length ?? 0,
        children: kids.map(buildNode),
      };
    };

    // Root nodes = those with no parent
    const roots = childrenMap.get('__ROOT__') ?? [];
    return roots.map(buildNode);
  }

  // ========================================================================
  // Ancestor / Descendant traversal
  // ========================================================================

  /**
   * Get the ancestor chain for a class (from immediate parent up to root).
   * Returns array ordered from nearest ancestor (parent) to farthest (root).
   * Throws if a cycle is detected.
   */
  async getAncestorChain(
    tenantId: string,
    classId: string,
  ): Promise<AncestorEntry[]> {
    const ancestors: AncestorEntry[] = [];
    const visited = new Set<string>();
    visited.add(classId);

    let currentId: string | null = classId;
    let depth = 0;

    while (currentId) {
      const cls = await this.classRepo.findOne({
        where: { id: currentId, tenantId, isDeleted: false },
      });

      if (!cls) break;

      // For the first iteration, skip adding the starting class itself
      if (currentId !== classId) {
        depth++;
        ancestors.push({
          id: cls.id,
          name: cls.name,
          label: cls.label,
          depth,
        });
      }

      if (depth >= MAX_INHERITANCE_DEPTH) {
        throw new BadRequestException(
          `Inheritance chain exceeds maximum depth of ${MAX_INHERITANCE_DEPTH}`,
        );
      }

      currentId = cls.parentClassId;

      if (currentId && visited.has(currentId)) {
        throw new BadRequestException(
          `Cycle detected in class inheritance chain: class ${currentId} already visited`,
        );
      }

      if (currentId) {
        visited.add(currentId);
      }
    }

    return ancestors;
  }

  /**
   * Get all descendant class IDs for a given class (recursive).
   */
  async getDescendantIds(tenantId: string, classId: string): Promise<string[]> {
    const result: string[] = [];
    const queue = [classId];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = await this.classRepo.find({
        where: { tenantId, parentClassId: parentId, isDeleted: false },
        select: ['id'],
      });

      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }

    return result;
  }

  // ========================================================================
  // Effective schema resolution
  // ========================================================================

  /**
   * Compute the effective schema for a class by merging ancestor fields
   * with local fields. Child fields override parent fields on key collision.
   *
   * Resolution order: root → ... → grandparent → parent → self
   * (each layer can override fields from the layer above)
   */
  async getEffectiveSchema(
    tenantId: string,
    classId: string,
  ): Promise<{
    classId: string;
    className: string;
    classLabel: string;
    ancestors: AncestorEntry[];
    effectiveFields: EffectiveFieldDefinition[];
    totalFieldCount: number;
    inheritedFieldCount: number;
    localFieldCount: number;
  }> {
    // Load the target class
    const targetClass = await this.classRepo.findOne({
      where: { id: classId, tenantId, isDeleted: false },
    });

    if (!targetClass) {
      throw new BadRequestException(`Class ${classId} not found`);
    }

    // Get ancestor chain (nearest to farthest)
    const ancestors = await this.getAncestorChain(tenantId, classId);

    // Build resolution stack: root first, then down to self
    // ancestors is [parent, grandparent, ...root], so reverse it
    const resolutionStack: Array<{
      cls: CmdbCiClass;
      depth: number;
    }> = [];

    // Load ancestor classes in order (root first)
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const ancestor = ancestors[i];
      const cls = await this.classRepo.findOne({
        where: { id: ancestor.id, tenantId, isDeleted: false },
      });
      if (cls) {
        resolutionStack.push({ cls, depth: ancestor.depth });
      }
    }

    // Add self at the end (depth = 0)
    resolutionStack.push({ cls: targetClass, depth: 0 });

    // Merge fields: later entries override earlier ones
    const fieldMap = new Map<string, EffectiveFieldDefinition>();

    for (const { cls, depth } of resolutionStack) {
      const localFields = cls.fieldsSchema ?? [];
      for (const field of localFields) {
        fieldMap.set(field.key, {
          ...field,
          sourceClassId: cls.id,
          sourceClassName: cls.name,
          inherited: cls.id !== classId,
          inheritanceDepth: depth,
        });
      }
    }

    // Sort by order, then alphabetically
    const effectiveFields = Array.from(fieldMap.values()).sort((a, b) => {
      const orderA = a.order ?? 9999;
      const orderB = b.order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.key.localeCompare(b.key);
    });

    const inheritedCount = effectiveFields.filter((f) => f.inherited).length;

    return {
      classId,
      className: targetClass.name,
      classLabel: targetClass.label,
      ancestors,
      effectiveFields,
      totalFieldCount: effectiveFields.length,
      inheritedFieldCount: inheritedCount,
      localFieldCount: effectiveFields.length - inheritedCount,
    };
  }

  // ========================================================================
  // Validation
  // ========================================================================

  /**
   * Validate whether a proposed inheritance change is safe.
   * Checks:
   * 1. Target parent exists and belongs to tenant
   * 2. No cycle would be created
   * 3. Depth would not exceed MAX_INHERITANCE_DEPTH
   * 4. Reports field key collisions (warnings, not errors)
   */
  async validateInheritanceChange(
    tenantId: string,
    classId: string,
    newParentClassId: string | null,
  ): Promise<InheritanceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Self-reference check
    if (newParentClassId === classId) {
      return {
        valid: false,
        errors: ['A class cannot be its own parent'],
        warnings: [],
      };
    }

    // Null parent is always valid (becoming a root class)
    if (newParentClassId === null) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        effectiveDepth: 0,
      };
    }

    // Check parent exists
    const parentClass = await this.classRepo.findOne({
      where: { id: newParentClassId, tenantId, isDeleted: false },
    });
    if (!parentClass) {
      return {
        valid: false,
        errors: [`Parent class ${newParentClassId} not found`],
        warnings: [],
      };
    }

    // Check for cycle: would newParentClassId be a descendant of classId?
    const descendants = await this.getDescendantIds(tenantId, classId);
    if (descendants.includes(newParentClassId)) {
      return {
        valid: false,
        errors: [
          `Setting ${newParentClassId} as parent would create a cycle: ` +
            `it is currently a descendant of ${classId}`,
        ],
        warnings: [],
      };
    }

    // Check depth: compute depth of the new parent from root, then add 1
    let parentDepth = 0;
    try {
      const parentAncestors = await this.getAncestorChain(
        tenantId,
        newParentClassId,
      );
      parentDepth = parentAncestors.length;
    } catch {
      errors.push('Parent class has an invalid inheritance chain');
    }

    // Also check descendants depth below classId
    const maxDescendantDepth = await this.getMaxDescendantDepth(
      tenantId,
      classId,
    );
    const totalDepth = parentDepth + 1 + maxDescendantDepth;

    if (totalDepth > MAX_INHERITANCE_DEPTH) {
      errors.push(
        `Total inheritance depth would be ${totalDepth}, exceeding maximum of ${MAX_INHERITANCE_DEPTH}`,
      );
    }

    // Check for field key collisions (warning only)
    const fieldOverrides: Array<{
      key: string;
      overriddenFrom: string;
      overriddenBy: string;
    }> = [];

    if (errors.length === 0) {
      try {
        // Temporarily compute what the effective schema would look like
        const parentAncestors = await this.getAncestorChain(
          tenantId,
          newParentClassId,
        );
        const parentFieldKeys = new Map<string, string>();

        // Collect all parent chain field keys
        for (const ancestor of parentAncestors) {
          const ancestorCls = await this.classRepo.findOne({
            where: { id: ancestor.id, tenantId, isDeleted: false },
          });
          if (ancestorCls?.fieldsSchema) {
            for (const field of ancestorCls.fieldsSchema) {
              parentFieldKeys.set(field.key, ancestorCls.name);
            }
          }
        }

        // Add parent's own fields
        if (parentClass.fieldsSchema) {
          for (const field of parentClass.fieldsSchema) {
            parentFieldKeys.set(field.key, parentClass.name);
          }
        }

        // Check current class fields against parent chain
        const currentClass = await this.classRepo.findOne({
          where: { id: classId, tenantId, isDeleted: false },
        });
        if (currentClass?.fieldsSchema) {
          for (const field of currentClass.fieldsSchema) {
            const overriddenFrom = parentFieldKeys.get(field.key);
            if (overriddenFrom) {
              fieldOverrides.push({
                key: field.key,
                overriddenFrom,
                overriddenBy: currentClass.name,
              });
            }
          }
        }

        if (fieldOverrides.length > 0) {
          warnings.push(
            `${fieldOverrides.length} field(s) would override inherited definitions: ` +
              fieldOverrides.map((o) => o.key).join(', '),
          );
        }
      } catch {
        // Non-blocking: field analysis failed
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      effectiveDepth: parentDepth + 1,
      fieldOverrides,
    };
  }

  /**
   * Detect if there is a cycle starting from a given class.
   * Returns true if a cycle exists.
   */
  async hasCycle(tenantId: string, classId: string): Promise<boolean> {
    try {
      await this.getAncestorChain(tenantId, classId);
      return false;
    } catch {
      return true;
    }
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /**
   * Get the maximum depth of descendants below a class.
   */
  private async getMaxDescendantDepth(
    tenantId: string,
    classId: string,
  ): Promise<number> {
    const children = await this.classRepo.find({
      where: { tenantId, parentClassId: classId, isDeleted: false },
      select: ['id'],
    });

    if (children.length === 0) return 0;

    let maxDepth = 0;
    for (const child of children) {
      const childDepth = await this.getMaxDescendantDepth(tenantId, child.id);
      maxDepth = Math.max(maxDepth, childDepth + 1);
    }

    return maxDepth;
  }
}
