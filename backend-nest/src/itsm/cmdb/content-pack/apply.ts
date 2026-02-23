/**
 * CMDB Baseline Content Pack v1 — Apply Engine
 *
 * Idempotent, conflict-aware engine that applies the baseline content pack
 * to a tenant. Handles:
 * - First-run creation of classes, fields, and relationship types
 * - Re-run idempotency (REUSED if unchanged, UPDATED if system-managed changed)
 * - Conflict detection (customer customizations preserved, reported as SKIPPED)
 * - Deterministic IDs for all baseline records
 * - Summary logging of all actions
 *
 * Conflict Strategy:
 * - If a record exists by deterministic ID and is system-managed → update baseline fields
 * - If a record exists by name but NOT by deterministic ID → SKIP (customer-created)
 * - Customer-added custom fields on system classes are preserved (never overwritten)
 * - Customer-created classes/relationship types are never touched
 */

import { DataSource, Repository } from 'typeorm';
import { CmdbCiClass } from '../ci-class/ci-class.entity';
import { CmdbRelationshipType } from '../relationship-type/relationship-type.entity';
import { BASELINE_CLASSES, BaselineClassDef } from './classes';
import {
  BASELINE_RELATIONSHIP_TYPES,
  BaselineRelTypeDef,
} from './relationship-types';
import {
  CMDB_BASELINE_CONTENT_PACK_VERSION,
  CONTENT_PACK_SOURCE,
  CONTENT_PACK_META_KEY,
} from './version';

// ============================================================================
// Types
// ============================================================================

export type SeedAction = 'CREATED' | 'UPDATED' | 'REUSED' | 'SKIPPED';

export interface SeedActionRecord {
  entity: string;
  name: string;
  action: SeedAction;
  reason?: string;
}

export interface ContentPackApplyResult {
  version: string;
  tenantId: string;
  dryRun: boolean;
  classes: {
    created: number;
    updated: number;
    reused: number;
    skipped: number;
    total: number;
  };
  relationshipTypes: {
    created: number;
    updated: number;
    reused: number;
    skipped: number;
    total: number;
  };
  actions: SeedActionRecord[];
  errors: string[];
}

// ============================================================================
// Options
// ============================================================================

export interface ContentPackApplyOptions {
  /** Tenant ID to apply the content pack to */
  tenantId: string;
  /** User ID for audit trail (createdBy/updatedBy) */
  adminUserId: string;
  /** If true, only report what would happen without making changes */
  dryRun?: boolean;
  /** Logger function (defaults to console.log) */
  log?: (msg: string) => void;
}

// ============================================================================
// Apply Engine
// ============================================================================

/**
 * Apply the CMDB Baseline Content Pack v1 to a tenant.
 *
 * This is the main entry point for the content pack engine.
 * Safe to call multiple times — idempotent by design.
 */
export async function applyBaselineContentPack(
  ds: DataSource,
  options: ContentPackApplyOptions,
): Promise<ContentPackApplyResult> {
  const { tenantId, adminUserId, dryRun = false, log = console.log } = options;

  const result: ContentPackApplyResult = {
    version: CMDB_BASELINE_CONTENT_PACK_VERSION,
    tenantId,
    dryRun,
    classes: { created: 0, updated: 0, reused: 0, skipped: 0, total: 0 },
    relationshipTypes: {
      created: 0,
      updated: 0,
      reused: 0,
      skipped: 0,
      total: 0,
    },
    actions: [],
    errors: [],
  };

  log(`CMDB Baseline Content Pack ${CMDB_BASELINE_CONTENT_PACK_VERSION}`);
  log(`Tenant: ${tenantId}`);
  log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  log('');

  const classRepo = ds.getRepository(CmdbCiClass);
  const relTypeRepo = ds.getRepository(CmdbRelationshipType);

  // ── Phase 1: Apply CI Classes ──
  log('Phase 1: Applying CI class hierarchy...');
  for (const classDef of BASELINE_CLASSES) {
    try {
      const action = await applyClass(
        classRepo,
        tenantId,
        adminUserId,
        classDef,
        dryRun,
      );
      result.actions.push({
        entity: 'CiClass',
        name: classDef.name,
        action: action.action,
        reason: action.reason,
      });
      result.classes[actionToKey(action.action)]++;
      logAction(log, action.action, 'CiClass', classDef.name, action.reason);
    } catch (err) {
      const msg = `Error applying class ${classDef.name}: ${String(err)}`;
      result.errors.push(msg);
      log(`   ERROR: ${msg}`);
    }
  }
  result.classes.total = BASELINE_CLASSES.length;
  log(
    `   Summary: ${result.classes.created} created, ${result.classes.updated} updated, ` +
      `${result.classes.reused} reused, ${result.classes.skipped} skipped\n`,
  );

  // ── Phase 2: Apply Relationship Types ──
  log('Phase 2: Applying relationship type catalog...');
  for (const relTypeDef of BASELINE_RELATIONSHIP_TYPES) {
    try {
      const action = await applyRelationshipType(
        relTypeRepo,
        tenantId,
        adminUserId,
        relTypeDef,
        dryRun,
      );
      result.actions.push({
        entity: 'RelationshipType',
        name: relTypeDef.name,
        action: action.action,
        reason: action.reason,
      });
      result.relationshipTypes[actionToKey(action.action)]++;
      logAction(log, action.action, 'RelType', relTypeDef.name, action.reason);
    } catch (err) {
      const msg = `Error applying relationship type ${relTypeDef.name}: ${String(err)}`;
      result.errors.push(msg);
      log(`   ERROR: ${msg}`);
    }
  }
  result.relationshipTypes.total = BASELINE_RELATIONSHIP_TYPES.length;
  log(
    `   Summary: ${result.relationshipTypes.created} created, ${result.relationshipTypes.updated} updated, ` +
      `${result.relationshipTypes.reused} reused, ${result.relationshipTypes.skipped} skipped\n`,
  );

  // ── Final Summary ──
  log('='.repeat(60));
  log(
    `Content Pack ${CMDB_BASELINE_CONTENT_PACK_VERSION} — ${dryRun ? 'DRY RUN' : 'APPLIED'}`,
  );
  log(
    `  Classes: ${result.classes.created}C / ${result.classes.updated}U / ${result.classes.reused}R / ${result.classes.skipped}S`,
  );
  log(
    `  Rel Types: ${result.relationshipTypes.created}C / ${result.relationshipTypes.updated}U / ${result.relationshipTypes.reused}R / ${result.relationshipTypes.skipped}S`,
  );
  if (result.errors.length > 0) {
    log(`  Errors: ${result.errors.length}`);
  }
  log('='.repeat(60));

  return result;
}

// ============================================================================
// Class Apply Logic
// ============================================================================

interface ApplyActionResult {
  action: SeedAction;
  reason?: string;
}

async function applyClass(
  repo: Repository<CmdbCiClass>,
  tenantId: string,
  adminUserId: string,
  def: BaselineClassDef,
  dryRun: boolean,
): Promise<ApplyActionResult> {
  // 1. Check by deterministic ID
  const existingById = await repo.findOne({
    where: { id: def.id, tenantId },
  });

  if (existingById) {
    if (existingById.isDeleted) {
      // Soft-deleted system class — restore it
      if (!dryRun) {
        await repo.update(existingById.id, {
          isDeleted: false,
          isSystem: true,
          name: def.name,
          label: def.label,
          description: def.description,
          icon: def.icon,
          parentClassId: def.parentClassId,
          isAbstract: def.isAbstract,
          sortOrder: def.sortOrder,
          fieldsSchema: def.fieldsSchema as never,
          metadata: buildMetadata(existingById.metadata),
          updatedBy: adminUserId,
        });
      }
      return { action: 'UPDATED', reason: 'restored from soft-delete' };
    }

    // Check if baseline fields need update (system-managed only)
    const needsUpdate = classNeedsUpdate(existingById, def);
    if (needsUpdate) {
      if (!dryRun) {
        await repo.update(existingById.id, {
          isSystem: true,
          label: def.label,
          description: def.description,
          icon: def.icon,
          parentClassId: def.parentClassId,
          isAbstract: def.isAbstract,
          sortOrder: def.sortOrder,
          fieldsSchema: def.fieldsSchema as never,
          metadata: buildMetadata(existingById.metadata),
          updatedBy: adminUserId,
        });
      }
      return { action: 'UPDATED', reason: 'baseline fields updated' };
    }

    // Ensure isSystem flag is set even if nothing else changed
    if (!existingById.isSystem) {
      if (!dryRun) {
        await repo.update(existingById.id, {
          isSystem: true,
          metadata: buildMetadata(existingById.metadata),
        });
      }
      return { action: 'UPDATED', reason: 'marked as system class' };
    }

    return { action: 'REUSED' };
  }

  // 2. Check by name (customer may have created a class with the same name)
  const existingByName = await repo.findOne({
    where: { tenantId, name: def.name, isDeleted: false },
  });

  if (existingByName) {
    // Customer-created class with same name — don't overwrite, skip
    return {
      action: 'SKIPPED',
      reason: `customer class exists with name "${def.name}" (id=${existingByName.id})`,
    };
  }

  // 3. Create new class with deterministic ID
  if (!dryRun) {
    const entity = repo.create({
      tenantId,
      name: def.name,
      label: def.label,
      description: def.description,
      icon: def.icon,
      parentClassId: def.parentClassId,
      isAbstract: def.isAbstract,
      isActive: true,
      isSystem: true,
      sortOrder: def.sortOrder,
      fieldsSchema: def.fieldsSchema,
      metadata: buildMetadata(null),
      createdBy: adminUserId,
      isDeleted: false,
    });
    entity.id = def.id;
    await repo.save(entity);
  }

  return { action: 'CREATED' };
}

// ============================================================================
// Relationship Type Apply Logic
// ============================================================================

async function applyRelationshipType(
  repo: Repository<CmdbRelationshipType>,
  tenantId: string,
  adminUserId: string,
  def: BaselineRelTypeDef,
  dryRun: boolean,
): Promise<ApplyActionResult> {
  // 1. Check by deterministic ID
  const existingById = await repo.findOne({
    where: { id: def.id, tenantId },
  });

  if (existingById) {
    if (existingById.isDeleted) {
      // Soft-deleted — restore
      if (!dryRun) {
        await repo.update(existingById.id, {
          isDeleted: false,
          isSystem: true,
          name: def.name,
          label: def.label,
          description: def.description,
          directionality: def.directionality,
          inverseLabel: def.inverseLabel,
          riskPropagation: def.riskPropagation,
          allowedSourceClasses: def.allowedSourceClasses,
          allowedTargetClasses: def.allowedTargetClasses,
          allowSelfLoop: def.allowSelfLoop,
          allowCycles: def.allowCycles,
          sortOrder: def.sortOrder,
          metadata: buildMetadata(existingById.metadata),
          updatedBy: adminUserId,
        });
      }
      return { action: 'UPDATED', reason: 'restored from soft-delete' };
    }

    // Check if needs update
    const needsUpdate = relTypeNeedsUpdate(existingById, def);
    if (needsUpdate) {
      if (!dryRun) {
        await repo.update(existingById.id, {
          isSystem: true,
          label: def.label,
          description: def.description,
          directionality: def.directionality,
          inverseLabel: def.inverseLabel,
          riskPropagation: def.riskPropagation,
          allowedSourceClasses: def.allowedSourceClasses,
          allowedTargetClasses: def.allowedTargetClasses,
          allowSelfLoop: def.allowSelfLoop,
          allowCycles: def.allowCycles,
          sortOrder: def.sortOrder,
          metadata: buildMetadata(existingById.metadata),
          updatedBy: adminUserId,
        });
      }
      return { action: 'UPDATED', reason: 'baseline semantics updated' };
    }

    // Ensure isSystem flag
    if (!existingById.isSystem) {
      if (!dryRun) {
        await repo.update(existingById.id, {
          isSystem: true,
          metadata: buildMetadata(existingById.metadata),
        });
      }
      return { action: 'UPDATED', reason: 'marked as system type' };
    }

    return { action: 'REUSED' };
  }

  // 2. Check by name
  const existingByName = await repo.findOne({
    where: { tenantId, name: def.name, isDeleted: false },
  });

  if (existingByName) {
    // Customer-created with same name — skip
    return {
      action: 'SKIPPED',
      reason: `customer relationship type exists with name "${def.name}" (id=${existingByName.id})`,
    };
  }

  // 3. Create new with deterministic ID
  if (!dryRun) {
    const entity = repo.create({
      tenantId,
      name: def.name,
      label: def.label,
      description: def.description,
      directionality: def.directionality,
      inverseLabel: def.inverseLabel,
      riskPropagation: def.riskPropagation,
      allowedSourceClasses: def.allowedSourceClasses,
      allowedTargetClasses: def.allowedTargetClasses,
      allowSelfLoop: def.allowSelfLoop,
      allowCycles: def.allowCycles,
      isActive: true,
      isSystem: true,
      sortOrder: def.sortOrder,
      metadata: buildMetadata(null),
      createdBy: adminUserId,
      isDeleted: false,
    });
    entity.id = def.id;
    await repo.save(entity);
  }

  return { action: 'CREATED' };
}

// ============================================================================
// Comparison helpers
// ============================================================================

function classNeedsUpdate(
  existing: CmdbCiClass,
  def: BaselineClassDef,
): boolean {
  return (
    existing.label !== def.label ||
    existing.description !== def.description ||
    existing.icon !== def.icon ||
    existing.parentClassId !== def.parentClassId ||
    existing.isAbstract !== def.isAbstract ||
    existing.sortOrder !== def.sortOrder ||
    JSON.stringify(existing.fieldsSchema) !== JSON.stringify(def.fieldsSchema)
  );
}

function relTypeNeedsUpdate(
  existing: CmdbRelationshipType,
  def: BaselineRelTypeDef,
): boolean {
  return (
    existing.label !== def.label ||
    existing.description !== def.description ||
    existing.directionality !== def.directionality ||
    existing.inverseLabel !== def.inverseLabel ||
    existing.riskPropagation !== def.riskPropagation ||
    existing.allowSelfLoop !== def.allowSelfLoop ||
    existing.allowCycles !== def.allowCycles ||
    existing.sortOrder !== def.sortOrder ||
    JSON.stringify(existing.allowedSourceClasses) !==
      JSON.stringify(def.allowedSourceClasses) ||
    JSON.stringify(existing.allowedTargetClasses) !==
      JSON.stringify(def.allowedTargetClasses)
  );
}

// ============================================================================
// Metadata helpers
// ============================================================================

/**
 * Build metadata object with content pack provenance.
 * Returns `as never` to satisfy TypeORM's _QueryDeepPartialEntity
 * which does not accept Record<string, unknown> in update() calls.
 */
function buildMetadata(
  existingMetadata: Record<string, unknown> | null,
): never {
  return {
    ...(existingMetadata ?? {}),
    [CONTENT_PACK_META_KEY]: CMDB_BASELINE_CONTENT_PACK_VERSION,
    source: CONTENT_PACK_SOURCE,
  } as never;
}

// ============================================================================
// Logging helpers
// ============================================================================

function actionToKey(
  action: SeedAction,
): 'created' | 'updated' | 'reused' | 'skipped' {
  switch (action) {
    case 'CREATED':
      return 'created';
    case 'UPDATED':
      return 'updated';
    case 'REUSED':
      return 'reused';
    case 'SKIPPED':
      return 'skipped';
  }
}

function logAction(
  log: (msg: string) => void,
  action: SeedAction,
  entityType: string,
  name: string,
  reason?: string,
): void {
  const icons: Record<SeedAction, string> = {
    CREATED: '+',
    UPDATED: '~',
    REUSED: '=',
    SKIPPED: '-',
  };
  const suffix = reason ? ` (${reason})` : '';
  log(`   ${icons[action]} ${action} ${entityType}: ${name}${suffix}`);
}
