import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { CiClassInheritanceService } from './ci-class-inheritance.service';
import { CmdbCiClass, CiClassFieldDefinition } from './ci-class.entity';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ID_2 = '00000000-0000-0000-0000-000000000002';

const ROOT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PARENT_ID = 'aaaaaaaa-0000-0000-0000-000000000002';
const CHILD_ID = 'aaaaaaaa-0000-0000-0000-000000000003';
const GRANDCHILD_ID = 'aaaaaaaa-0000-0000-0000-000000000004';
const SIBLING_ID = 'aaaaaaaa-0000-0000-0000-000000000005';
const UNRELATED_ID = 'aaaaaaaa-0000-0000-0000-000000000099';

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

function seedHierarchy() {
  classStore = [
    makeClass({
      id: ROOT_ID,
      name: 'cmdb_ci',
      label: 'Configuration Item',
      fieldsSchema: [
        { key: 'name', label: 'Name', dataType: 'string', required: true, order: 1 },
        { key: 'description', label: 'Description', dataType: 'text', order: 2 },
      ],
    }),
    makeClass({
      id: PARENT_ID,
      name: 'cmdb_ci_hardware',
      label: 'Hardware',
      parentClassId: ROOT_ID,
      fieldsSchema: [
        { key: 'serial_number', label: 'Serial Number', dataType: 'string', order: 10 },
        { key: 'manufacturer', label: 'Manufacturer', dataType: 'string', order: 11 },
      ],
    }),
    makeClass({
      id: CHILD_ID,
      name: 'cmdb_ci_computer',
      label: 'Computer',
      parentClassId: PARENT_ID,
      fieldsSchema: [
        { key: 'cpu_count', label: 'CPU Count', dataType: 'number', order: 20 },
        { key: 'ram_gb', label: 'RAM (GB)', dataType: 'number', order: 21 },
        // Override parent's serial_number with different label
        { key: 'serial_number', label: 'Computer S/N', dataType: 'string', required: true, order: 10 },
      ],
    }),
    makeClass({
      id: GRANDCHILD_ID,
      name: 'cmdb_ci_server',
      label: 'Server',
      parentClassId: CHILD_ID,
      fieldsSchema: [
        { key: 'os_type', label: 'OS Type', dataType: 'enum', choices: ['WINDOWS', 'LINUX', 'OTHER'], order: 30 },
      ],
    }),
    makeClass({
      id: SIBLING_ID,
      name: 'cmdb_ci_network',
      label: 'Network Device',
      parentClassId: ROOT_ID,
      fieldsSchema: [
        { key: 'port_count', label: 'Port Count', dataType: 'number', order: 10 },
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
    const order = opts.order as Record<string, string> | undefined;

    let result = classStore.filter((c) => {
      if (where.tenantId && c.tenantId !== where.tenantId) return false;
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted) return false;
      if (where.parentClassId !== undefined && c.parentClassId !== where.parentClassId) return false;
      if (where.isActive !== undefined && c.isActive !== where.isActive) return false;
      return true;
    });

    if (order) {
      result = [...result].sort((a, b) => {
        for (const [key, dir] of Object.entries(order)) {
          const aVal = (a as unknown as Record<string, unknown>)[key];
          const bVal = (b as unknown as Record<string, unknown>)[key];
          if (aVal === bVal) continue;
          const cmp = String(aVal).localeCompare(String(bVal));
          return dir === 'DESC' ? -cmp : cmp;
        }
        return 0;
      });
    }

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
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted) return false;
      return true;
    });
    return Promise.resolve(match ?? null);
  }),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CiClassInheritanceService', () => {
  let service: CiClassInheritanceService;

  beforeEach(async () => {
    resetStore();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CiClassInheritanceService,
        {
          provide: getRepositoryToken(CmdbCiClass),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CiClassInheritanceService>(CiClassInheritanceService);
  });

  // ========================================================================
  // getClassTree
  // ========================================================================

  describe('getClassTree', () => {
    it('should return empty array for tenant with no classes', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      expect(tree).toEqual([]);
    });

    it('should build correct tree structure', async () => {
      seedHierarchy();
      const tree = await service.getClassTree(TENANT_ID);

      // Should have 1 root node (cmdb_ci) — Network Device and Hardware are children
      expect(tree).toHaveLength(1);

      const root = tree[0];
      expect(root.name).toBe('cmdb_ci');
      expect(root.parentClassId).toBeNull();
      expect(root.localFieldCount).toBe(2);

      // Root should have 2 children: Hardware and Network Device
      expect(root.children).toHaveLength(2);
      const childNames = root.children.map((c) => c.name).sort();
      expect(childNames).toEqual(['cmdb_ci_hardware', 'cmdb_ci_network']);

      // Hardware should have 1 child: Computer
      const hardware = root.children.find((c) => c.name === 'cmdb_ci_hardware')!;
      expect(hardware.children).toHaveLength(1);
      expect(hardware.children[0].name).toBe('cmdb_ci_computer');

      // Computer should have 1 child: Server
      const computer = hardware.children[0];
      expect(computer.children).toHaveLength(1);
      expect(computer.children[0].name).toBe('cmdb_ci_server');

      // Server should be a leaf
      const server = computer.children[0];
      expect(server.children).toHaveLength(0);
    });

    it('should handle multiple root classes', async () => {
      classStore = [
        makeClass({ id: ROOT_ID, name: 'root_a' }),
        makeClass({ id: PARENT_ID, name: 'root_b' }),
      ];
      const tree = await service.getClassTree(TENANT_ID);
      expect(tree).toHaveLength(2);
    });

    it('should exclude deleted classes', async () => {
      classStore = [
        makeClass({ id: ROOT_ID, name: 'active_root' }),
        makeClass({ id: PARENT_ID, name: 'deleted_root', isDeleted: true }),
      ];
      const tree = await service.getClassTree(TENANT_ID);
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('active_root');
    });
  });

  // ========================================================================
  // getAncestorChain
  // ========================================================================

  describe('getAncestorChain', () => {
    it('should return empty array for root class', async () => {
      seedHierarchy();
      const ancestors = await service.getAncestorChain(TENANT_ID, ROOT_ID);
      expect(ancestors).toEqual([]);
    });

    it('should return [parent] for depth-1 child', async () => {
      seedHierarchy();
      const ancestors = await service.getAncestorChain(TENANT_ID, PARENT_ID);
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].id).toBe(ROOT_ID);
      expect(ancestors[0].name).toBe('cmdb_ci');
      expect(ancestors[0].depth).toBe(1);
    });

    it('should return [parent, grandparent] for depth-2 child', async () => {
      seedHierarchy();
      const ancestors = await service.getAncestorChain(TENANT_ID, CHILD_ID);
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].id).toBe(PARENT_ID); // nearest
      expect(ancestors[0].depth).toBe(1);
      expect(ancestors[1].id).toBe(ROOT_ID); // farthest
      expect(ancestors[1].depth).toBe(2);
    });

    it('should return full chain for depth-3 class (grandchild→child→parent→root)', async () => {
      seedHierarchy();
      const ancestors = await service.getAncestorChain(TENANT_ID, GRANDCHILD_ID);
      expect(ancestors).toHaveLength(3);
      expect(ancestors.map((a) => a.id)).toEqual([CHILD_ID, PARENT_ID, ROOT_ID]);
    });

    it('should detect cycle and throw', async () => {
      // Create A → B → A cycle
      classStore = [
        makeClass({ id: ROOT_ID, name: 'A', parentClassId: PARENT_ID }),
        makeClass({ id: PARENT_ID, name: 'B', parentClassId: ROOT_ID }),
      ];

      await expect(
        service.getAncestorChain(TENANT_ID, ROOT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty for non-existent class', async () => {
      const ancestors = await service.getAncestorChain(TENANT_ID, 'nonexistent');
      expect(ancestors).toEqual([]);
    });
  });

  // ========================================================================
  // getDescendantIds
  // ========================================================================

  describe('getDescendantIds', () => {
    it('should return empty for leaf class', async () => {
      seedHierarchy();
      const ids = await service.getDescendantIds(TENANT_ID, GRANDCHILD_ID);
      expect(ids).toEqual([]);
    });

    it('should return direct children', async () => {
      seedHierarchy();
      const ids = await service.getDescendantIds(TENANT_ID, PARENT_ID);
      expect(ids).toContain(CHILD_ID);
    });

    it('should return all descendants recursively', async () => {
      seedHierarchy();
      const ids = await service.getDescendantIds(TENANT_ID, ROOT_ID);
      expect(ids).toContain(PARENT_ID);
      expect(ids).toContain(CHILD_ID);
      expect(ids).toContain(GRANDCHILD_ID);
      expect(ids).toContain(SIBLING_ID);
      expect(ids).toHaveLength(4);
    });

    it('should return empty for non-existent class', async () => {
      const ids = await service.getDescendantIds(TENANT_ID, 'nonexistent');
      expect(ids).toEqual([]);
    });
  });

  // ========================================================================
  // getEffectiveSchema
  // ========================================================================

  describe('getEffectiveSchema', () => {
    it('should return only local fields for root class', async () => {
      seedHierarchy();
      const schema = await service.getEffectiveSchema(TENANT_ID, ROOT_ID);

      expect(schema.classId).toBe(ROOT_ID);
      expect(schema.className).toBe('cmdb_ci');
      expect(schema.ancestors).toHaveLength(0);
      expect(schema.totalFieldCount).toBe(2);
      expect(schema.inheritedFieldCount).toBe(0);
      expect(schema.localFieldCount).toBe(2);

      // All fields should be local (inherited = false)
      for (const field of schema.effectiveFields) {
        expect(field.inherited).toBe(false);
        expect(field.sourceClassId).toBe(ROOT_ID);
        expect(field.inheritanceDepth).toBe(0);
      }
    });

    it('should merge parent + local fields', async () => {
      seedHierarchy();
      const schema = await service.getEffectiveSchema(TENANT_ID, PARENT_ID);

      // Hardware inherits name + description from root, adds serial_number + manufacturer
      expect(schema.totalFieldCount).toBe(4);
      expect(schema.inheritedFieldCount).toBe(2);
      expect(schema.localFieldCount).toBe(2);

      const inherited = schema.effectiveFields.filter((f) => f.inherited);
      const local = schema.effectiveFields.filter((f) => !f.inherited);

      expect(inherited.map((f) => f.key).sort()).toEqual(['description', 'name']);
      expect(local.map((f) => f.key).sort()).toEqual(['manufacturer', 'serial_number']);
    });

    it('should handle child overriding parent field', async () => {
      seedHierarchy();
      const schema = await service.getEffectiveSchema(TENANT_ID, CHILD_ID);

      // Computer: root(name, description) + hardware(serial_number, manufacturer) + computer(cpu_count, ram_gb, serial_number override)
      // serial_number is overridden by Computer → should show Computer's version
      const serialField = schema.effectiveFields.find((f) => f.key === 'serial_number');
      expect(serialField).toBeDefined();
      expect(serialField!.label).toBe('Computer S/N'); // overridden label
      expect(serialField!.required).toBe(true); // overridden to required
      expect(serialField!.sourceClassId).toBe(CHILD_ID);
      expect(serialField!.inherited).toBe(false); // locally defined (override)
      expect(serialField!.inheritanceDepth).toBe(0);

      // Total fields: name, description (root), manufacturer (hardware), cpu_count, ram_gb, serial_number (computer override) = 6
      expect(schema.totalFieldCount).toBe(6);
    });

    it('should compute deep inheritance chain (grandchild)', async () => {
      seedHierarchy();
      const schema = await service.getEffectiveSchema(TENANT_ID, GRANDCHILD_ID);

      // Server: root(name, desc) + hw(manufacturer) + computer(serial_number override, cpu, ram) + server(os_type)
      // serial_number was overridden by Computer, so it comes from Computer
      expect(schema.ancestors).toHaveLength(3);
      expect(schema.effectiveFields.length).toBe(7);

      const osField = schema.effectiveFields.find((f) => f.key === 'os_type');
      expect(osField).toBeDefined();
      expect(osField!.inherited).toBe(false);
      expect(osField!.sourceClassId).toBe(GRANDCHILD_ID);

      const nameField = schema.effectiveFields.find((f) => f.key === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.inherited).toBe(true);
      expect(nameField!.sourceClassId).toBe(ROOT_ID);
    });

    it('should throw for non-existent class', async () => {
      await expect(
        service.getEffectiveSchema(TENANT_ID, 'nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty fields when class has no fieldsSchema', async () => {
      classStore = [
        makeClass({ id: ROOT_ID, name: 'empty_class', fieldsSchema: null }),
      ];
      const schema = await service.getEffectiveSchema(TENANT_ID, ROOT_ID);
      expect(schema.effectiveFields).toEqual([]);
      expect(schema.totalFieldCount).toBe(0);
    });

    it('should sort fields by order then key', async () => {
      seedHierarchy();
      const schema = await service.getEffectiveSchema(TENANT_ID, PARENT_ID);

      const orders = schema.effectiveFields.map((f) => f.order ?? 9999);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
      }
    });
  });

  // ========================================================================
  // validateInheritanceChange
  // ========================================================================

  describe('validateInheritanceChange', () => {
    it('should allow setting parent to null (become root)', async () => {
      seedHierarchy();
      const result = await service.validateInheritanceChange(TENANT_ID, CHILD_ID, null);
      expect(result.valid).toBe(true);
      expect(result.effectiveDepth).toBe(0);
    });

    it('should reject self-reference', async () => {
      seedHierarchy();
      const result = await service.validateInheritanceChange(TENANT_ID, CHILD_ID, CHILD_ID);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A class cannot be its own parent');
    });

    it('should reject non-existent parent', async () => {
      seedHierarchy();
      const result = await service.validateInheritanceChange(TENANT_ID, CHILD_ID, UNRELATED_ID);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('should detect cycle: setting parent as own descendant', async () => {
      seedHierarchy();
      // Try to make Root's parent = Grandchild (which is a descendant of Root)
      const result = await service.validateInheritanceChange(TENANT_ID, ROOT_ID, GRANDCHILD_ID);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cycle');
    });

    it('should detect cycle: setting parent as direct child', async () => {
      seedHierarchy();
      // Try to make Parent's parent = Child (which is a child of Parent)
      const result = await service.validateInheritanceChange(TENANT_ID, PARENT_ID, CHILD_ID);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cycle');
    });

    it('should allow valid parent change', async () => {
      seedHierarchy();
      // Move Network Device under Hardware (sibling → child)
      const result = await service.validateInheritanceChange(TENANT_ID, SIBLING_ID, PARENT_ID);
      expect(result.valid).toBe(true);
      expect(result.effectiveDepth).toBe(2); // Root → Hardware → Network = depth 2
    });

    it('should report field overrides as warnings', async () => {
      seedHierarchy();
      // Computer has serial_number which overrides Hardware's serial_number
      // Validate Computer → Hardware (already existing, should report override)
      const result = await service.validateInheritanceChange(TENANT_ID, CHILD_ID, PARENT_ID);
      expect(result.valid).toBe(true);
      expect(result.fieldOverrides).toBeDefined();
      expect(result.fieldOverrides!.length).toBeGreaterThan(0);
      expect(result.fieldOverrides![0].key).toBe('serial_number');
    });

    it('should allow changing parent to a different valid class', async () => {
      seedHierarchy();
      // Move Server directly under Root (skip Hardware and Computer)
      const result = await service.validateInheritanceChange(TENANT_ID, GRANDCHILD_ID, ROOT_ID);
      expect(result.valid).toBe(true);
      expect(result.effectiveDepth).toBe(1);
    });
  });

  // ========================================================================
  // hasCycle
  // ========================================================================

  describe('hasCycle', () => {
    it('should return false for valid hierarchy', async () => {
      seedHierarchy();
      const result = await service.hasCycle(TENANT_ID, GRANDCHILD_ID);
      expect(result).toBe(false);
    });

    it('should return true for cyclic hierarchy', async () => {
      classStore = [
        makeClass({ id: ROOT_ID, name: 'A', parentClassId: PARENT_ID }),
        makeClass({ id: PARENT_ID, name: 'B', parentClassId: ROOT_ID }),
      ];
      const result = await service.hasCycle(TENANT_ID, ROOT_ID);
      expect(result).toBe(true);
    });

    it('should return false for root class', async () => {
      seedHierarchy();
      const result = await service.hasCycle(TENANT_ID, ROOT_ID);
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Tenant isolation
  // ========================================================================

  describe('tenant isolation', () => {
    it('should not find classes from other tenants', async () => {
      classStore = [
        makeClass({ id: ROOT_ID, name: 'tenant1_class', tenantId: TENANT_ID }),
        makeClass({ id: PARENT_ID, name: 'tenant2_class', tenantId: TENANT_ID_2 }),
      ];

      const tree = await service.getClassTree(TENANT_ID);
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('tenant1_class');

      const tree2 = await service.getClassTree(TENANT_ID_2);
      expect(tree2).toHaveLength(1);
      expect(tree2[0].name).toBe('tenant2_class');
    });

    it('should not traverse ancestors across tenants', async () => {
      classStore = [
        makeClass({ id: ROOT_ID, name: 'root', tenantId: TENANT_ID_2 }),
        makeClass({ id: PARENT_ID, name: 'child', tenantId: TENANT_ID, parentClassId: ROOT_ID }),
      ];

      // Child's parent is in a different tenant → should stop traversal
      const ancestors = await service.getAncestorChain(TENANT_ID, PARENT_ID);
      // Should not find the root since it belongs to TENANT_ID_2
      expect(ancestors).toHaveLength(0);
    });
  });
});
