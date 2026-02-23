/**
 * CMDB Model Intelligence 2.0 — Relationship Type Semantics Contract Tests
 *
 * Validates the relationship type service contract shapes and the semantics
 * validation service behavior using deterministic seed data structures.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CmdbRelationshipType,
  RelationshipDirectionality,
  RiskPropagationHint,
} from './relationship-type.entity';
import { RelationshipSemanticsValidationService } from './relationship-semantics-validation.service';
import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiClass } from '../ci-class/ci-class.entity';
import { CiClassInheritanceService } from '../ci-class/ci-class-inheritance.service';

// ============================================================================
// Constants matching seed-cmdb-mi-demo.ts
// ============================================================================

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const RELTYPE_IDS = {
  depends_on: 'r1a00000-0000-0000-0000-000000000001',
  runs_on: 'r1a00000-0000-0000-0000-000000000002',
  hosted_on: 'r1a00000-0000-0000-0000-000000000003',
  connects_to: 'r1a00000-0000-0000-0000-000000000004',
  used_by: 'r1a00000-0000-0000-0000-000000000005',
  contains: 'r1a00000-0000-0000-0000-000000000006',
  member_of: 'r1a00000-0000-0000-0000-000000000007',
};

// ============================================================================
// Helper: create mock relationship type entity
// ============================================================================

function makeRelType(
  overrides: Partial<CmdbRelationshipType> & { name: string },
): CmdbRelationshipType {
  return {
    id: overrides.id ?? `reltype-${overrides.name}`,
    tenantId: TENANT_ID,
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
    isSystem: overrides.isSystem ?? true,
    isActive: overrides.isActive ?? true,
    isDeleted: overrides.isDeleted ?? false,
    metadata: overrides.metadata ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    tenant: null as never,
  } as CmdbRelationshipType;
}

// ============================================================================
// In-memory store mirroring the MI seed relationship types
// ============================================================================

let relTypeStore: CmdbRelationshipType[] = [];

function seedRelTypes() {
  relTypeStore = [
    makeRelType({
      id: RELTYPE_IDS.depends_on,
      name: 'depends_on',
      label: 'Depends On',
      directionality: RelationshipDirectionality.UNIDIRECTIONAL,
      inverseLabel: 'Depended On By',
      riskPropagation: RiskPropagationHint.FORWARD,
      allowSelfLoop: false,
      allowCycles: false,
      sortOrder: 10,
    }),
    makeRelType({
      id: RELTYPE_IDS.runs_on,
      name: 'runs_on',
      label: 'Runs On',
      directionality: RelationshipDirectionality.UNIDIRECTIONAL,
      inverseLabel: 'Hosts',
      riskPropagation: RiskPropagationHint.REVERSE,
      allowedSourceClasses: ['cmdb_ci_application'],
      allowedTargetClasses: [
        'cmdb_ci_hardware',
        'cmdb_ci_computer',
        'cmdb_ci_server',
      ],
      allowSelfLoop: false,
      allowCycles: false,
      sortOrder: 20,
    }),
    makeRelType({
      id: RELTYPE_IDS.hosted_on,
      name: 'hosted_on',
      label: 'Hosted On',
      directionality: RelationshipDirectionality.UNIDIRECTIONAL,
      inverseLabel: 'Hosts',
      riskPropagation: RiskPropagationHint.REVERSE,
      allowedTargetClasses: [
        'cmdb_ci_hardware',
        'cmdb_ci_computer',
        'cmdb_ci_server',
      ],
      allowSelfLoop: false,
      allowCycles: false,
      sortOrder: 30,
    }),
    makeRelType({
      id: RELTYPE_IDS.connects_to,
      name: 'connects_to',
      label: 'Connects To',
      directionality: RelationshipDirectionality.BIDIRECTIONAL,
      inverseLabel: 'Connected From',
      riskPropagation: RiskPropagationHint.BOTH,
      allowSelfLoop: false,
      allowCycles: true,
      sortOrder: 40,
    }),
    makeRelType({
      id: RELTYPE_IDS.used_by,
      name: 'used_by',
      label: 'Used By',
      directionality: RelationshipDirectionality.UNIDIRECTIONAL,
      inverseLabel: 'Uses',
      riskPropagation: RiskPropagationHint.REVERSE,
      allowSelfLoop: false,
      allowCycles: false,
      sortOrder: 50,
    }),
    makeRelType({
      id: RELTYPE_IDS.contains,
      name: 'contains',
      label: 'Contains',
      directionality: RelationshipDirectionality.UNIDIRECTIONAL,
      inverseLabel: 'Contained By',
      riskPropagation: RiskPropagationHint.FORWARD,
      allowSelfLoop: false,
      allowCycles: false,
      sortOrder: 60,
    }),
    makeRelType({
      id: RELTYPE_IDS.member_of,
      name: 'member_of',
      label: 'Member Of',
      directionality: RelationshipDirectionality.UNIDIRECTIONAL,
      inverseLabel: 'Has Member',
      riskPropagation: RiskPropagationHint.NONE,
      allowSelfLoop: false,
      allowCycles: false,
      sortOrder: 70,
    }),
  ];
}

// ============================================================================
// Tests: Relationship Type Semantics Catalog Contract
// ============================================================================

describe('CMDB MI 2.0 — Relationship Type Semantics Contract', () => {
  describe('Seed Data Completeness', () => {
    beforeEach(() => seedRelTypes());

    it('should have 7 relationship types', () => {
      expect(relTypeStore).toHaveLength(7);
    });

    it('each relationship type should have deterministic IDs', () => {
      const ids = relTypeStore.map((rt) => rt.id);
      expect(ids).toContain(RELTYPE_IDS.depends_on);
      expect(ids).toContain(RELTYPE_IDS.runs_on);
      expect(ids).toContain(RELTYPE_IDS.hosted_on);
      expect(ids).toContain(RELTYPE_IDS.connects_to);
      expect(ids).toContain(RELTYPE_IDS.used_by);
      expect(ids).toContain(RELTYPE_IDS.contains);
      expect(ids).toContain(RELTYPE_IDS.member_of);
    });

    it('all types should be system types', () => {
      for (const rt of relTypeStore) {
        expect(rt.isSystem).toBe(true);
      }
    });

    it('all types should be active and not deleted', () => {
      for (const rt of relTypeStore) {
        expect(rt.isActive).toBe(true);
        expect(rt.isDeleted).toBe(false);
      }
    });
  });

  describe('Directionality Semantics', () => {
    beforeEach(() => seedRelTypes());

    it('depends_on should be unidirectional', () => {
      const rt = relTypeStore.find((r) => r.name === 'depends_on')!;
      expect(rt.directionality).toBe(RelationshipDirectionality.UNIDIRECTIONAL);
    });

    it('connects_to should be bidirectional', () => {
      const rt = relTypeStore.find((r) => r.name === 'connects_to')!;
      expect(rt.directionality).toBe(RelationshipDirectionality.BIDIRECTIONAL);
    });

    it('all unidirectional types should have an inverse label', () => {
      const uniTypes = relTypeStore.filter(
        (r) => r.directionality === RelationshipDirectionality.UNIDIRECTIONAL,
      );
      expect(uniTypes.length).toBeGreaterThan(0);
      for (const rt of uniTypes) {
        expect(rt.inverseLabel).not.toBeNull();
        expect(rt.inverseLabel!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Risk Propagation Semantics', () => {
    beforeEach(() => seedRelTypes());

    it('depends_on: forward propagation (target failure impacts source)', () => {
      const rt = relTypeStore.find((r) => r.name === 'depends_on')!;
      expect(rt.riskPropagation).toBe(RiskPropagationHint.FORWARD);
    });

    it('runs_on: reverse propagation (infra failure impacts app)', () => {
      const rt = relTypeStore.find((r) => r.name === 'runs_on')!;
      expect(rt.riskPropagation).toBe(RiskPropagationHint.REVERSE);
    });

    it('connects_to: both directions', () => {
      const rt = relTypeStore.find((r) => r.name === 'connects_to')!;
      expect(rt.riskPropagation).toBe(RiskPropagationHint.BOTH);
    });

    it('member_of: no propagation', () => {
      const rt = relTypeStore.find((r) => r.name === 'member_of')!;
      expect(rt.riskPropagation).toBe(RiskPropagationHint.NONE);
    });

    it('every risk propagation value should be one of the valid enums', () => {
      const validValues = [
        RiskPropagationHint.FORWARD,
        RiskPropagationHint.REVERSE,
        RiskPropagationHint.BOTH,
        RiskPropagationHint.NONE,
      ];
      for (const rt of relTypeStore) {
        expect(validValues).toContain(rt.riskPropagation);
      }
    });
  });

  describe('Class Compatibility Rules', () => {
    beforeEach(() => seedRelTypes());

    it('runs_on: allowed source = applications only', () => {
      const rt = relTypeStore.find((r) => r.name === 'runs_on')!;
      expect(rt.allowedSourceClasses).toEqual(['cmdb_ci_application']);
    });

    it('runs_on: allowed targets = hardware family', () => {
      const rt = relTypeStore.find((r) => r.name === 'runs_on')!;
      expect(rt.allowedTargetClasses).toEqual(
        expect.arrayContaining([
          'cmdb_ci_hardware',
          'cmdb_ci_computer',
          'cmdb_ci_server',
        ]),
      );
    });

    it('depends_on: no class restrictions (null)', () => {
      const rt = relTypeStore.find((r) => r.name === 'depends_on')!;
      expect(rt.allowedSourceClasses).toBeNull();
      expect(rt.allowedTargetClasses).toBeNull();
    });

    it('connects_to: no class restrictions (any-to-any)', () => {
      const rt = relTypeStore.find((r) => r.name === 'connects_to')!;
      expect(rt.allowedSourceClasses).toBeNull();
      expect(rt.allowedTargetClasses).toBeNull();
    });
  });

  describe('Cycle and Self-Loop Policy', () => {
    beforeEach(() => seedRelTypes());

    it('no types should allow self-loops', () => {
      for (const rt of relTypeStore) {
        expect(rt.allowSelfLoop).toBe(false);
      }
    });

    it('depends_on should not allow cycles', () => {
      const rt = relTypeStore.find((r) => r.name === 'depends_on')!;
      expect(rt.allowCycles).toBe(false);
    });

    it('connects_to should allow cycles (bidirectional connectivity)', () => {
      const rt = relTypeStore.find((r) => r.name === 'connects_to')!;
      expect(rt.allowCycles).toBe(true);
    });
  });

  describe('Entity Shape Contract', () => {
    beforeEach(() => seedRelTypes());

    it('each relationship type should have the expected fields', () => {
      for (const rt of relTypeStore) {
        expect(rt).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            tenantId: expect.any(String),
            name: expect.any(String),
            label: expect.any(String),
            directionality: expect.any(String),
            riskPropagation: expect.any(String),
            allowSelfLoop: expect.any(Boolean),
            allowCycles: expect.any(Boolean),
            sortOrder: expect.any(Number),
            isSystem: expect.any(Boolean),
            isActive: expect.any(Boolean),
            isDeleted: expect.any(Boolean),
          }),
        );
      }
    });
  });
});

// ============================================================================
// Tests: Semantics Validation Service Contract
// ============================================================================

describe('CMDB MI 2.0 — Semantics Validation Service Contract', () => {
  let service: RelationshipSemanticsValidationService;

  const relTypeRepo = { findOne: jest.fn() };
  const ciRepo = { findOne: jest.fn() };
  const classRepo = { findOne: jest.fn() };
  const inheritanceService = { getAncestorChain: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    seedRelTypes();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipSemanticsValidationService,
        {
          provide: getRepositoryToken(CmdbRelationshipType),
          useValue: relTypeRepo,
        },
        { provide: getRepositoryToken(CmdbCi), useValue: ciRepo },
        { provide: getRepositoryToken(CmdbCiClass), useValue: classRepo },
        { provide: CiClassInheritanceService, useValue: inheritanceService },
      ],
    }).compile();

    service = module.get(RelationshipSemanticsValidationService);
  });

  it('should return valid=true with warning for unknown relationship type', async () => {
    relTypeRepo.findOne.mockResolvedValue(null);

    const result = await service.validate(
      TENANT_ID,
      'ci-1',
      'ci-2',
      'unknown_type',
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain(
      'not defined in the semantics catalog',
    );
  });

  it('should return valid=false for inactive relationship type', async () => {
    relTypeRepo.findOne.mockResolvedValue(
      makeRelType({ name: 'depends_on', isActive: false }),
    );

    const result = await service.validate(
      TENANT_ID,
      'ci-1',
      'ci-2',
      'depends_on',
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INACTIVE_RELATIONSHIP_TYPE' }),
      ]),
    );
  });

  it('should return valid=false for self-loop when not allowed', async () => {
    const dependsOn = relTypeStore.find((r) => r.name === 'depends_on')!;
    relTypeRepo.findOne.mockResolvedValue(dependsOn);

    const result = await service.validate(
      TENANT_ID,
      'ci-1',
      'ci-1',
      'depends_on',
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SELF_LOOP_NOT_ALLOWED' }),
      ]),
    );
  });

  it('should return semantics info for valid known type', async () => {
    const dependsOn = relTypeStore.find((r) => r.name === 'depends_on')!;
    relTypeRepo.findOne.mockResolvedValue(dependsOn);

    const result = await service.validate(
      TENANT_ID,
      'ci-1',
      'ci-2',
      'depends_on',
    );
    expect(result.valid).toBe(true);
    expect(result.semantics).toEqual(
      expect.objectContaining({
        name: 'depends_on',
        label: 'Depends On',
        directionality: 'unidirectional',
        riskPropagation: 'forward',
      }),
    );
  });

  it('should check source class compatibility for runs_on', async () => {
    const runsOn = relTypeStore.find((r) => r.name === 'runs_on')!;
    relTypeRepo.findOne.mockResolvedValue(runsOn);

    // Source CI is a database (not in allowed source classes)
    ciRepo.findOne.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 'ci-db') {
          return Promise.resolve({
            id: 'ci-db',
            tenantId: TENANT_ID,
            classId: 'class-db',
            ciClass: {
              id: 'class-db',
              name: 'cmdb_ci_database',
            } as CmdbCiClass,
            isDeleted: false,
          });
        }
        if (where.id === 'ci-server') {
          return Promise.resolve({
            id: 'ci-server',
            tenantId: TENANT_ID,
            classId: 'class-server',
            ciClass: {
              id: 'class-server',
              name: 'cmdb_ci_server',
            } as CmdbCiClass,
            isDeleted: false,
          });
        }
        return Promise.resolve(null);
      },
    );

    // Database (not an application) → Server should fail source class check
    const result = await service.validate(
      TENANT_ID,
      'ci-db',
      'ci-server',
      'runs_on',
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SOURCE_CLASS_NOT_ALLOWED' }),
      ]),
    );
  });

  it('should pass class compatibility via inheritance (child of allowed class)', async () => {
    const runsOn = relTypeStore.find((r) => r.name === 'runs_on')!;
    relTypeRepo.findOne.mockResolvedValue(runsOn);

    // Source CI is an application (directly allowed)
    ciRepo.findOne.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 'ci-app') {
          return Promise.resolve({
            id: 'ci-app',
            tenantId: TENANT_ID,
            classId: 'class-app',
            ciClass: {
              id: 'class-app',
              name: 'cmdb_ci_application',
            } as CmdbCiClass,
            isDeleted: false,
          });
        }
        if (where.id === 'ci-linux') {
          return Promise.resolve({
            id: 'ci-linux',
            tenantId: TENANT_ID,
            classId: 'class-linux',
            ciClass: {
              id: 'class-linux',
              name: 'cmdb_ci_linux_server',
            } as CmdbCiClass,
            isDeleted: false,
          });
        }
        return Promise.resolve(null);
      },
    );

    // Linux Server inherits from Server which is in allowed target classes
    inheritanceService.getAncestorChain.mockResolvedValue([
      { id: 'class-server', name: 'cmdb_ci_server' },
      { id: 'class-computer', name: 'cmdb_ci_computer' },
      { id: 'class-hardware', name: 'cmdb_ci_hardware' },
    ]);

    const result = await service.validate(
      TENANT_ID,
      'ci-app',
      'ci-linux',
      'runs_on',
    );
    expect(result.valid).toBe(true);
    expect(result.semantics).toEqual(
      expect.objectContaining({
        name: 'runs_on',
        directionality: 'unidirectional',
        riskPropagation: 'reverse',
      }),
    );
  });

  it('validation result should match the expected contract shape', async () => {
    const dependsOn = relTypeStore.find((r) => r.name === 'depends_on')!;
    relTypeRepo.findOne.mockResolvedValue(dependsOn);

    const result = await service.validate(
      TENANT_ID,
      'ci-1',
      'ci-2',
      'depends_on',
    );
    expect(result).toEqual(
      expect.objectContaining({
        valid: expect.any(Boolean),
        errors: expect.any(Array),
        warnings: expect.any(Array),
      }),
    );
    // When valid and type found, semantics should be present
    if (result.valid && result.semantics) {
      expect(result.semantics).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          label: expect.any(String),
          directionality: expect.any(String),
          riskPropagation: expect.any(String),
        }),
      );
    }
  });
});
