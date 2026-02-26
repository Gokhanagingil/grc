/**
 * CMDB CI Class Diagnostics Service
 *
 * Provides per-class and page-level validation diagnostics for the
 * CMDB Class Hierarchy Workbench. Surfaces useful signals such as:
 * - Missing parent references
 * - Inheritance cycle detection
 * - Duplicate field names in effective chain
 * - Missing technical name / empty labels
 * - No local fields warnings
 * - Invalid class configurations
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmdbCiClass } from './ci-class.entity';
import { CiClassInheritanceService } from './ci-class-inheritance.service';

// ============================================================================
// Types
// ============================================================================

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface DiagnosticItem {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  suggestedAction?: string;
}

export interface ClassDiagnosticsResult {
  classId: string;
  className: string;
  classLabel: string;
  diagnostics: DiagnosticItem[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface PageDiagnosticsSummary {
  totalClasses: number;
  classesWithErrors: number;
  classesWithWarnings: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  topIssues: DiagnosticItem[];
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class CiClassDiagnosticsService {
  constructor(
    @InjectRepository(CmdbCiClass)
    private readonly classRepo: Repository<CmdbCiClass>,
    private readonly inheritanceService: CiClassInheritanceService,
  ) {}

  /**
   * Run diagnostics for a single class.
   */
  async diagnoseClass(
    tenantId: string,
    classId: string,
  ): Promise<ClassDiagnosticsResult> {
    const cls = await this.classRepo.findOne({
      where: { id: classId, tenantId, isDeleted: false },
    });

    if (!cls) {
      return {
        classId,
        className: '',
        classLabel: '',
        diagnostics: [
          {
            severity: 'error',
            code: 'CLASS_NOT_FOUND',
            message: `Class ${classId} not found or has been deleted.`,
            suggestedAction: 'Verify the class ID or check if it was deleted.',
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      };
    }

    const diagnostics: DiagnosticItem[] = [];

    // 1. Check for missing parent reference
    if (cls.parentClassId) {
      const parent = await this.classRepo.findOne({
        where: { id: cls.parentClassId, tenantId, isDeleted: false },
      });
      if (!parent) {
        diagnostics.push({
          severity: 'error',
          code: 'MISSING_PARENT',
          message: `Parent class "${cls.parentClassId}" not found. The inheritance chain is broken.`,
          suggestedAction:
            'Update the parent class reference or set to null to make this a root class.',
        });
      }
    }

    // 2. Check for inheritance cycle
    const hasCycle = await this.inheritanceService.hasCycle(tenantId, classId);
    if (hasCycle) {
      diagnostics.push({
        severity: 'error',
        code: 'INHERITANCE_CYCLE',
        message:
          'Circular reference detected in the inheritance chain. This class is part of a cycle.',
        suggestedAction:
          'Break the cycle by updating one of the parent references in the chain.',
      });
    }

    // 3. Field override signals (local field key overrides an inherited key)
    if (!hasCycle) {
      try {
        const localFields = cls.fieldsSchema ?? [];
        const ancestors = await this.inheritanceService.getAncestorChain(
          tenantId,
          classId,
        );

        // Ancestors are returned nearest→root. The nearest ancestor wins for inheritance,
        // so we preserve the first-seen source for a key.
        const inheritedFieldSourceByKey = new Map<string, string>();
        for (const ancestor of ancestors) {
          const ancestorCls = await this.classRepo.findOne({
            where: { id: ancestor.id, tenantId, isDeleted: false },
            select: ['id', 'name', 'fieldsSchema'],
          });
          const ancestorFields = ancestorCls?.fieldsSchema ?? [];
          for (const f of ancestorFields) {
            if (!inheritedFieldSourceByKey.has(f.key)) {
              inheritedFieldSourceByKey.set(f.key, ancestorCls!.name);
            }
          }
        }

        for (const localField of localFields) {
          const overriddenFrom = inheritedFieldSourceByKey.get(localField.key);
          if (overriddenFrom) {
            diagnostics.push({
              severity: 'info',
              code: 'FIELD_OVERRIDE',
              message: `Local field "${localField.key}" overrides inherited field from "${overriddenFrom}".`,
            });
          }
        }
      } catch {
        // Non-blocking: diagnostics should never throw for UI usage
      }
    }

    // 4. Check for missing/empty technical name
    if (!cls.name || cls.name.trim() === '') {
      diagnostics.push({
        severity: 'error',
        code: 'EMPTY_NAME',
        message: 'Class technical name (name) is empty.',
        suggestedAction: 'Provide a unique technical name for this class.',
      });
    }

    // 5. Check for missing/empty label
    if (!cls.label || cls.label.trim() === '') {
      diagnostics.push({
        severity: 'warning',
        code: 'EMPTY_LABEL',
        message: 'Class display label is empty.',
        suggestedAction: 'Provide a human-readable label for this class.',
      });
    }

    // 6. Check for no local fields
    const localFieldCount = cls.fieldsSchema?.length ?? 0;
    if (localFieldCount === 0 && !cls.isAbstract) {
      diagnostics.push({
        severity: 'warning',
        code: 'NO_LOCAL_FIELDS',
        message:
          'This class has no locally defined fields. It only inherits fields from parent classes.',
        suggestedAction:
          'Consider adding class-specific fields, or mark as abstract if it is a grouping class.',
      });
    }

    // 7. Check for inactive class with children
    if (!cls.isActive) {
      const children = await this.classRepo.find({
        where: { tenantId, parentClassId: classId, isDeleted: false },
        select: ['id', 'name', 'isActive'],
      });
      const activeChildren = children.filter((c) => c.isActive);
      if (activeChildren.length > 0) {
        diagnostics.push({
          severity: 'warning',
          code: 'INACTIVE_WITH_ACTIVE_CHILDREN',
          message: `This class is inactive but has ${activeChildren.length} active child class(es).`,
          suggestedAction:
            'Review child classes — they may need to be reassigned or deactivated.',
        });
      }
    }

    // 8. Positive signal if no issues
    if (diagnostics.length === 0) {
      diagnostics.push({
        severity: 'info',
        code: 'ALL_CLEAR',
        message: 'No issues detected. Class configuration is valid.',
      });
    }

    const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
    const warningCount = diagnostics.filter(
      (d) => d.severity === 'warning',
    ).length;
    const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

    return {
      classId,
      className: cls.name,
      classLabel: cls.label,
      diagnostics,
      errorCount,
      warningCount,
      infoCount,
    };
  }

  /**
   * Page-level diagnostics summary across all classes for a tenant.
   * Runs class-level diagnostics for each class and aggregates results.
   */
  async getPageDiagnosticsSummary(
    tenantId: string,
  ): Promise<PageDiagnosticsSummary> {
    const allClasses = await this.classRepo.find({
      where: { tenantId, isDeleted: false },
      select: ['id'],
    });

    let classesWithErrors = 0;
    let classesWithWarnings = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfos = 0;
    const allIssues: DiagnosticItem[] = [];

    for (const cls of allClasses) {
      const result = await this.diagnoseClass(tenantId, cls.id);

      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      const warnings = result.diagnostics.filter(
        (d) => d.severity === 'warning',
      );
      const infos = result.diagnostics.filter(
        (d) => d.severity === 'info' && d.code !== 'ALL_CLEAR',
      );

      if (errors.length > 0) classesWithErrors++;
      if (warnings.length > 0) classesWithWarnings++;

      totalErrors += errors.length;
      totalWarnings += warnings.length;
      totalInfos += infos.length;

      // Collect non-info issues for topIssues
      for (const d of result.diagnostics) {
        if (d.severity !== 'info' || d.code !== 'ALL_CLEAR') {
          allIssues.push(d);
        }
      }
    }

    // Top issues: errors first, then warnings, limit to 10
    const topIssues = allIssues
      .sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 10);

    return {
      totalClasses: allClasses.length,
      classesWithErrors,
      classesWithWarnings,
      totalErrors,
      totalWarnings,
      totalInfos,
      topIssues,
    };
  }
}
