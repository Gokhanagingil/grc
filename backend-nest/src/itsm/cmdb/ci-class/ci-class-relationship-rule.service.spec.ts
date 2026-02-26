import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CiClassRelationshipRuleService } from './ci-class-relationship-rule.service';
import {
  CmdbCiClassRelationshipRule,
  RuleDirection,
  PropagationPolicy,
  PropagationWeight,
} from './ci-class-relationship-rule.entity';
import { CmdbCiClass } from './ci-class.entity';
import { CiClassInheritanceService } from './ci-class-inheritance.service';
import {
  CmdbRelationshipType,
  RelationshipDirectionality,
  RiskPropagationHint,
} from '../relationship-type/relationship-type.entity';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-001';

const ROOT_CLASS_ID = 'cccccccc-0000-0000-0000-000000000001';
const PARENT_CLASS_ID = 'cccccccc-0000-0000-0000-000000000002';
const CHILD_CLASS_ID = 'cccccccc-0000-0000-0000-000000000003';
const TARGET_CLASS_ID = 'cccccccc-0000-0000-0000-000000000004';

const REL_TYPE_DEPENDS_ON = 'rrrrrrrr-0000-0000-0000-000000000001';
const REL_TYPE_RUNS_ON = 'rrrrrrrr-0000-0000-0000-000000000002';

const RULE_ID_1 = 'eeeeeeee-0000-0000-0000-000000000001';
const RULE_ID_2 = 'eeeeeeee-0000-0000-0000-000000000002';
const RULE_ID_3 = 'eeeeeeee-0000-0000-0000-000000000003';

// ---------------------------------------------------------------------------
// Mock data stores
// ---------------------------------------------------------------------------

let classStore: CmdbCiClass[] = [];
let ruleStore: CmdbCiClassRelationshipRule[] = [];
let relTypeStore: CmdbRelationshipType[] = [];

function resetStores() {
  classStore = [];
  ruleStore = [];
  relTypeStore = [];
}

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeClass(
  overrides: Partial<CmdbCiClass> & { id: string; name: string },
): CmdbCiClass {
  return {
    id: overrides.id,
    tenantId: overrides.tenantId ?? TENANT_ID,
    name: overrides.name,
    label: overrides.label ?? overrides.name,
    description: overrides.description ?? null,
    icon: overrides.icon ?? null,
    parentClassId: overrides.parentClassId ?? null,
    parentClass: null,
    children: [],
    isAbstract: overrides.isAbstract ?? false,
    isActive: overrides.isActive ?? true,
    isSystem: overrides.isSystem ?? false,
    sortOrder: overrides.sortOrder ?? 0,
    fieldsSchema: overrides.fieldsSchema ?? null,
    metadata: overrides.metadata ?? null,
    tenant: null as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: overrides.isDeleted ?? false,
  } as CmdbCiClass;
}

function makeRelType(
  overrides: Partial<CmdbRelationshipType> & { id: string; name: string },
): CmdbRelationshipType {
  return {
    id: overrides.id,
    tenantId: overrides.tenantId ?? TENANT_ID,
    name: overrides.name,
    label: overrides.label ?? overrides.name,
    description: overrides.description ?? null,
    directionality:
      overrides.directionality ?? RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: overrides.inverseLabel ?? null,
    riskPropagation: overrides.riskPropagation ?? RiskPropagationHint.FORWARD,
    allowedSourceClasses: overrides.allowedSourceClasses ?? null,
    allowedTargetClasses: overrides.allowedTargetClasses ?? null,
    allowSelfLoop: overrides.allowSelfLoop ?? false,
    allowCycles: overrides.allowCycles ?? true,
    sortOrder: overrides.sortOrder ?? 0,
    isSystem: overrides.isSystem ?? false,
    isActive: overrides.isActive ?? true,
    metadata: overrides.metadata ?? null,
    tenant: null as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: overrides.isDeleted ?? false,
  } as CmdbRelationshipType;
}

function makeRule(
  overrides: Partial<CmdbCiClassRelationshipRule> & { id: string },
): CmdbCiClassRelationshipRule {
  return {
    id: overrides.id,
    tenantId: overrides.tenantId ?? TENANT_ID,
    sourceClassId: overrides.sourceClassId ?? ROOT_CLASS_ID,
    relationshipTypeId: overrides.relationshipTypeId ?? REL_TYPE_DEPENDS_ON,
    targetClassId: overrides.targetClassId ?? TARGET_CLASS_ID,
    direction: overrides.direction ?? RuleDirection.OUTBOUND,
    propagationOverride: overrides.propagationOverride ?? null,
    propagationWeight: overrides.propagationWeight ?? null,
    isActive: overrides.isActive ?? true,
    isSystem: overrides.isSystem ?? false,
    metadata: overrides.metadata ?? null,
    tenant: null as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    isDeleted: overrides.isDeleted ?? false,
  } as CmdbCiClassRelationshipRule;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function seedClassHierarchy() {
  classStore = [
    makeClass({
      id: ROOT_CLASS_ID,
      name: 'cmdb_ci',
      label: 'Configuration Item',
    }),
    makeClass({
      id: PARENT_CLASS_ID,
      name: 'cmdb_ci_hardware',
      label: 'Hardware',
      parentClassId: ROOT_CLASS_ID,
    }),
    makeClass({
      id: CHILD_CLASS_ID,
      name: 'cmdb_ci_server',
      label: 'Server',
      parentClassId: PARENT_CLASS_ID,
    }),
    makeClass({
      id: TARGET_CLASS_ID,
      name: 'cmdb_ci_app',
      label: 'Application',
    }),
  ];
}

function seedRelTypes() {
  relTypeStore = [
    makeRelType({
      id: REL_TYPE_DEPENDS_ON,
      name: 'depends_on',
      label: 'Depends On',
      riskPropagation: RiskPropagationHint.FORWARD,
    }),
    makeRelType({
      id: REL_TYPE_RUNS_ON,
      name: 'runs_on',
      label: 'Runs On',
      riskPropagation: RiskPropagationHint.REVERSE,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Mock repositories
// ---------------------------------------------------------------------------

const mockClassRepo = {
  find: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const select = opts.select as string[] | undefined;
    let result = classStore.filter((c) => {
      if (where.tenantId && c.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    if (select) {
      result = result.map((c) => {
        const partial: Record<string, unknown> = {};
        for (const key of select) {
          partial[key] = (c as unknown as Record<string, unknown>)[key];
        }
        return partial as unknown as CmdbCiClass;
      });
    }
    return Promise.resolve(result);
  }),
  findOne: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const match = classStore.find((c) => {
      if (where.id && c.id !== where.id) return false;
      if (where.tenantId && c.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    return Promise.resolve(match ?? null);
  }),
};

const mockRelTypeRepo = {
  find: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const result = relTypeStore.filter((rt) => {
      if (where.tenantId && rt.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && rt.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    return Promise.resolve(result);
  }),
  findOne: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const match = relTypeStore.find((rt) => {
      if (where.id && rt.id !== where.id) return false;
      if (where.tenantId && rt.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && rt.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    return Promise.resolve(match ?? null);
  }),
};

const mockRuleRepo = {
  find: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const result = ruleStore.filter((r) => {
      if (where.tenantId && r.tenantId !== where.tenantId) return false;
      if (where.sourceClassId && r.sourceClassId !== where.sourceClassId)
        return false;
      if (
        where.relationshipTypeId &&
        r.relationshipTypeId !== where.relationshipTypeId
      )
        return false;
      if (where.targetClassId && r.targetClassId !== where.targetClassId)
        return false;
      if (where.isDeleted !== undefined && r.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    return Promise.resolve(result);
  }),
  findOne: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const match = ruleStore.find((r) => {
      if (where.id && r.id !== where.id) return false;
      if (where.tenantId && r.tenantId !== where.tenantId) return false;
      if (where.sourceClassId && r.sourceClassId !== where.sourceClassId)
        return false;
      if (
        where.relationshipTypeId &&
        r.relationshipTypeId !== where.relationshipTypeId
      )
        return false;
      if (where.targetClassId && r.targetClassId !== where.targetClassId)
        return false;
      if (where.isDeleted !== undefined && r.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    return Promise.resolve(match ?? null);
  }),
  create: jest.fn().mockImplementation((data: Record<string, unknown>) => data),
  save: jest.fn().mockImplementation((entity: CmdbCiClassRelationshipRule) => {
    const idx = ruleStore.findIndex((r) => r.id === entity.id);
    if (idx >= 0) {
      ruleStore[idx] = entity;
    } else {
      ruleStore.push(entity);
    }
    return Promise.resolve(entity);
  }),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockImplementation(() => {
      return Promise.resolve(
        ruleStore.filter((r) => r.tenantId === TENANT_ID && !r.isDeleted),
      );
    }),
  }),
};

const mockInheritanceService = {
  getAncestorChain: jest.fn().mockResolvedValue([]),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CiClassRelationshipRuleService', () => {
  let service: CiClassRelationshipRuleService;

  beforeEach(async () => {
    resetStores();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CiClassRelationshipRuleService,
        {
          provide: getRepositoryToken(CmdbCiClassRelationshipRule),
          useValue: mockRuleRepo,
        },
        {
          provide: getRepositoryToken(CmdbCiClass),
          useValue: mockClassRepo,
        },
        {
          provide: getRepositoryToken(CmdbRelationshipType),
          useValue: mockRelTypeRepo,
        },
        {
          provide: CiClassInheritanceService,
          useValue: mockInheritanceService,
        },
      ],
    }).compile();

    service = module.get<CiClassRelationshipRuleService>(
      CiClassRelationshipRuleService,
    );
  });

  // ========================================================================
  // CRUD: createRule
  // ========================================================================

  describe('createRule', () => {
    it('should create a rule with valid references', async () => {
      seedClassHierarchy();
      seedRelTypes();

      const result = await service.createRule(TENANT_ID, USER_ID, {
        sourceClassId: ROOT_CLASS_ID,
        relationshipTypeId: REL_TYPE_DEPENDS_ON,
        targetClassId: TARGET_CLASS_ID,
        direction: RuleDirection.OUTBOUND,
      });

      expect(result).toBeDefined();
      expect(result.sourceClassId).toBe(ROOT_CLASS_ID);
      expect(result.relationshipTypeId).toBe(REL_TYPE_DEPENDS_ON);
      expect(result.targetClassId).toBe(TARGET_CLASS_ID);
      expect(mockRuleRepo.save).toHaveBeenCalled();
    });

    it('should reject duplicate rule', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      await expect(
        service.createRule(TENANT_ID, USER_ID, {
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid source class reference', async () => {
      seedRelTypes();
      // No classes in store

      await expect(
        service.createRule(TENANT_ID, USER_ID, {
          sourceClassId: 'nonexistent',
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid relationship type reference', async () => {
      seedClassHierarchy();
      // No rel types in store

      await expect(
        service.createRule(TENANT_ID, USER_ID, {
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: 'nonexistent',
          targetClassId: TARGET_CLASS_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid target class reference', async () => {
      seedClassHierarchy();
      seedRelTypes();

      await expect(
        service.createRule(TENANT_ID, USER_ID, {
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: 'nonexistent',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================================================
  // CRUD: updateRule
  // ========================================================================

  describe('updateRule', () => {
    it('should update non-system rule', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(makeRule({ id: RULE_ID_1, isSystem: false }));

      const result = await service.updateRule(TENANT_ID, USER_ID, RULE_ID_1, {
        direction: RuleDirection.INBOUND,
        propagationOverride: PropagationPolicy.BOTH,
      });

      expect(result).toBeDefined();
      expect(result!.direction).toBe(RuleDirection.INBOUND);
      expect(result!.propagationOverride).toBe(PropagationPolicy.BOTH);
    });

    it('should return null for non-existent rule', async () => {
      const result = await service.updateRule(
        TENANT_ID,
        USER_ID,
        'nonexistent',
        {
          direction: RuleDirection.INBOUND,
        },
      );
      expect(result).toBeNull();
    });

    it('should protect system rule key fields from modification', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(makeRule({ id: RULE_ID_1, isSystem: true }));

      await expect(
        service.updateRule(TENANT_ID, USER_ID, RULE_ID_1, {
          sourceClassId: 'new-source',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateRule(TENANT_ID, USER_ID, RULE_ID_1, {
          relationshipTypeId: 'new-type',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateRule(TENANT_ID, USER_ID, RULE_ID_1, {
          targetClassId: 'new-target',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow updating non-key fields on system rule', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(makeRule({ id: RULE_ID_1, isSystem: true }));

      const result = await service.updateRule(TENANT_ID, USER_ID, RULE_ID_1, {
        isActive: false,
        propagationOverride: PropagationPolicy.UPSTREAM_ONLY,
      });

      expect(result).toBeDefined();
      expect(result!.isActive).toBe(false);
      expect(result!.propagationOverride).toBe(PropagationPolicy.UPSTREAM_ONLY);
    });
  });

  // ========================================================================
  // CRUD: softDeleteRule
  // ========================================================================

  describe('softDeleteRule', () => {
    it('should soft-delete an existing rule', async () => {
      ruleStore.push(makeRule({ id: RULE_ID_1 }));

      const result = await service.softDeleteRule(
        TENANT_ID,
        USER_ID,
        RULE_ID_1,
      );

      expect(result).toBe(true);
      expect(ruleStore[0].isDeleted).toBe(true);
    });

    it('should return false for non-existent rule', async () => {
      const result = await service.softDeleteRule(
        TENANT_ID,
        USER_ID,
        'nonexistent',
      );
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Effective Rules (Inheritance-Aware)
  // ========================================================================

  describe('getEffectiveRules', () => {
    it('should throw for non-existent class', async () => {
      await expect(
        service.getEffectiveRules(TENANT_ID, 'nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty rules for class with no rules', async () => {
      seedClassHierarchy();
      seedRelTypes();

      const result = await service.getEffectiveRules(TENANT_ID, ROOT_CLASS_ID);

      expect(result.classId).toBe(ROOT_CLASS_ID);
      expect(result.className).toBe('cmdb_ci');
      expect(result.effectiveRules).toHaveLength(0);
      expect(result.totalRuleCount).toBe(0);
      expect(result.inheritedRuleCount).toBe(0);
      expect(result.localRuleCount).toBe(0);
    });

    it('should return local rules for root class', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      const result = await service.getEffectiveRules(TENANT_ID, ROOT_CLASS_ID);

      expect(result.effectiveRules).toHaveLength(1);
      expect(result.totalRuleCount).toBe(1);
      expect(result.localRuleCount).toBe(1);
      expect(result.inheritedRuleCount).toBe(0);
      expect(result.effectiveRules[0].inherited).toBe(false);
      expect(result.effectiveRules[0].originClassId).toBe(ROOT_CLASS_ID);
    });

    it('should merge inherited rules from parent chain', async () => {
      seedClassHierarchy();
      seedRelTypes();

      // Rule on root (ancestor of child)
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      // Rule on parent (ancestor of child)
      ruleStore.push(
        makeRule({
          id: RULE_ID_2,
          sourceClassId: PARENT_CLASS_ID,
          relationshipTypeId: REL_TYPE_RUNS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      // Mock ancestor chain for child: [parent(depth=1), root(depth=2)]
      mockInheritanceService.getAncestorChain.mockResolvedValueOnce([
        {
          id: PARENT_CLASS_ID,
          name: 'cmdb_ci_hardware',
          label: 'Hardware',
          depth: 1,
        },
        {
          id: ROOT_CLASS_ID,
          name: 'cmdb_ci',
          label: 'Configuration Item',
          depth: 2,
        },
      ]);

      const result = await service.getEffectiveRules(TENANT_ID, CHILD_CLASS_ID);

      expect(result.effectiveRules).toHaveLength(2);
      expect(result.inheritedRuleCount).toBe(2);
      expect(result.localRuleCount).toBe(0);

      // Both rules should be marked as inherited
      for (const rule of result.effectiveRules) {
        expect(rule.inherited).toBe(true);
      }
    });

    it('should allow child to override parent rule (nearest wins on same collision key)', async () => {
      seedClassHierarchy();
      seedRelTypes();

      // The collision key is sourceClassId::relationshipTypeId::targetClassId.
      // For a child to override a parent rule, both rules must share the same
      // sourceClassId (the owning class stored on the rule row). In practice
      // this happens when a parent defines a rule for its own id and the child
      // re-defines the exact same triple, but the typical pattern is different
      // sourceClassIds (parent owns its own, child owns its own).
      //
      // We test the override path by having BOTH rules reference the SAME
      // sourceClassId (ROOT_CLASS_ID). The root ancestor layer inserts first,
      // then the child layer overwrites the same key.
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
          propagationOverride: null,
        }),
      );

      // Child defines a rule with the SAME sourceClassId + relType + target
      // (different rule row id), simulating an explicit override.
      ruleStore.push(
        makeRule({
          id: RULE_ID_2,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
          propagationOverride: PropagationPolicy.BOTH,
          propagationWeight: PropagationWeight.HIGH,
        }),
      );

      // Mock ancestor chain: [root(depth=1)]
      mockInheritanceService.getAncestorChain.mockResolvedValueOnce([
        {
          id: ROOT_CLASS_ID,
          name: 'cmdb_ci',
          label: 'Configuration Item',
          depth: 1,
        },
      ]);

      const result = await service.getEffectiveRules(TENANT_ID, CHILD_CLASS_ID);

      // Both rules share the same collision key, so only one survives.
      // The child layer processes ROOT_CLASS_ID rules again (mock returns all
      // matching rules), but in real usage the child would have its own
      // sourceClassId. Here, the last layer (self) overwrites the ancestor
      // entry, so the surviving rule is whichever the mock returns last.
      // With our mock, both rules are returned for sourceClassId=ROOT_CLASS_ID,
      // and the second one (RULE_ID_2) overwrites the first.
      expect(result.effectiveRules).toHaveLength(1);

      const effectiveRule = result.effectiveRules[0];
      expect(effectiveRule.propagationOverride).toBe(PropagationPolicy.BOTH);
      expect(effectiveRule.propagationWeight).toBe(PropagationWeight.HIGH);
    });

    it('should produce separate entries when parent and child have different sourceClassIds', async () => {
      seedClassHierarchy();
      seedRelTypes();

      // Root defines depends_on from ROOT → TARGET
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      // Child defines depends_on from CHILD → TARGET (different sourceClassId = different key)
      ruleStore.push(
        makeRule({
          id: RULE_ID_2,
          sourceClassId: CHILD_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
          propagationOverride: PropagationPolicy.BOTH,
        }),
      );

      mockInheritanceService.getAncestorChain.mockResolvedValueOnce([
        {
          id: ROOT_CLASS_ID,
          name: 'cmdb_ci',
          label: 'Configuration Item',
          depth: 1,
        },
      ]);

      const result = await service.getEffectiveRules(TENANT_ID, CHILD_CLASS_ID);

      // Different sourceClassIds → different collision keys → both survive
      expect(result.effectiveRules).toHaveLength(2);
      expect(result.inheritedRuleCount).toBe(1);
      expect(result.localRuleCount).toBe(1);
    });

    it('should mix inherited and local rules', async () => {
      seedClassHierarchy();
      seedRelTypes();

      // Root defines depends_on → app (will be inherited)
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      // Child adds its own rule: runs_on → app (local)
      ruleStore.push(
        makeRule({
          id: RULE_ID_3,
          sourceClassId: CHILD_CLASS_ID,
          relationshipTypeId: REL_TYPE_RUNS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      // Mock ancestor chain
      mockInheritanceService.getAncestorChain.mockResolvedValueOnce([
        {
          id: ROOT_CLASS_ID,
          name: 'cmdb_ci',
          label: 'Configuration Item',
          depth: 1,
        },
      ]);

      const result = await service.getEffectiveRules(TENANT_ID, CHILD_CLASS_ID);

      expect(result.effectiveRules).toHaveLength(2);
      expect(result.inheritedRuleCount).toBe(1);
      expect(result.localRuleCount).toBe(1);

      const inherited = result.effectiveRules.find((r) => r.inherited);
      const local = result.effectiveRules.find((r) => !r.inherited);

      expect(inherited).toBeDefined();
      expect(inherited!.originClassId).toBe(ROOT_CLASS_ID);

      expect(local).toBeDefined();
      expect(local!.originClassId).toBe(CHILD_CLASS_ID);
    });

    it('should enrich rules with relationship type labels', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      const result = await service.getEffectiveRules(TENANT_ID, ROOT_CLASS_ID);

      expect(result.effectiveRules[0].relationshipTypeName).toBe('depends_on');
      expect(result.effectiveRules[0].relationshipTypeLabel).toBe('Depends On');
      expect(result.effectiveRules[0].defaultPropagation).toBe('forward');
      expect(result.effectiveRules[0].directionality).toBe('unidirectional');
    });

    it('should enrich rules with source and target class labels', async () => {
      seedClassHierarchy();
      seedRelTypes();
      ruleStore.push(
        makeRule({
          id: RULE_ID_1,
          sourceClassId: ROOT_CLASS_ID,
          relationshipTypeId: REL_TYPE_DEPENDS_ON,
          targetClassId: TARGET_CLASS_ID,
        }),
      );

      const result = await service.getEffectiveRules(TENANT_ID, ROOT_CLASS_ID);

      expect(result.effectiveRules[0].sourceClassName).toBe('cmdb_ci');
      expect(result.effectiveRules[0].sourceClassLabel).toBe(
        'Configuration Item',
      );
      expect(result.effectiveRules[0].targetClassName).toBe('cmdb_ci_app');
      expect(result.effectiveRules[0].targetClassLabel).toBe('Application');
    });
  });

  // ========================================================================
  // findAllForTenant
  // ========================================================================

  describe('findAllForTenant', () => {
    it('should return all rules for tenant', async () => {
      ruleStore.push(makeRule({ id: RULE_ID_1 }));
      ruleStore.push(
        makeRule({ id: RULE_ID_2, relationshipTypeId: REL_TYPE_RUNS_ON }),
      );

      const result = await service.findAllForTenant(TENANT_ID);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for tenant with no rules', async () => {
      const result = await service.findAllForTenant(TENANT_ID);
      expect(result).toHaveLength(0);
    });
  });

  // ========================================================================
  // findOneForTenant
  // ========================================================================

  describe('findOneForTenant', () => {
    it('should return rule by id', async () => {
      ruleStore.push(makeRule({ id: RULE_ID_1 }));

      const result = await service.findOneForTenant(TENANT_ID, RULE_ID_1);
      expect(result).toBeDefined();
      expect(result!.id).toBe(RULE_ID_1);
    });

    it('should return null for non-existent rule', async () => {
      const result = await service.findOneForTenant(TENANT_ID, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should not return soft-deleted rules', async () => {
      ruleStore.push(makeRule({ id: RULE_ID_1, isDeleted: true }));

      const result = await service.findOneForTenant(TENANT_ID, RULE_ID_1);
      expect(result).toBeNull();
    });
  });
});
