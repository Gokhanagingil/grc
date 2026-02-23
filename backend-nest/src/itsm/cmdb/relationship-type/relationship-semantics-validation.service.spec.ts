import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RelationshipSemanticsValidationService } from './relationship-semantics-validation.service';
import { CmdbRelationshipType } from './relationship-type.entity';
import { CmdbCi } from '../ci/ci.entity';
import { CmdbCiClass } from '../ci-class/ci-class.entity';
import { CiClassInheritanceService } from '../ci-class/ci-class-inheritance.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_CI_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_CI_ID = '22222222-2222-2222-2222-222222222222';

function makeRelType(
  overrides: Partial<CmdbRelationshipType>,
): CmdbRelationshipType {
  return {
    id: 'reltype-id',
    tenantId: TENANT_ID,
    name: 'depends_on',
    label: 'Depends on',
    directionality: 'unidirectional' as CmdbRelationshipType['directionality'],
    riskPropagation: 'forward' as CmdbRelationshipType['riskPropagation'],
    allowSelfLoop: false,
    allowCycles: true,
    allowedSourceClasses: [],
    allowedTargetClasses: [],
    inverseLabel: null,
    description: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user',
    updatedBy: 'user',
    ...overrides,
  } as unknown as CmdbRelationshipType;
}

function makeCi(ciId: string, classId: string, className: string): CmdbCi {
  return {
    id: ciId,
    tenantId: TENANT_ID,
    classId,
    ciClass: { id: classId, name: className } as CmdbCiClass,
    isDeleted: false,
  } as unknown as CmdbCi;
}

describe('RelationshipSemanticsValidationService', () => {
  let service: RelationshipSemanticsValidationService;

  const relTypeRepo = {
    findOne: jest.fn(),
  };

  const ciRepo = {
    findOne: jest.fn(),
  };

  const classRepo = {
    findOne: jest.fn(),
  };

  const inheritanceService = {
    getAncestorChain: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipSemanticsValidationService,
        {
          provide: getRepositoryToken(CmdbRelationshipType),
          useValue: relTypeRepo,
        },
        {
          provide: getRepositoryToken(CmdbCi),
          useValue: ciRepo,
        },
        {
          provide: getRepositoryToken(CmdbCiClass),
          useValue: classRepo,
        },
        {
          provide: CiClassInheritanceService,
          useValue: inheritanceService,
        },
      ],
    }).compile();

    service = module.get(RelationshipSemanticsValidationService);
  });

  it('returns a warning (but valid) when relationship type is not in catalog', async () => {
    relTypeRepo.findOne.mockResolvedValue(null);

    const result = await service.validate(
      TENANT_ID,
      SOURCE_CI_ID,
      TARGET_CI_ID,
      'unknown_type',
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('fails when relationship type is inactive', async () => {
    relTypeRepo.findOne.mockResolvedValue(makeRelType({ isActive: false }));

    const result = await service.validate(
      TENANT_ID,
      SOURCE_CI_ID,
      TARGET_CI_ID,
      'depends_on',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INACTIVE_RELATIONSHIP_TYPE' }),
      ]),
    );
  });

  it('fails when self-loop is not allowed', async () => {
    relTypeRepo.findOne.mockResolvedValue(
      makeRelType({ allowSelfLoop: false }),
    );

    const result = await service.validate(
      TENANT_ID,
      SOURCE_CI_ID,
      SOURCE_CI_ID,
      'depends_on',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SELF_LOOP_NOT_ALLOWED' }),
      ]),
    );
  });

  it('fails when source CI class is not allowed', async () => {
    relTypeRepo.findOne.mockResolvedValue(
      makeRelType({ allowedSourceClasses: ['Server'] }),
    );

    ciRepo.findOne.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === SOURCE_CI_ID) {
          return Promise.resolve(
            makeCi(SOURCE_CI_ID, 'class-app', 'Application'),
          );
        }
        if (where.id === TARGET_CI_ID) {
          return Promise.resolve(makeCi(TARGET_CI_ID, 'class-db', 'Database'));
        }
        return Promise.resolve(null);
      },
    );

    const result = await service.validate(
      TENANT_ID,
      SOURCE_CI_ID,
      TARGET_CI_ID,
      'depends_on',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SOURCE_CLASS_NOT_ALLOWED' }),
      ]),
    );
  });

  it('passes when allowed class matches an ancestor (inheritance-aware)', async () => {
    relTypeRepo.findOne.mockResolvedValue(
      makeRelType({ allowedSourceClasses: ['Hardware'] }),
    );

    ciRepo.findOne.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === SOURCE_CI_ID) {
          return Promise.resolve(
            makeCi(SOURCE_CI_ID, 'class-server', 'Server'),
          );
        }
        if (where.id === TARGET_CI_ID) {
          return Promise.resolve(makeCi(TARGET_CI_ID, 'class-db', 'Database'));
        }
        return Promise.resolve(null);
      },
    );

    inheritanceService.getAncestorChain.mockResolvedValue([
      { id: 'class-hw', name: 'Hardware' },
    ]);

    const result = await service.validate(
      TENANT_ID,
      SOURCE_CI_ID,
      TARGET_CI_ID,
      'depends_on',
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.semantics).toEqual(
      expect.objectContaining({ name: 'depends_on', label: 'Depends on' }),
    );
  });
});
