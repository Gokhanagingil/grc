/**
 * CMDB MI 2.0 — Relationship Type Admin CRUD Contract Tests
 *
 * Validates the RelationshipTypeService CRUD operations:
 * - create with validation
 * - update with field persistence
 * - soft-delete (non-system only)
 * - duplicate name rejection
 * - system type protection
 * - list/filter behavior
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { RelationshipTypeService } from './relationship-type.service';
import {
  CmdbRelationshipType,
  RelationshipDirectionality,
  RiskPropagationHint,
} from './relationship-type.entity';
import { AuditService } from '../../../audit/audit.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = 'user-admin-001';

// ============================================================================
// In-memory store for mock repository
// ============================================================================

let store: CmdbRelationshipType[] = [];
let idCounter = 100;

function makeEntity(
  overrides: Partial<CmdbRelationshipType> & { name: string },
): CmdbRelationshipType {
  return {
    id: overrides.id ?? `reltype-${++idCounter}`,
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
// Mock repository that mimics TypeORM Repository
// ============================================================================

function createMockRepository() {
  return {
    find: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      return Promise.resolve(
        store.filter(
          (e) =>
            e.tenantId === where.tenantId &&
            e.isActive === (where.isActive ?? e.isActive) &&
            e.isDeleted === (where.isDeleted ?? e.isDeleted),
        ),
      );
    }),
    findOne: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      const match = store.find((e) => {
        if (where.id && e.id !== where.id) return false;
        if (where.name && e.name !== where.name) return false;
        if (where.tenantId && e.tenantId !== where.tenantId) return false;
        if (where.isDeleted !== undefined && e.isDeleted !== where.isDeleted) return false;
        return true;
      });
      return Promise.resolve(match || null);
    }),
    create: jest.fn().mockImplementation((data: Partial<CmdbRelationshipType>) => {
      return { ...data } as CmdbRelationshipType;
    }),
    save: jest.fn().mockImplementation((entity: Partial<CmdbRelationshipType>) => {
      const id = entity.id ?? `reltype-${++idCounter}`;
      const full = makeEntity({
        ...entity,
        name: entity.name ?? 'unnamed',
        id,
      } as CmdbRelationshipType & { name: string });
      const idx = store.findIndex((e) => e.id === id);
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...full };
        return Promise.resolve(store[idx]);
      }
      store.push(full);
      return Promise.resolve(full);
    }),
    merge: jest.fn().mockImplementation((target: CmdbRelationshipType, ...sources: Partial<CmdbRelationshipType>[]) => {
      const merged = Object.assign(target, ...sources);
      return merged;
    }),
    update: jest.fn().mockImplementation((criteria: { id: string; tenantId: string }, data: Partial<CmdbRelationshipType>) => {
      const idx = store.findIndex(
        (e) => e.id === criteria.id && e.tenantId === criteria.tenantId,
      );
      if (idx >= 0) {
        store[idx] = { ...store[idx], ...data, updatedAt: new Date() };
        return Promise.resolve({ affected: 1 });
      }
      return Promise.resolve({ affected: 0 });
    }),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockImplementation(() =>
        Promise.resolve(
          store.filter((e) => e.tenantId === TENANT_ID && !e.isDeleted).length,
        ),
      ),
      getMany: jest.fn().mockImplementation(() =>
        Promise.resolve(
          store.filter((e) => e.tenantId === TENANT_ID && !e.isDeleted),
        ),
      ),
    }),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('CMDB MI 2.0 — Relationship Type Admin CRUD', () => {
  let service: RelationshipTypeService;
  let mockRepo: ReturnType<typeof createMockRepository>;
  const mockAudit = {
    recordCreate: jest.fn(),
    recordUpdate: jest.fn(),
    recordDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    store = [];
    idCounter = 100;

    mockRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipTypeService,
        {
          provide: getRepositoryToken(CmdbRelationshipType),
          useValue: mockRepo,
        },
        {
          provide: AuditService,
          useValue: mockAudit,
        },
      ],
    }).compile();

    service = module.get(RelationshipTypeService);
  });

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('createRelationshipType', () => {
    it('should create a new relationship type with all fields', async () => {
      const result = await service.createRelationshipType(TENANT_ID, USER_ID, {
        name: 'monitors',
        label: 'Monitors',
        description: 'Source monitors target health',
        directionality: RelationshipDirectionality.UNIDIRECTIONAL,
        inverseLabel: 'Monitored By',
        riskPropagation: RiskPropagationHint.FORWARD,
        allowedSourceClasses: ['cmdb_ci_monitoring'],
        allowedTargetClasses: ['cmdb_ci_application', 'cmdb_ci_server'],
        allowSelfLoop: false,
        allowCycles: false,
        sortOrder: 100,
        isActive: true,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('monitors');
      expect(result.label).toBe('Monitors');
      expect(result.directionality).toBe(RelationshipDirectionality.UNIDIRECTIONAL);
      expect(result.riskPropagation).toBe(RiskPropagationHint.FORWARD);
      expect(result.inverseLabel).toBe('Monitored By');
      expect(result.allowedSourceClasses).toEqual(['cmdb_ci_monitoring']);
      expect(result.allowedTargetClasses).toEqual([
        'cmdb_ci_application',
        'cmdb_ci_server',
      ]);
    });

    it('should reject duplicate name for same tenant', async () => {
      // Pre-seed a type
      store.push(makeEntity({ name: 'depends_on', label: 'Depends On' }));

      await expect(
        service.createRelationshipType(TENANT_ID, USER_ID, {
          name: 'depends_on',
          label: 'Duplicate Depends On',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger audit on create', async () => {
      await service.createRelationshipType(TENANT_ID, USER_ID, {
        name: 'new_type',
        label: 'New Type',
      });

      expect(mockAudit.recordCreate).toHaveBeenCalledWith(
        'CmdbRelationshipType',
        expect.objectContaining({ name: 'new_type' }),
        USER_ID,
        TENANT_ID,
      );
    });
  });

  // --------------------------------------------------------------------------
  // READ (findAll / findOne)
  // --------------------------------------------------------------------------

  describe('findAllActive', () => {
    it('should return only active non-deleted types for tenant', async () => {
      store.push(
        makeEntity({ name: 'active_type', isActive: true, isDeleted: false }),
        makeEntity({ name: 'inactive_type', isActive: false, isDeleted: false }),
        makeEntity({ name: 'deleted_type', isActive: true, isDeleted: true }),
      );

      const result = await service.findAllActive(TENANT_ID);
      // The mock only filters by isActive and isDeleted
      const names = result.map((r) => r.name);
      expect(names).toContain('active_type');
      expect(names).not.toContain('deleted_type');
    });
  });

  describe('findOneActiveForTenant', () => {
    it('should return an entity by ID', async () => {
      store.push(makeEntity({ id: 'test-id-1', name: 'test_type' }));

      const result = await service.findOneActiveForTenant(TENANT_ID, 'test-id-1');
      expect(result).toBeDefined();
      expect(result!.name).toBe('test_type');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.findOneActiveForTenant(TENANT_ID, 'non-existent');
      expect(result).toBeNull();
    });

    it('should return null for deleted entity', async () => {
      store.push(makeEntity({ id: 'deleted-1', name: 'deleted', isDeleted: true }));

      const result = await service.findOneActiveForTenant(TENANT_ID, 'deleted-1');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  describe('updateRelationshipType', () => {
    it('should update fields on existing type', async () => {
      store.push(
        makeEntity({
          id: 'update-1',
          name: 'update_me',
          label: 'Old Label',
          riskPropagation: RiskPropagationHint.FORWARD,
        }),
      );

      const result = await service.updateRelationshipType(
        TENANT_ID,
        USER_ID,
        'update-1',
        {
          label: 'New Label',
          riskPropagation: RiskPropagationHint.BOTH,
        },
      );

      expect(result).toBeDefined();
      // The mock should have updated the store
      const inStore = store.find((e) => e.id === 'update-1');
      expect(inStore).toBeDefined();
      expect(inStore!.label).toBe('New Label');
      expect(inStore!.riskPropagation).toBe(RiskPropagationHint.BOTH);
    });

    it('should return null for non-existent type', async () => {
      const result = await service.updateRelationshipType(
        TENANT_ID,
        USER_ID,
        'non-existent',
        { label: 'Nope' },
      );
      expect(result).toBeNull();
    });

    it('should trigger audit on update', async () => {
      store.push(makeEntity({ id: 'audit-upd-1', name: 'audit_test' }));

      await service.updateRelationshipType(TENANT_ID, USER_ID, 'audit-upd-1', {
        label: 'Audited',
      });

      expect(mockAudit.recordUpdate).toHaveBeenCalledWith(
        'CmdbRelationshipType',
        'audit-upd-1',
        expect.any(Object),
        expect.any(Object),
        USER_ID,
        TENANT_ID,
      );
    });
  });

  // --------------------------------------------------------------------------
  // SOFT DELETE
  // --------------------------------------------------------------------------

  describe('softDeleteRelationshipType', () => {
    it('should soft-delete a non-system type', async () => {
      store.push(
        makeEntity({
          id: 'del-1',
          name: 'deletable',
          isSystem: false,
        }),
      );

      const result = await service.softDeleteRelationshipType(
        TENANT_ID,
        USER_ID,
        'del-1',
      );
      expect(result).toBe(true);
    });

    it('should reject deletion of system type', async () => {
      store.push(
        makeEntity({
          id: 'sys-1',
          name: 'system_type',
          isSystem: true,
        }),
      );

      await expect(
        service.softDeleteRelationshipType(TENANT_ID, USER_ID, 'sys-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.softDeleteRelationshipType(TENANT_ID, USER_ID, 'sys-1'),
      ).rejects.toThrow('System-defined relationship types cannot be deleted');
    });

    it('should return false for non-existent type', async () => {
      const result = await service.softDeleteRelationshipType(
        TENANT_ID,
        USER_ID,
        'non-existent',
      );
      expect(result).toBe(false);
    });

    it('should trigger audit on delete', async () => {
      store.push(
        makeEntity({ id: 'audit-del-1', name: 'audit_delete', isSystem: false }),
      );

      await service.softDeleteRelationshipType(TENANT_ID, USER_ID, 'audit-del-1');

      expect(mockAudit.recordDelete).toHaveBeenCalledWith(
        'CmdbRelationshipType',
        expect.objectContaining({ name: 'audit_delete' }),
        USER_ID,
        TENANT_ID,
      );
    });
  });

  // --------------------------------------------------------------------------
  // FIND BY NAME
  // --------------------------------------------------------------------------

  describe('findByName', () => {
    it('should find an existing type by name', async () => {
      store.push(makeEntity({ name: 'depends_on', label: 'Depends On' }));

      const result = await service.findByName(TENANT_ID, 'depends_on');
      expect(result).toBeDefined();
      expect(result!.name).toBe('depends_on');
    });

    it('should return null for non-existent name', async () => {
      const result = await service.findByName(TENANT_ID, 'non_existent');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // PAGINATION
  // --------------------------------------------------------------------------

  describe('findWithFilters', () => {
    it('should return paginated response shape', async () => {
      store.push(
        makeEntity({ name: 'type_a' }),
        makeEntity({ name: 'type_b' }),
        makeEntity({ name: 'type_c' }),
      );

      const result = await service.findWithFilters(TENANT_ID, 1, 10);

      expect(result).toEqual(
        expect.objectContaining({
          items: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          pageSize: 10,
        }),
      );
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // ENUM VALIDATION (DTO-level contract)
  // --------------------------------------------------------------------------

  describe('Enum Value Contract', () => {
    it('RelationshipDirectionality should have exactly 2 values', () => {
      const values = Object.values(RelationshipDirectionality);
      expect(values).toHaveLength(2);
      expect(values).toContain('unidirectional');
      expect(values).toContain('bidirectional');
    });

    it('RiskPropagationHint should have exactly 4 values', () => {
      const values = Object.values(RiskPropagationHint);
      expect(values).toHaveLength(4);
      expect(values).toContain('forward');
      expect(values).toContain('reverse');
      expect(values).toContain('both');
      expect(values).toContain('none');
    });
  });
});
