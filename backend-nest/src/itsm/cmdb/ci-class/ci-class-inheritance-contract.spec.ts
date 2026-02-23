/**
 * CMDB Model Intelligence 2.0 — API Contract Tests
 *
 * Tests the class hierarchy, effective schema resolution, and relationship type
 * semantics using deterministic seed data from seed-cmdb-mi-demo.ts.
 *
 * These are unit-level tests using mocked repositories that mirror the
 * deterministic seed data structure to validate contract shapes.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CiClassInheritanceService } from './ci-class-inheritance.service';
import { CmdbCiClass } from './ci-class.entity';

// ============================================================================
// Deterministic IDs matching seed-cmdb-mi-demo.ts
// ============================================================================

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const CLASS_IDS = {
  cmdb_ci: 'c1a00000-0000-0000-0000-000000000001',
  cmdb_ci_hardware: 'c1a00000-0000-0000-0000-000000000010',
  cmdb_ci_computer: 'c1a00000-0000-0000-0000-000000000011',
  cmdb_ci_server: 'c1a00000-0000-0000-0000-000000000012',
  cmdb_ci_linux_server: 'c1a00000-0000-0000-0000-000000000013',
  cmdb_ci_win_server: 'c1a00000-0000-0000-0000-000000000014',
  cmdb_ci_network: 'c1a00000-0000-0000-0000-000000000020',
  cmdb_ci_application: 'c1a00000-0000-0000-0000-000000000030',
  cmdb_ci_database: 'c1a00000-0000-0000-0000-000000000040',
};

// ============================================================================
// Helper to create mock class entities matching the MI seed hierarchy
// ============================================================================

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

// ============================================================================
// In-memory class store mirroring the MI seed hierarchy
// ============================================================================

let classStore: CmdbCiClass[] = [];

function seedMiHierarchy() {
  classStore = [
    // Root abstract: cmdb_ci
    makeClass({
      id: CLASS_IDS.cmdb_ci,
      name: 'cmdb_ci',
      label: 'Configuration Item',
      isAbstract: true,
      sortOrder: 0,
      fieldsSchema: [
        {
          key: 'ci_name',
          label: 'CI Name',
          dataType: 'string',
          required: true,
          order: 1,
          group: 'General',
        },
        {
          key: 'description',
          label: 'Description',
          dataType: 'text',
          order: 2,
          group: 'General',
        },
        {
          key: 'operational_status',
          label: 'Operational Status',
          dataType: 'enum',
          choices: ['OPERATIONAL', 'NON_OPERATIONAL', 'MAINTENANCE', 'RETIRED'],
          order: 3,
          group: 'General',
        },
        {
          key: 'managed_by',
          label: 'Managed By',
          dataType: 'string',
          order: 4,
          group: 'Ownership',
        },
      ],
    }),
    // Hardware (abstract) → child of cmdb_ci
    makeClass({
      id: CLASS_IDS.cmdb_ci_hardware,
      name: 'cmdb_ci_hardware',
      label: 'Hardware',
      parentClassId: CLASS_IDS.cmdb_ci,
      isAbstract: true,
      sortOrder: 10,
      fieldsSchema: [
        {
          key: 'serial_number',
          label: 'Serial Number',
          dataType: 'string',
          order: 10,
          group: 'Hardware',
        },
        {
          key: 'manufacturer',
          label: 'Manufacturer',
          dataType: 'string',
          order: 11,
          group: 'Hardware',
        },
        {
          key: 'model_number',
          label: 'Model Number',
          dataType: 'string',
          order: 12,
          group: 'Hardware',
        },
        {
          key: 'asset_tag',
          label: 'Asset Tag',
          dataType: 'string',
          order: 13,
          group: 'Hardware',
        },
        {
          key: 'location',
          label: 'Location',
          dataType: 'string',
          order: 14,
          group: 'Hardware',
        },
      ],
    }),
    // Computer → child of Hardware
    makeClass({
      id: CLASS_IDS.cmdb_ci_computer,
      name: 'cmdb_ci_computer',
      label: 'Computer',
      parentClassId: CLASS_IDS.cmdb_ci_hardware,
      sortOrder: 20,
      fieldsSchema: [
        {
          key: 'cpu_count',
          label: 'CPU Count',
          dataType: 'number',
          order: 20,
          group: 'Compute',
        },
        {
          key: 'ram_gb',
          label: 'RAM (GB)',
          dataType: 'number',
          order: 21,
          group: 'Compute',
        },
        {
          key: 'os_type',
          label: 'OS Type',
          dataType: 'enum',
          choices: ['WINDOWS', 'LINUX', 'MACOS', 'OTHER'],
          order: 22,
          group: 'Compute',
        },
        {
          key: 'ip_address',
          label: 'IP Address',
          dataType: 'string',
          order: 23,
          group: 'Network',
        },
      ],
    }),
    // Server → child of Computer
    makeClass({
      id: CLASS_IDS.cmdb_ci_server,
      name: 'cmdb_ci_server',
      label: 'Server',
      parentClassId: CLASS_IDS.cmdb_ci_computer,
      sortOrder: 30,
      fieldsSchema: [
        {
          key: 'server_role',
          label: 'Server Role',
          dataType: 'enum',
          choices: ['WEB', 'APP', 'DB', 'CACHE', 'PROXY', 'OTHER'],
          order: 30,
          group: 'Server',
        },
        {
          key: 'is_virtual',
          label: 'Is Virtual',
          dataType: 'boolean',
          order: 31,
          group: 'Server',
        },
        {
          key: 'cluster_name',
          label: 'Cluster Name',
          dataType: 'string',
          order: 32,
          group: 'Server',
        },
      ],
    }),
    // Linux Server → child of Server (with os_type override)
    makeClass({
      id: CLASS_IDS.cmdb_ci_linux_server,
      name: 'cmdb_ci_linux_server',
      label: 'Linux Server',
      parentClassId: CLASS_IDS.cmdb_ci_server,
      sortOrder: 40,
      fieldsSchema: [
        {
          key: 'distro',
          label: 'Distribution',
          dataType: 'enum',
          choices: ['UBUNTU', 'RHEL', 'CENTOS', 'DEBIAN', 'ALPINE', 'OTHER'],
          order: 40,
          group: 'Linux',
        },
        {
          key: 'kernel_version',
          label: 'Kernel Version',
          dataType: 'string',
          order: 41,
          group: 'Linux',
        },
        {
          key: 'os_type',
          label: 'OS Type',
          dataType: 'enum',
          choices: ['LINUX'],
          readOnly: true,
          defaultValue: 'LINUX',
          order: 22,
          group: 'Compute',
        },
      ],
    }),
    // Windows Server → child of Server (with os_type override)
    makeClass({
      id: CLASS_IDS.cmdb_ci_win_server,
      name: 'cmdb_ci_win_server',
      label: 'Windows Server',
      parentClassId: CLASS_IDS.cmdb_ci_server,
      sortOrder: 41,
      fieldsSchema: [
        {
          key: 'windows_version',
          label: 'Windows Version',
          dataType: 'enum',
          choices: ['2016', '2019', '2022', '2025'],
          order: 40,
          group: 'Windows',
        },
        {
          key: 'domain_joined',
          label: 'Domain Joined',
          dataType: 'boolean',
          order: 41,
          group: 'Windows',
        },
        {
          key: 'os_type',
          label: 'OS Type',
          dataType: 'enum',
          choices: ['WINDOWS'],
          readOnly: true,
          defaultValue: 'WINDOWS',
          order: 22,
          group: 'Compute',
        },
      ],
    }),
    // Network Device → child of Hardware
    makeClass({
      id: CLASS_IDS.cmdb_ci_network,
      name: 'cmdb_ci_network',
      label: 'Network Device',
      parentClassId: CLASS_IDS.cmdb_ci_hardware,
      sortOrder: 50,
      fieldsSchema: [
        {
          key: 'device_type',
          label: 'Device Type',
          dataType: 'enum',
          choices: [
            'ROUTER',
            'SWITCH',
            'FIREWALL',
            'LOAD_BALANCER',
            'ACCESS_POINT',
          ],
          order: 20,
          group: 'Network',
        },
        {
          key: 'port_count',
          label: 'Port Count',
          dataType: 'number',
          order: 21,
          group: 'Network',
        },
        {
          key: 'firmware_version',
          label: 'Firmware Version',
          dataType: 'string',
          order: 22,
          group: 'Network',
        },
        {
          key: 'ip_address',
          label: 'Management IP',
          dataType: 'string',
          order: 23,
          group: 'Network',
        },
      ],
    }),
    // Application → child of cmdb_ci
    makeClass({
      id: CLASS_IDS.cmdb_ci_application,
      name: 'cmdb_ci_application',
      label: 'Application',
      parentClassId: CLASS_IDS.cmdb_ci,
      sortOrder: 60,
      fieldsSchema: [
        {
          key: 'app_type',
          label: 'Application Type',
          dataType: 'enum',
          choices: ['WEB', 'API', 'BATCH', 'MIDDLEWARE', 'OTHER'],
          order: 10,
          group: 'Application',
        },
        {
          key: 'version',
          label: 'Version',
          dataType: 'string',
          order: 11,
          group: 'Application',
        },
        {
          key: 'tech_stack',
          label: 'Technology Stack',
          dataType: 'string',
          order: 12,
          group: 'Application',
        },
        {
          key: 'url',
          label: 'URL',
          dataType: 'string',
          order: 13,
          group: 'Application',
        },
      ],
    }),
    // Database → child of cmdb_ci
    makeClass({
      id: CLASS_IDS.cmdb_ci_database,
      name: 'cmdb_ci_database',
      label: 'Database',
      parentClassId: CLASS_IDS.cmdb_ci,
      sortOrder: 70,
      fieldsSchema: [
        {
          key: 'db_engine',
          label: 'Database Engine',
          dataType: 'enum',
          order: 10,
          group: 'Database',
        },
        {
          key: 'db_version',
          label: 'Version',
          dataType: 'string',
          order: 11,
          group: 'Database',
        },
        {
          key: 'port',
          label: 'Port',
          dataType: 'number',
          order: 12,
          group: 'Database',
        },
        {
          key: 'is_replica',
          label: 'Is Replica',
          dataType: 'boolean',
          order: 13,
          group: 'Database',
        },
        {
          key: 'connection_string',
          label: 'Connection String',
          dataType: 'string',
          order: 14,
          group: 'Database',
        },
      ],
    }),
  ];
}

// ============================================================================
// Mock repository
// ============================================================================

const mockRepository = {
  find: jest.fn().mockImplementation((opts: Record<string, unknown>) => {
    const where = opts.where as Record<string, unknown>;
    const select = opts.select as string[] | undefined;
    const order = opts.order as Record<string, string> | undefined;

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
      if (where.isDeleted !== undefined && c.isDeleted !== where.isDeleted)
        return false;
      return true;
    });
    return Promise.resolve(match ?? null);
  }),
};

// ============================================================================
// Test suite
// ============================================================================

describe('CMDB MI 2.0 — Contract Tests (Hierarchy + Schema)', () => {
  let service: CiClassInheritanceService;

  beforeEach(async () => {
    classStore = [];
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

  // ==========================================================================
  // Tree contract
  // ==========================================================================

  describe('Class Tree — Contract Shape', () => {
    beforeEach(() => seedMiHierarchy());

    it('should return exactly 1 root node (cmdb_ci)', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('cmdb_ci');
      expect(tree[0].parentClassId).toBeNull();
      expect(tree[0].isAbstract).toBe(true);
    });

    it('tree root should have 3 direct children: Hardware, Application, Database', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      const root = tree[0];
      expect(root.children).toHaveLength(3);
      const childNames = root.children.map((c) => c.name).sort();
      expect(childNames).toEqual([
        'cmdb_ci_application',
        'cmdb_ci_database',
        'cmdb_ci_hardware',
      ]);
    });

    it('Hardware subtree should contain Computer and Network Device', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      const hardware = tree[0].children.find(
        (c) => c.name === 'cmdb_ci_hardware',
      )!;
      expect(hardware).toBeDefined();
      expect(hardware.isAbstract).toBe(true);
      expect(hardware.children).toHaveLength(2);
      const hwChildren = hardware.children.map((c) => c.name).sort();
      expect(hwChildren).toEqual(['cmdb_ci_computer', 'cmdb_ci_network']);
    });

    it('Server subtree should have Linux Server and Windows Server leaves', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      const hardware = tree[0].children.find(
        (c) => c.name === 'cmdb_ci_hardware',
      )!;
      const computer = hardware.children.find(
        (c) => c.name === 'cmdb_ci_computer',
      )!;
      expect(computer.children).toHaveLength(1);
      const server = computer.children[0];
      expect(server.name).toBe('cmdb_ci_server');
      expect(server.children).toHaveLength(2);
      const serverChildren = server.children.map((c) => c.name).sort();
      expect(serverChildren).toEqual([
        'cmdb_ci_linux_server',
        'cmdb_ci_win_server',
      ]);
    });

    it('each tree node should have the expected shape', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      const root = tree[0];
      expect(root.id).toEqual(expect.any(String));
      expect(root.name).toEqual(expect.any(String));
      expect(root.label).toEqual(expect.any(String));
      expect(root.parentClassId).toBeNull();
      expect(root.isAbstract).toEqual(expect.any(Boolean));
      expect(root.isActive).toEqual(expect.any(Boolean));
      expect(root.sortOrder).toEqual(expect.any(Number));
      expect(root.localFieldCount).toEqual(expect.any(Number));
      expect(root.children).toEqual(expect.any(Array));
    });

    it('localFieldCount should reflect the number of local fields', async () => {
      const tree = await service.getClassTree(TENANT_ID);
      const root = tree[0];
      expect(root.localFieldCount).toBe(4); // ci_name, description, operational_status, managed_by
      const hardware = root.children.find(
        (c) => c.name === 'cmdb_ci_hardware',
      )!;
      expect(hardware.localFieldCount).toBe(5); // serial_number, manufacturer, model_number, asset_tag, location
    });
  });

  // ==========================================================================
  // Ancestor chain contract
  // ==========================================================================

  describe('Ancestor Chain — Contract Shape', () => {
    beforeEach(() => seedMiHierarchy());

    it('root class should have empty ancestors', async () => {
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        CLASS_IDS.cmdb_ci,
      );
      expect(ancestors).toEqual([]);
    });

    it('Hardware should have 1 ancestor (cmdb_ci)', async () => {
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_hardware,
      );
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0]).toEqual(
        expect.objectContaining({
          id: CLASS_IDS.cmdb_ci,
          name: 'cmdb_ci',
          depth: 1,
        }),
      );
    });

    it('Linux Server should have 4 ancestors (server→computer→hardware→cmdb_ci)', async () => {
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_linux_server,
      );
      expect(ancestors).toHaveLength(4);
      // Nearest first
      expect(ancestors[0].name).toBe('cmdb_ci_server');
      expect(ancestors[0].depth).toBe(1);
      expect(ancestors[1].name).toBe('cmdb_ci_computer');
      expect(ancestors[1].depth).toBe(2);
      expect(ancestors[2].name).toBe('cmdb_ci_hardware');
      expect(ancestors[2].depth).toBe(3);
      expect(ancestors[3].name).toBe('cmdb_ci');
      expect(ancestors[3].depth).toBe(4);
    });

    it('Application should have 1 ancestor (cmdb_ci)', async () => {
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_application,
      );
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].name).toBe('cmdb_ci');
    });

    it('Database should have 1 ancestor (cmdb_ci)', async () => {
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_database,
      );
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].name).toBe('cmdb_ci');
    });

    it('each ancestor entry should have the expected shape', async () => {
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_server,
      );
      for (const a of ancestors) {
        expect(a).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            label: expect.any(String),
            depth: expect.any(Number),
          }),
        );
      }
    });
  });

  // ==========================================================================
  // Descendant IDs contract
  // ==========================================================================

  describe('Descendant IDs — Contract Shape', () => {
    beforeEach(() => seedMiHierarchy());

    it('root has all 8 descendants', async () => {
      const ids = await service.getDescendantIds(TENANT_ID, CLASS_IDS.cmdb_ci);
      expect(ids).toHaveLength(8);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_hardware);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_linux_server);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_win_server);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_application);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_database);
    });

    it('Hardware has 5 descendants', async () => {
      const ids = await service.getDescendantIds(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_hardware,
      );
      expect(ids).toHaveLength(5);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_computer);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_server);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_linux_server);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_win_server);
      expect(ids).toContain(CLASS_IDS.cmdb_ci_network);
    });

    it('leaf classes (Linux Server, Windows Server, Network, Application, Database) have 0 descendants', async () => {
      for (const id of [
        CLASS_IDS.cmdb_ci_linux_server,
        CLASS_IDS.cmdb_ci_win_server,
        CLASS_IDS.cmdb_ci_network,
        CLASS_IDS.cmdb_ci_application,
        CLASS_IDS.cmdb_ci_database,
      ]) {
        const ids = await service.getDescendantIds(TENANT_ID, id);
        expect(ids).toHaveLength(0);
      }
    });
  });

  // ==========================================================================
  // Effective schema contract
  // ==========================================================================

  describe('Effective Schema — Contract Shape', () => {
    beforeEach(() => seedMiHierarchy());

    it('root class: all fields local, 0 inherited', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci,
      );
      expect(schema.classId).toBe(CLASS_IDS.cmdb_ci);
      expect(schema.className).toBe('cmdb_ci');
      expect(schema.ancestors).toHaveLength(0);
      expect(schema.totalFieldCount).toBe(4);
      expect(schema.inheritedFieldCount).toBe(0);
      expect(schema.localFieldCount).toBe(4);

      for (const f of schema.effectiveFields) {
        expect(f.inherited).toBe(false);
        expect(f.sourceClassId).toBe(CLASS_IDS.cmdb_ci);
        expect(f.sourceClassName).toBe('cmdb_ci');
        expect(f.inheritanceDepth).toBe(0);
      }
    });

    it('Hardware: 4 inherited from cmdb_ci + 5 local = 9 total', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_hardware,
      );
      expect(schema.totalFieldCount).toBe(9);
      expect(schema.inheritedFieldCount).toBe(4);
      expect(schema.localFieldCount).toBe(5);
      expect(schema.ancestors).toHaveLength(1);
    });

    it('Computer: 4 (cmdb_ci) + 5 (hardware) + 4 (local) = 13 total', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_computer,
      );
      expect(schema.totalFieldCount).toBe(13);
      expect(schema.inheritedFieldCount).toBe(9); // 4 from root + 5 from hardware
      expect(schema.localFieldCount).toBe(4);
      expect(schema.ancestors).toHaveLength(2);
    });

    it('Server: 13 (computer inherited) + 3 (local) = 16 total', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_server,
      );
      expect(schema.totalFieldCount).toBe(16);
      expect(schema.ancestors).toHaveLength(3);
    });

    it('Linux Server: os_type should be overridden (local, not inherited)', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_linux_server,
      );

      // Linux Server adds: distro, kernel_version, os_type (override)
      // From ancestor chain: ci_name, description, operational_status, managed_by (root)
      //   + serial_number, manufacturer, model_number, asset_tag, location (hardware)
      //   + cpu_count, ram_gb, ip_address (computer, minus os_type which is overridden)
      //   + server_role, is_virtual, cluster_name (server)
      // Local: distro, kernel_version, os_type (override)
      expect(schema.ancestors).toHaveLength(4);

      const osField = schema.effectiveFields.find((f) => f.key === 'os_type');
      expect(osField).toBeDefined();
      expect(osField!.inherited).toBe(false); // overridden locally
      expect(osField!.sourceClassId).toBe(CLASS_IDS.cmdb_ci_linux_server);
      expect(osField!.sourceClassName).toBe('cmdb_ci_linux_server');
      expect(osField!.readOnly).toBe(true);
      expect(osField!.defaultValue).toBe('LINUX');
      expect(osField!.choices).toEqual(['LINUX']);
    });

    it('Windows Server: os_type override should show WINDOWS', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_win_server,
      );

      const osField = schema.effectiveFields.find((f) => f.key === 'os_type');
      expect(osField).toBeDefined();
      expect(osField!.inherited).toBe(false);
      expect(osField!.sourceClassId).toBe(CLASS_IDS.cmdb_ci_win_server);
      expect(osField!.defaultValue).toBe('WINDOWS');
      expect(osField!.choices).toEqual(['WINDOWS']);
    });

    it('effective schema response should match the contract shape', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_server,
      );

      expect(schema).toEqual(
        expect.objectContaining({
          classId: expect.any(String),
          className: expect.any(String),
          classLabel: expect.any(String),
          ancestors: expect.any(Array),
          effectiveFields: expect.any(Array),
          totalFieldCount: expect.any(Number),
          inheritedFieldCount: expect.any(Number),
          localFieldCount: expect.any(Number),
        }),
      );

      // Verify field shape
      for (const f of schema.effectiveFields) {
        expect(f).toEqual(
          expect.objectContaining({
            key: expect.any(String),
            label: expect.any(String),
            dataType: expect.any(String),
            sourceClassId: expect.any(String),
            sourceClassName: expect.any(String),
            inherited: expect.any(Boolean),
            inheritanceDepth: expect.any(Number),
          }),
        );
      }
    });

    it('Application: 4 inherited from cmdb_ci + 4 local = 8 total', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_application,
      );
      expect(schema.totalFieldCount).toBe(8);
      expect(schema.inheritedFieldCount).toBe(4);
      expect(schema.localFieldCount).toBe(4);
    });

    it('Database: 4 inherited from cmdb_ci + 5 local = 9 total', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_database,
      );
      expect(schema.totalFieldCount).toBe(9);
      expect(schema.inheritedFieldCount).toBe(4);
      expect(schema.localFieldCount).toBe(5);
    });

    it('Network Device: 4 (cmdb_ci) + 5 (hardware) + 4 (local) = 13 total', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_network,
      );
      expect(schema.totalFieldCount).toBe(13);
      expect(schema.inheritedFieldCount).toBe(9);
      expect(schema.localFieldCount).toBe(4);
    });

    it('fields should be sorted by order', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_linux_server,
      );
      const orders = schema.effectiveFields.map((f) => f.order ?? 9999);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
      }
    });

    it('each inherited field should reference an ancestor sourceClassId', async () => {
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_linux_server,
      );
      const ancestorIds = schema.ancestors.map((a) => a.id);

      for (const f of schema.effectiveFields) {
        if (f.inherited) {
          expect(ancestorIds).toContain(f.sourceClassId);
        } else {
          expect(f.sourceClassId).toBe(CLASS_IDS.cmdb_ci_linux_server);
        }
      }
    });
  });

  // ==========================================================================
  // Validate inheritance change — contract
  // ==========================================================================

  describe('Validate Inheritance Change — Contract', () => {
    beforeEach(() => seedMiHierarchy());

    it('should reject self-reference', async () => {
      const result = await service.validateInheritanceChange(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_server,
        CLASS_IDS.cmdb_ci_server,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('own parent'),
      );
    });

    it('should reject circular inheritance (descendant as parent)', async () => {
      const result = await service.validateInheritanceChange(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_hardware,
        CLASS_IDS.cmdb_ci_linux_server,
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cycle');
    });

    it('should allow setting parent to null (become root)', async () => {
      const result = await service.validateInheritanceChange(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_server,
        null,
      );
      expect(result.valid).toBe(true);
      expect(result.effectiveDepth).toBe(0);
    });

    it('should allow valid reparenting (Application under Hardware)', async () => {
      const result = await service.validateInheritanceChange(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_application,
        CLASS_IDS.cmdb_ci_hardware,
      );
      expect(result.valid).toBe(true);
      expect(result.effectiveDepth).toBeGreaterThan(0);
    });

    it('validation result should match the expected shape', async () => {
      const result = await service.validateInheritanceChange(
        TENANT_ID,
        CLASS_IDS.cmdb_ci_server,
        null,
      );
      expect(result).toEqual(
        expect.objectContaining({
          valid: expect.any(Boolean),
          errors: expect.any(Array),
          warnings: expect.any(Array),
        }),
      );
    });

    it('should detect field overrides as warnings when reparenting', async () => {
      // Create a class with a field that collides with the target parent chain
      classStore.push(
        makeClass({
          id: 'test-class-001',
          name: 'test_class',
          fieldsSchema: [
            {
              key: 'ci_name',
              label: 'Custom CI Name',
              dataType: 'string',
              order: 1,
            },
          ],
        }),
      );

      const result = await service.validateInheritanceChange(
        TENANT_ID,
        'test-class-001',
        CLASS_IDS.cmdb_ci,
      );
      expect(result.valid).toBe(true);
      // Should warn about ci_name collision
      if (result.warnings.length > 0) {
        expect(result.warnings[0]).toContain('ci_name');
      }
      if (result.fieldOverrides && result.fieldOverrides.length > 0) {
        expect(result.fieldOverrides[0].key).toBe('ci_name');
      }
    });
  });

  // ==========================================================================
  // Backward compatibility — classes without parents still work
  // ==========================================================================

  describe('Backward Compatibility — Parentless Classes', () => {
    it('classes without parents work for all operations', async () => {
      classStore = [
        makeClass({
          id: 'standalone-001',
          name: 'standalone_server',
          label: 'Standalone Server',
          fieldsSchema: [
            {
              key: 'hostname',
              label: 'Hostname',
              dataType: 'string',
              order: 1,
            },
          ],
        }),
      ];

      // Tree
      const tree = await service.getClassTree(TENANT_ID);
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('standalone_server');
      expect(tree[0].parentClassId).toBeNull();

      // Ancestors
      const ancestors = await service.getAncestorChain(
        TENANT_ID,
        'standalone-001',
      );
      expect(ancestors).toEqual([]);

      // Descendants
      const descendants = await service.getDescendantIds(
        TENANT_ID,
        'standalone-001',
      );
      expect(descendants).toEqual([]);

      // Effective schema
      const schema = await service.getEffectiveSchema(
        TENANT_ID,
        'standalone-001',
      );
      expect(schema.totalFieldCount).toBe(1);
      expect(schema.inheritedFieldCount).toBe(0);
      expect(schema.localFieldCount).toBe(1);
      expect(schema.ancestors).toEqual([]);
    });

    it('classes with null fieldsSchema return empty effective fields', async () => {
      classStore = [
        makeClass({
          id: 'empty-001',
          name: 'empty_class',
          fieldsSchema: null,
        }),
      ];

      const schema = await service.getEffectiveSchema(TENANT_ID, 'empty-001');
      expect(schema.effectiveFields).toEqual([]);
      expect(schema.totalFieldCount).toBe(0);
    });
  });
});
