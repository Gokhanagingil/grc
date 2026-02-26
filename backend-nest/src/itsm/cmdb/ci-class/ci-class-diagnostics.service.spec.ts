import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CiClassDiagnosticsService } from './ci-class-diagnostics.service';
import { CiClassInheritanceService } from './ci-class-inheritance.service';
import { CmdbCiClass } from './ci-class.entity';
import { CmdbCiClassRelationshipRule } from './ci-class-relationship-rule.entity';
import { CmdbRelationshipType } from '../relationship-type/relationship-type.entity';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const ROOT_ID = 'dddddddd-0000-0000-0000-000000000001';
const PARENT_ID = 'dddddddd-0000-0000-0000-000000000002';
const CHILD_ID = 'dddddddd-0000-0000-0000-000000000003';
const INACTIVE_ID = 'dddddddd-0000-0000-0000-000000000004';
const CYCLE_A_ID = 'dddddddd-0000-0000-0000-000000000005';
const CYCLE_B_ID = 'dddddddd-0000-0000-0000-000000000006';

// ---------------------------------------------------------------------------
// Helper to create mock class entities
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

// ---------------------------------------------------------------------------
// In-memory class store for mock repository
// ---------------------------------------------------------------------------

let classStore: CmdbCiClass[] = [];

function resetStore() {
  classStore = [];
}

function seedBaseHierarchy() {
  classStore = [
    makeClass({
      id: ROOT_ID,
      name: 'cmdb_ci',
      label: 'Configuration Item',
      fieldsSchema: [
        {
          key: 'name',
          label: 'Name',
          dataType: 'string',
          required: true,
          order: 1,
        },
        {
          key: 'description',
          label: 'Description',
          dataType: 'text',
          order: 2,
        },
      ],
    }),
    makeClass({
      id: PARENT_ID,
      name: 'cmdb_ci_hardware',
      label: 'Hardware',
      parentClassId: ROOT_ID,
      fieldsSchema: [
        {
          key: 'serial_number',
          label: 'Serial Number',
          dataType: 'string',
          order: 10,
        },
      ],
    }),
    makeClass({
      id: CHILD_ID,
      name: 'cmdb_ci_computer',
      label: 'Computer',
      parentClassId: PARENT_ID,
      fieldsSchema: [
        { key: 'cpu_count', label: 'CPU Count', dataType: 'number', order: 20 },
        // Override inherited serial_number
        {
          key: 'serial_number',
          label: 'Computer S/N',
          dataType: 'string',
          required: true,
          order: 10,
        },
      ],
    }),
  ];
}

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------

const mockRepository = {
  find: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const select = opts.select as string[] | undefined;

    let result = classStore.filter((c) => {
      if (where.tenantId && c.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted)
        return false;
      if (
        where.parentClassId !== undefined &&
        c.parentClassId !== where.parentClassId
      )
        return false;
      if (where.isActive !== undefined && c.isActive !== where.isActive)
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
    const select = opts.select as string[] | undefined;
    const match = classStore.find((c) => {
      if (where.id && c.id !== where.id) return false;
      if (where.tenantId && c.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    if (!match) return Promise.resolve(null);

    if (select) {
      const partial: Record<string, unknown> = {};
      for (const key of select) {
        partial[key] = (match as unknown as Record<string, unknown>)[key];
      }
      return Promise.resolve(partial as unknown as CmdbCiClass);
    }

    return Promise.resolve(match);
  }),
};

// ---------------------------------------------------------------------------
// Mock inheritance service
// ---------------------------------------------------------------------------

const mockInheritanceService = {
  hasCycle: jest.fn().mockResolvedValue(false),
  getAncestorChain: jest.fn().mockResolvedValue([]),
};

const mockRuleRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
};

const mockRelTypeRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CiClassDiagnosticsService', () => {
  let service: CiClassDiagnosticsService;

  beforeEach(async () => {
    resetStore();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CiClassDiagnosticsService,
        {
          provide: getRepositoryToken(CmdbCiClass),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(CmdbCiClassRelationshipRule),
          useValue: mockRuleRepo,
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

    service = module.get<CiClassDiagnosticsService>(CiClassDiagnosticsService);
  });

  // ========================================================================
  // diagnoseClass
  // ========================================================================

  describe('diagnoseClass', () => {
    it('should return CLASS_NOT_FOUND for non-existent class', async () => {
      const result = await service.diagnoseClass(TENANT_ID, 'nonexistent');

      expect(result.classId).toBe('nonexistent');
      expect(result.errorCount).toBe(1);
      expect(result.diagnostics[0].code).toBe('CLASS_NOT_FOUND');
      expect(result.diagnostics[0].severity).toBe('error');
    });

    it('should return ALL_CLEAR for a healthy root class', async () => {
      seedBaseHierarchy();

      const result = await service.diagnoseClass(TENANT_ID, ROOT_ID);

      expect(result.classId).toBe(ROOT_ID);
      expect(result.className).toBe('cmdb_ci');
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
      // ALL_CLEAR + NO_RELATIONSHIP_RULES info (mock returns no rules)
      const allClear = result.diagnostics.find((d) => d.code === 'ALL_CLEAR');
      expect(allClear).toBeDefined();
      expect(allClear!.severity).toBe('info');
    });

    it('should detect missing parent class', async () => {
      classStore = [
        makeClass({
          id: CHILD_ID,
          name: 'orphan',
          parentClassId: 'missing-parent-id',
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, CHILD_ID);

      const missingParent = result.diagnostics.find(
        (d) => d.code === 'MISSING_PARENT',
      );
      expect(missingParent).toBeDefined();
      expect(missingParent!.severity).toBe('error');
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
    });

    it('should detect inheritance cycle', async () => {
      classStore = [
        makeClass({
          id: CYCLE_A_ID,
          name: 'cycle_a',
          parentClassId: CYCLE_B_ID,
        }),
        makeClass({
          id: CYCLE_B_ID,
          name: 'cycle_b',
          parentClassId: CYCLE_A_ID,
        }),
      ];
      mockInheritanceService.hasCycle.mockResolvedValueOnce(true);

      const result = await service.diagnoseClass(TENANT_ID, CYCLE_A_ID);

      const cycleErr = result.diagnostics.find(
        (d) => d.code === 'INHERITANCE_CYCLE',
      );
      expect(cycleErr).toBeDefined();
      expect(cycleErr!.severity).toBe('error');
    });

    it('should detect field override from inherited chain', async () => {
      seedBaseHierarchy();
      // Setup mock: child overrides serial_number from hardware
      mockInheritanceService.getAncestorChain.mockResolvedValueOnce([
        {
          id: PARENT_ID,
          name: 'cmdb_ci_hardware',
          label: 'Hardware',
          depth: 1,
        },
        { id: ROOT_ID, name: 'cmdb_ci', label: 'Configuration Item', depth: 2 },
      ]);

      const result = await service.diagnoseClass(TENANT_ID, CHILD_ID);

      const overrideInfo = result.diagnostics.find(
        (d) => d.code === 'FIELD_OVERRIDE',
      );
      expect(overrideInfo).toBeDefined();
      expect(overrideInfo!.severity).toBe('info');
      expect(overrideInfo!.message).toContain('serial_number');
    });

    it('should detect empty technical name', async () => {
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: '',
          label: 'Something',
          fieldsSchema: [
            { key: 'f1', label: 'F1', dataType: 'string', order: 1 },
          ],
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, ROOT_ID);

      const emptyName = result.diagnostics.find((d) => d.code === 'EMPTY_NAME');
      expect(emptyName).toBeDefined();
      expect(emptyName!.severity).toBe('error');
    });

    it('should detect empty display label', async () => {
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: 'has_name',
          label: '',
          fieldsSchema: [
            { key: 'f1', label: 'F1', dataType: 'string', order: 1 },
          ],
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, ROOT_ID);

      const emptyLabel = result.diagnostics.find(
        (d) => d.code === 'EMPTY_LABEL',
      );
      expect(emptyLabel).toBeDefined();
      expect(emptyLabel!.severity).toBe('warning');
    });

    it('should warn about no local fields on non-abstract class', async () => {
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: 'no_fields',
          label: 'No Fields',
          fieldsSchema: [],
          isAbstract: false,
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, ROOT_ID);

      const noFields = result.diagnostics.find(
        (d) => d.code === 'NO_LOCAL_FIELDS',
      );
      expect(noFields).toBeDefined();
      expect(noFields!.severity).toBe('warning');
    });

    it('should NOT warn about no local fields on abstract class', async () => {
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: 'abstract_class',
          label: 'Abstract',
          fieldsSchema: [],
          isAbstract: true,
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, ROOT_ID);

      const noFields = result.diagnostics.find(
        (d) => d.code === 'NO_LOCAL_FIELDS',
      );
      expect(noFields).toBeUndefined();
    });

    it('should detect inactive class with active children', async () => {
      classStore = [
        makeClass({
          id: INACTIVE_ID,
          name: 'inactive_parent',
          label: 'Inactive',
          isActive: false,
          fieldsSchema: [
            { key: 'f1', label: 'F1', dataType: 'string', order: 1 },
          ],
        }),
        makeClass({
          id: CHILD_ID,
          name: 'active_child',
          label: 'Active Child',
          parentClassId: INACTIVE_ID,
          isActive: true,
          fieldsSchema: [
            { key: 'f2', label: 'F2', dataType: 'string', order: 1 },
          ],
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, INACTIVE_ID);

      const inactiveErr = result.diagnostics.find(
        (d) => d.code === 'INACTIVE_WITH_ACTIVE_CHILDREN',
      );
      expect(inactiveErr).toBeDefined();
      expect(inactiveErr!.severity).toBe('warning');
    });

    it('should correctly count errors, warnings, and infos', async () => {
      // Class with empty name (error) + empty label (warning) + no fields (warning)
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: '',
          label: '',
          fieldsSchema: [],
          isAbstract: false,
        }),
      ];

      const result = await service.diagnoseClass(TENANT_ID, ROOT_ID);

      expect(result.errorCount).toBe(1); // EMPTY_NAME
      expect(result.warningCount).toBe(2); // EMPTY_LABEL + NO_LOCAL_FIELDS
      // infoCount includes NO_RELATIONSHIP_RULES from relationship diagnostics
      expect(result.infoCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // getPageDiagnosticsSummary
  // ========================================================================

  describe('getPageDiagnosticsSummary', () => {
    it('should return zeros for empty tenant', async () => {
      const summary = await service.getPageDiagnosticsSummary(TENANT_ID);

      expect(summary.totalClasses).toBe(0);
      expect(summary.classesWithErrors).toBe(0);
      expect(summary.classesWithWarnings).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.totalWarnings).toBe(0);
      expect(summary.totalInfos).toBe(0);
      expect(summary.topIssues).toEqual([]);
    });

    it('should aggregate diagnostics across all classes', async () => {
      seedBaseHierarchy();
      // Root: healthy (ALL_CLEAR), parent: no-local-fields warning? NO - it has serial_number
      // Child has fields. All healthy.

      const summary = await service.getPageDiagnosticsSummary(TENANT_ID);

      expect(summary.totalClasses).toBe(3);
    });

    it('should count classes with errors separately from warnings', async () => {
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: '',
          label: 'Root',
          fieldsSchema: [
            { key: 'f1', label: 'F1', dataType: 'string', order: 1 },
          ],
        }), // EMPTY_NAME → error
        makeClass({
          id: PARENT_ID,
          name: 'healthy',
          label: 'Healthy',
          fieldsSchema: [
            { key: 'f2', label: 'F2', dataType: 'string', order: 1 },
          ],
        }), // ALL_CLEAR
      ];

      const summary = await service.getPageDiagnosticsSummary(TENANT_ID);

      expect(summary.totalClasses).toBe(2);
      expect(summary.classesWithErrors).toBe(1);
      expect(summary.totalErrors).toBe(1);
    });

    it('should sort topIssues with errors before warnings', async () => {
      classStore = [
        makeClass({
          id: ROOT_ID,
          name: '',
          label: '',
          fieldsSchema: [],
          isAbstract: false,
        }),
      ];

      const summary = await service.getPageDiagnosticsSummary(TENANT_ID);

      expect(summary.topIssues.length).toBeGreaterThan(0);
      // First issue should be an error
      expect(summary.topIssues[0].severity).toBe('error');
    });
  });
});
