/**
 * CMDB Model Intelligence 2.0 — Deterministic Seed Pack
 *
 * Seeds a class hierarchy with inheritance, relationship type semantics catalog,
 * sample CIs using the hierarchy, and relationships using the seeded types.
 *
 * All IDs are deterministic (fixed UUIDs) so this seed is idempotent and safe
 * to run multiple times on the same database.
 *
 * Usage (dev):  npm run seed:cmdb-mi-demo:dev
 * Usage (prod): npm run seed:cmdb-mi-demo
 */
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import {
  CmdbCiClass,
  CiClassFieldDefinition,
} from '../itsm/cmdb/ci-class/ci-class.entity';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';
import { CmdbCiRel } from '../itsm/cmdb/ci-rel/ci-rel.entity';
import {
  CmdbRelationshipType,
  RelationshipDirectionality,
  RiskPropagationHint,
} from '../itsm/cmdb/relationship-type/relationship-type.entity';

// ============================================================================
// Constants
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// ============================================================================
// Deterministic UUIDs — CI Classes (hierarchy)
// ============================================================================

const CLASS_IDS = {
  /** Root abstract class: Configuration Item */
  cmdb_ci: 'c1a00000-0000-0000-0000-000000000001',
  /** Hardware (abstract) → child of cmdb_ci */
  cmdb_ci_hardware: 'c1a00000-0000-0000-0000-000000000010',
  /** Computer → child of Hardware */
  cmdb_ci_computer: 'c1a00000-0000-0000-0000-000000000011',
  /** Server → child of Computer */
  cmdb_ci_server: 'c1a00000-0000-0000-0000-000000000012',
  /** Linux Server → child of Server */
  cmdb_ci_linux_server: 'c1a00000-0000-0000-0000-000000000013',
  /** Windows Server → child of Server */
  cmdb_ci_win_server: 'c1a00000-0000-0000-0000-000000000014',
  /** Network Device → child of Hardware */
  cmdb_ci_network: 'c1a00000-0000-0000-0000-000000000020',
  /** Application (abstract) → child of cmdb_ci */
  cmdb_ci_application: 'c1a00000-0000-0000-0000-000000000030',
  /** Database → child of cmdb_ci */
  cmdb_ci_database: 'c1a00000-0000-0000-0000-000000000040',
} as const;

// ============================================================================
// Deterministic UUIDs — Relationship Types
// ============================================================================

const RELTYPE_IDS = {
  depends_on: 'r1a00000-0000-0000-0000-000000000001',
  runs_on: 'r1a00000-0000-0000-0000-000000000002',
  hosted_on: 'r1a00000-0000-0000-0000-000000000003',
  connects_to: 'r1a00000-0000-0000-0000-000000000004',
  used_by: 'r1a00000-0000-0000-0000-000000000005',
  contains: 'r1a00000-0000-0000-0000-000000000006',
  member_of: 'r1a00000-0000-0000-0000-000000000007',
} as const;

// ============================================================================
// Deterministic UUIDs — Sample CIs
// ============================================================================

const CI_IDS = {
  /** Linux server: prod-app-01 */
  PROD_APP_01: 'c1b00000-0000-0000-0000-000000000001',
  /** Linux server: prod-app-02 */
  PROD_APP_02: 'c1b00000-0000-0000-0000-000000000002',
  /** Windows server: prod-iis-01 */
  PROD_IIS_01: 'c1b00000-0000-0000-0000-000000000003',
  /** Database: prod-pg-primary */
  PROD_PG_PRIMARY: 'c1b00000-0000-0000-0000-000000000010',
  /** Database: prod-pg-replica */
  PROD_PG_REPLICA: 'c1b00000-0000-0000-0000-000000000011',
  /** Network device: prod-fw-01 */
  PROD_FW_01: 'c1b00000-0000-0000-0000-000000000020',
  /** Network device: prod-sw-core */
  PROD_SW_CORE: 'c1b00000-0000-0000-0000-000000000021',
  /** Application: grc-platform */
  GRC_PLATFORM: 'c1b00000-0000-0000-0000-000000000030',
  /** Application: auth-service */
  AUTH_SERVICE: 'c1b00000-0000-0000-0000-000000000031',
} as const;

// ============================================================================
// CI Class Definitions (with inheritance hierarchy + fieldsSchema)
// ============================================================================

interface ClassSeed {
  id: string;
  name: string;
  label: string;
  description: string;
  icon: string;
  parentClassId: string | null;
  isAbstract: boolean;
  sortOrder: number;
  fieldsSchema: CiClassFieldDefinition[];
}

const CLASS_SEEDS: ClassSeed[] = [
  // ── Root: cmdb_ci (abstract) ──
  {
    id: CLASS_IDS.cmdb_ci,
    name: 'cmdb_ci',
    label: 'Configuration Item',
    description: 'Root abstract class for all configuration items',
    icon: 'settings',
    parentClassId: null,
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
  },

  // ── Hardware (abstract) → child of cmdb_ci ──
  {
    id: CLASS_IDS.cmdb_ci_hardware,
    name: 'cmdb_ci_hardware',
    label: 'Hardware',
    description: 'Abstract class for physical hardware items',
    icon: 'memory',
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
  },

  // ── Computer → child of Hardware ──
  {
    id: CLASS_IDS.cmdb_ci_computer,
    name: 'cmdb_ci_computer',
    label: 'Computer',
    description: 'Physical or virtual computer',
    icon: 'computer',
    parentClassId: CLASS_IDS.cmdb_ci_hardware,
    isAbstract: false,
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
  },

  // ── Server → child of Computer ──
  {
    id: CLASS_IDS.cmdb_ci_server,
    name: 'cmdb_ci_server',
    label: 'Server',
    description: 'Production or staging server',
    icon: 'dns',
    parentClassId: CLASS_IDS.cmdb_ci_computer,
    isAbstract: false,
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
  },

  // ── Linux Server → child of Server ──
  {
    id: CLASS_IDS.cmdb_ci_linux_server,
    name: 'cmdb_ci_linux_server',
    label: 'Linux Server',
    description: 'Linux-based server',
    icon: 'terminal',
    parentClassId: CLASS_IDS.cmdb_ci_server,
    isAbstract: false,
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
      // Override: make os_type read-only with default LINUX
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
  },

  // ── Windows Server → child of Server ──
  {
    id: CLASS_IDS.cmdb_ci_win_server,
    name: 'cmdb_ci_win_server',
    label: 'Windows Server',
    description: 'Windows-based server',
    icon: 'desktop_windows',
    parentClassId: CLASS_IDS.cmdb_ci_server,
    isAbstract: false,
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
      // Override: make os_type read-only with default WINDOWS
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
  },

  // ── Network Device → child of Hardware ──
  {
    id: CLASS_IDS.cmdb_ci_network,
    name: 'cmdb_ci_network',
    label: 'Network Device',
    description: 'Router, switch, firewall, or load balancer',
    icon: 'router',
    parentClassId: CLASS_IDS.cmdb_ci_hardware,
    isAbstract: false,
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
  },

  // ── Application (abstract) → child of cmdb_ci ──
  {
    id: CLASS_IDS.cmdb_ci_application,
    name: 'cmdb_ci_application',
    label: 'Application',
    description: 'Software application or microservice',
    icon: 'apps',
    parentClassId: CLASS_IDS.cmdb_ci,
    isAbstract: false,
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
        helpText: 'e.g. NestJS, React, PostgreSQL',
      },
      {
        key: 'url',
        label: 'URL',
        dataType: 'string',
        order: 13,
        group: 'Application',
      },
    ],
  },

  // ── Database → child of cmdb_ci ──
  {
    id: CLASS_IDS.cmdb_ci_database,
    name: 'cmdb_ci_database',
    label: 'Database',
    description: 'Database instance or cluster',
    icon: 'storage',
    parentClassId: CLASS_IDS.cmdb_ci,
    isAbstract: false,
    sortOrder: 70,
    fieldsSchema: [
      {
        key: 'db_engine',
        label: 'Database Engine',
        dataType: 'enum',
        choices: [
          'POSTGRESQL',
          'MYSQL',
          'MSSQL',
          'MONGODB',
          'REDIS',
          'ELASTICSEARCH',
          'OTHER',
        ],
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
        helpText: 'Sanitized connection string (no passwords)',
      },
    ],
  },
];

// ============================================================================
// Relationship Type Semantics Catalog
// ============================================================================

interface RelTypeSeed {
  id: string;
  name: string;
  label: string;
  description: string;
  directionality: RelationshipDirectionality;
  inverseLabel: string | null;
  riskPropagation: RiskPropagationHint;
  allowedSourceClasses: string[] | null;
  allowedTargetClasses: string[] | null;
  allowSelfLoop: boolean;
  allowCycles: boolean;
  sortOrder: number;
}

const RELTYPE_SEEDS: RelTypeSeed[] = [
  {
    id: RELTYPE_IDS.depends_on,
    name: 'depends_on',
    label: 'Depends On',
    description:
      'Source depends on target for functionality. Risk propagates forward (target failure impacts source).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Depended On By',
    riskPropagation: RiskPropagationHint.FORWARD,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 10,
  },
  {
    id: RELTYPE_IDS.runs_on,
    name: 'runs_on',
    label: 'Runs On',
    description:
      'Application/service runs on a server or infrastructure. Risk propagates from infra to app (reverse).',
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
  },
  {
    id: RELTYPE_IDS.hosted_on,
    name: 'hosted_on',
    label: 'Hosted On',
    description:
      'Source is hosted on target infrastructure. Risk propagates from infra to hosted item (reverse).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Hosts',
    riskPropagation: RiskPropagationHint.REVERSE,
    allowedSourceClasses: null,
    allowedTargetClasses: [
      'cmdb_ci_hardware',
      'cmdb_ci_computer',
      'cmdb_ci_server',
    ],
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 30,
  },
  {
    id: RELTYPE_IDS.connects_to,
    name: 'connects_to',
    label: 'Connects To',
    description:
      'Bidirectional network or data connectivity. Risk propagates in both directions.',
    directionality: RelationshipDirectionality.BIDIRECTIONAL,
    inverseLabel: 'Connected From',
    riskPropagation: RiskPropagationHint.BOTH,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: true,
    sortOrder: 40,
  },
  {
    id: RELTYPE_IDS.used_by,
    name: 'used_by',
    label: 'Used By',
    description:
      'Source resource is used/consumed by target. Risk propagates in reverse (source failure impacts target).',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Uses',
    riskPropagation: RiskPropagationHint.REVERSE,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 50,
  },
  {
    id: RELTYPE_IDS.contains,
    name: 'contains',
    label: 'Contains',
    description:
      'Parent-child containment. Source physically or logically contains target.',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Contained By',
    riskPropagation: RiskPropagationHint.FORWARD,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 60,
  },
  {
    id: RELTYPE_IDS.member_of,
    name: 'member_of',
    label: 'Member Of',
    description:
      'Source is a member/part of target group or cluster. No risk propagation.',
    directionality: RelationshipDirectionality.UNIDIRECTIONAL,
    inverseLabel: 'Has Member',
    riskPropagation: RiskPropagationHint.NONE,
    allowedSourceClasses: null,
    allowedTargetClasses: null,
    allowSelfLoop: false,
    allowCycles: false,
    sortOrder: 70,
  },
];

// ============================================================================
// Sample CIs (using hierarchy classes)
// ============================================================================

interface CiSeed {
  id: string;
  name: string;
  description: string;
  classId: string;
  lifecycle: string;
  environment: string;
  ipAddress?: string;
  dnsName?: string;
  attributes?: Record<string, unknown>;
}

const CI_SEEDS: CiSeed[] = [
  {
    id: CI_IDS.PROD_APP_01,
    name: 'MI-PROD-APP-01',
    description: 'Primary Linux application server (Ubuntu 22.04)',
    classId: CLASS_IDS.cmdb_ci_linux_server,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.1.10',
    dnsName: 'prod-app-01.internal',
    attributes: {
      distro: 'UBUNTU',
      kernel_version: '5.15.0',
      cpu_count: 8,
      ram_gb: 32,
      server_role: 'APP',
      is_virtual: true,
    },
  },
  {
    id: CI_IDS.PROD_APP_02,
    name: 'MI-PROD-APP-02',
    description: 'Secondary Linux application server (Ubuntu 22.04)',
    classId: CLASS_IDS.cmdb_ci_linux_server,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.1.11',
    dnsName: 'prod-app-02.internal',
    attributes: {
      distro: 'UBUNTU',
      kernel_version: '5.15.0',
      cpu_count: 8,
      ram_gb: 32,
      server_role: 'APP',
      is_virtual: true,
    },
  },
  {
    id: CI_IDS.PROD_IIS_01,
    name: 'MI-PROD-IIS-01',
    description: 'Windows Server running IIS for legacy app',
    classId: CLASS_IDS.cmdb_ci_win_server,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.2.10',
    dnsName: 'prod-iis-01.internal',
    attributes: {
      windows_version: '2022',
      domain_joined: true,
      server_role: 'WEB',
      is_virtual: true,
    },
  },
  {
    id: CI_IDS.PROD_PG_PRIMARY,
    name: 'MI-PROD-PG-PRIMARY',
    description: 'Primary PostgreSQL 15 database',
    classId: CLASS_IDS.cmdb_ci_database,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.3.10',
    dnsName: 'prod-pg-primary.internal',
    attributes: {
      db_engine: 'POSTGRESQL',
      db_version: '15.4',
      port: 5432,
      is_replica: false,
    },
  },
  {
    id: CI_IDS.PROD_PG_REPLICA,
    name: 'MI-PROD-PG-REPLICA',
    description: 'PostgreSQL 15 read replica',
    classId: CLASS_IDS.cmdb_ci_database,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.3.11',
    dnsName: 'prod-pg-replica.internal',
    attributes: {
      db_engine: 'POSTGRESQL',
      db_version: '15.4',
      port: 5432,
      is_replica: true,
    },
  },
  {
    id: CI_IDS.PROD_FW_01,
    name: 'MI-PROD-FW-01',
    description: 'Production edge firewall',
    classId: CLASS_IDS.cmdb_ci_network,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.0.1',
    attributes: {
      device_type: 'FIREWALL',
      port_count: 48,
      firmware_version: '7.2.1',
    },
  },
  {
    id: CI_IDS.PROD_SW_CORE,
    name: 'MI-PROD-SW-CORE',
    description: 'Core distribution switch',
    classId: CLASS_IDS.cmdb_ci_network,
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.100.0.2',
    attributes: {
      device_type: 'SWITCH',
      port_count: 96,
      firmware_version: '4.3.0',
    },
  },
  {
    id: CI_IDS.GRC_PLATFORM,
    name: 'MI-GRC-Platform',
    description: 'GRC Platform application (NestJS + React)',
    classId: CLASS_IDS.cmdb_ci_application,
    lifecycle: 'active',
    environment: 'production',
    attributes: {
      app_type: 'WEB',
      version: '2.0.0',
      tech_stack: 'NestJS, React, PostgreSQL',
      url: 'https://grc.example.com',
    },
  },
  {
    id: CI_IDS.AUTH_SERVICE,
    name: 'MI-Auth-Service',
    description: 'Authentication micro-service',
    classId: CLASS_IDS.cmdb_ci_application,
    lifecycle: 'active',
    environment: 'production',
    attributes: {
      app_type: 'API',
      version: '1.5.0',
      tech_stack: 'NestJS',
      url: 'https://auth.example.com',
    },
  },
];

// ============================================================================
// Sample Relationships (using seeded types)
// ============================================================================

interface RelSeed {
  sourceCiId: string;
  targetCiId: string;
  type: string;
  notes?: string;
}

const REL_SEEDS: RelSeed[] = [
  // GRC Platform runs on both Linux app servers
  {
    sourceCiId: CI_IDS.GRC_PLATFORM,
    targetCiId: CI_IDS.PROD_APP_01,
    type: 'runs_on',
    notes: 'Primary instance',
  },
  {
    sourceCiId: CI_IDS.GRC_PLATFORM,
    targetCiId: CI_IDS.PROD_APP_02,
    type: 'runs_on',
    notes: 'Secondary instance',
  },
  // GRC Platform depends on PostgreSQL primary
  {
    sourceCiId: CI_IDS.GRC_PLATFORM,
    targetCiId: CI_IDS.PROD_PG_PRIMARY,
    type: 'depends_on',
    notes: 'Primary database',
  },
  // GRC Platform depends on auth service
  {
    sourceCiId: CI_IDS.GRC_PLATFORM,
    targetCiId: CI_IDS.AUTH_SERVICE,
    type: 'depends_on',
    notes: 'Authentication',
  },
  // Auth service runs on app server 01
  {
    sourceCiId: CI_IDS.AUTH_SERVICE,
    targetCiId: CI_IDS.PROD_APP_01,
    type: 'runs_on',
  },
  // Auth service depends on PG primary
  {
    sourceCiId: CI_IDS.AUTH_SERVICE,
    targetCiId: CI_IDS.PROD_PG_PRIMARY,
    type: 'depends_on',
  },
  // PG replica depends on PG primary (replication)
  {
    sourceCiId: CI_IDS.PROD_PG_REPLICA,
    targetCiId: CI_IDS.PROD_PG_PRIMARY,
    type: 'depends_on',
    notes: 'Streaming replication',
  },
  // DB hosted on Linux servers
  {
    sourceCiId: CI_IDS.PROD_PG_PRIMARY,
    targetCiId: CI_IDS.PROD_APP_01,
    type: 'hosted_on',
    notes: 'Co-located for demo',
  },
  // Network connectivity
  {
    sourceCiId: CI_IDS.PROD_APP_01,
    targetCiId: CI_IDS.PROD_SW_CORE,
    type: 'connects_to',
  },
  {
    sourceCiId: CI_IDS.PROD_APP_02,
    targetCiId: CI_IDS.PROD_SW_CORE,
    type: 'connects_to',
  },
  {
    sourceCiId: CI_IDS.PROD_SW_CORE,
    targetCiId: CI_IDS.PROD_FW_01,
    type: 'connects_to',
    notes: 'Uplink to firewall',
  },
  // IIS server connects to core switch
  {
    sourceCiId: CI_IDS.PROD_IIS_01,
    targetCiId: CI_IDS.PROD_SW_CORE,
    type: 'connects_to',
  },
];

// ============================================================================
// Seed functions
// ============================================================================

async function seedCmdbMiDemo() {
  console.log('=== CMDB Model Intelligence 2.0 — Deterministic Seed ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    // ── 1. Seed CI Classes (with hierarchy + fieldsSchema) ──
    console.log('1) Seeding CI class hierarchy...');
    const classRepo = ds.getRepository(CmdbCiClass);
    let classCreated = 0;
    let classUpdated = 0;
    let classSkipped = 0;

    for (const seed of CLASS_SEEDS) {
      const existing = await classRepo.findOne({
        where: { id: seed.id, tenantId: DEMO_TENANT_ID },
      });

      if (existing && !existing.isDeleted) {
        // Check if hierarchy or schema needs update
        const needsUpdate =
          existing.parentClassId !== seed.parentClassId ||
          existing.isAbstract !== seed.isAbstract ||
          JSON.stringify(existing.fieldsSchema) !==
            JSON.stringify(seed.fieldsSchema);

        if (needsUpdate) {
          await classRepo.update(existing.id, {
            parentClassId: seed.parentClassId,
            isAbstract: seed.isAbstract,
            fieldsSchema: seed.fieldsSchema as any,
            label: seed.label,
            description: seed.description,
            icon: seed.icon,
            sortOrder: seed.sortOrder,
          });
          classUpdated++;
          console.log(
            `   Updated: ${seed.name} (parentClassId=${seed.parentClassId || 'null'}, fields=${seed.fieldsSchema.length})`,
          );
        } else {
          classSkipped++;
        }
        continue;
      }

      // Check if name exists (non-deterministic ID — from baseline seed)
      const existingByName = await classRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: seed.name, isDeleted: false },
      });

      if (existingByName) {
        // Update existing class to add hierarchy + schema
        await classRepo.update(existingByName.id, {
          parentClassId: seed.parentClassId,
          isAbstract: seed.isAbstract,
          fieldsSchema: seed.fieldsSchema as any,
          label: seed.label,
          description: seed.description,
          icon: seed.icon,
          sortOrder: seed.sortOrder,
        });
        classUpdated++;
        console.log(
          `   Updated (by name): ${seed.name} → added hierarchy + fields`,
        );
        continue;
      }

      // Create new class with deterministic ID
      const entity = classRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: seed.name,
        label: seed.label,
        description: seed.description,
        icon: seed.icon,
        parentClassId: seed.parentClassId,
        isAbstract: seed.isAbstract,
        isActive: true,
        sortOrder: seed.sortOrder,
        fieldsSchema: seed.fieldsSchema,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      entity.id = seed.id;
      await classRepo.save(entity);
      classCreated++;
    }
    console.log(
      `   CI Classes: ${classCreated} created, ${classUpdated} updated, ${classSkipped} skipped\n`,
    );

    // ── 2. Seed Relationship Type Semantics ──
    console.log('2) Seeding relationship type semantics catalog...');
    const relTypeRepo = ds.getRepository(CmdbRelationshipType);
    let relTypeCreated = 0;
    let relTypeUpdated = 0;
    let relTypeSkipped = 0;

    for (const seed of RELTYPE_SEEDS) {
      const existing = await relTypeRepo.findOne({
        where: { id: seed.id, tenantId: DEMO_TENANT_ID },
      });

      if (existing && !existing.isDeleted) {
        // Check if semantics need update
        const needsUpdate =
          existing.directionality !== seed.directionality ||
          existing.riskPropagation !== seed.riskPropagation ||
          existing.inverseLabel !== seed.inverseLabel ||
          JSON.stringify(existing.allowedSourceClasses) !==
            JSON.stringify(seed.allowedSourceClasses) ||
          JSON.stringify(existing.allowedTargetClasses) !==
            JSON.stringify(seed.allowedTargetClasses);

        if (needsUpdate) {
          await relTypeRepo.update(existing.id, {
            label: seed.label,
            description: seed.description,
            directionality: seed.directionality,
            inverseLabel: seed.inverseLabel,
            riskPropagation: seed.riskPropagation,
            allowedSourceClasses: seed.allowedSourceClasses,
            allowedTargetClasses: seed.allowedTargetClasses,
            allowSelfLoop: seed.allowSelfLoop,
            allowCycles: seed.allowCycles,
            sortOrder: seed.sortOrder,
          });
          relTypeUpdated++;
        } else {
          relTypeSkipped++;
        }
        continue;
      }

      // Check if name exists (from another source)
      const existingByName = await relTypeRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: seed.name, isDeleted: false },
      });

      if (existingByName) {
        await relTypeRepo.update(existingByName.id, {
          label: seed.label,
          description: seed.description,
          directionality: seed.directionality,
          inverseLabel: seed.inverseLabel,
          riskPropagation: seed.riskPropagation,
          allowedSourceClasses: seed.allowedSourceClasses,
          allowedTargetClasses: seed.allowedTargetClasses,
          allowSelfLoop: seed.allowSelfLoop,
          allowCycles: seed.allowCycles,
          sortOrder: seed.sortOrder,
        });
        relTypeUpdated++;
        console.log(`   Updated (by name): ${seed.name}`);
        continue;
      }

      // Create new with deterministic ID
      const entity = relTypeRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: seed.name,
        label: seed.label,
        description: seed.description,
        directionality: seed.directionality,
        inverseLabel: seed.inverseLabel,
        riskPropagation: seed.riskPropagation,
        allowedSourceClasses: seed.allowedSourceClasses,
        allowedTargetClasses: seed.allowedTargetClasses,
        allowSelfLoop: seed.allowSelfLoop,
        allowCycles: seed.allowCycles,
        isActive: true,
        isSystem: true,
        sortOrder: seed.sortOrder,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      entity.id = seed.id;
      await relTypeRepo.save(entity);
      relTypeCreated++;
    }
    console.log(
      `   Relationship Types: ${relTypeCreated} created, ${relTypeUpdated} updated, ${relTypeSkipped} skipped\n`,
    );

    // ── 3. Seed Sample CIs ──
    console.log('3) Seeding sample CIs...');
    const ciRepo = ds.getRepository(CmdbCi);
    let ciCreated = 0;
    let ciSkipped = 0;

    for (const seed of CI_SEEDS) {
      const existing = await ciRepo.findOne({
        where: { id: seed.id, tenantId: DEMO_TENANT_ID },
      });

      if (existing && !existing.isDeleted) {
        ciSkipped++;
        continue;
      }

      // Check by name as well
      const existingByName = await ciRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: seed.name, isDeleted: false },
      });

      if (existingByName) {
        ciSkipped++;
        continue;
      }

      const entity = ciRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: seed.name,
        description: seed.description,
        classId: seed.classId,
        lifecycle: seed.lifecycle,
        environment: seed.environment,
        ipAddress: seed.ipAddress || null,
        dnsName: seed.dnsName || null,
        attributes: seed.attributes || null,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      entity.id = seed.id;
      await ciRepo.save(entity);
      ciCreated++;
    }
    console.log(`   CIs: ${ciCreated} created, ${ciSkipped} skipped\n`);

    // ── 4. Seed CI Relationships ──
    console.log('4) Seeding CI relationships...');
    const relRepo = ds.getRepository(CmdbCiRel);
    let relCreated = 0;
    let relSkipped = 0;

    for (const seed of REL_SEEDS) {
      const existing = await relRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          sourceCiId: seed.sourceCiId,
          targetCiId: seed.targetCiId,
          type: seed.type,
          isDeleted: false,
        },
      });

      if (existing) {
        relSkipped++;
        continue;
      }

      const entity = relRepo.create({
        tenantId: DEMO_TENANT_ID,
        sourceCiId: seed.sourceCiId,
        targetCiId: seed.targetCiId,
        type: seed.type,
        notes: seed.notes || null,
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await relRepo.save(entity);
      relCreated++;
    }
    console.log(
      `   Relationships: ${relCreated} created, ${relSkipped} skipped\n`,
    );

    // ── Summary ──
    console.log('=== CMDB MI 2.0 Seed Summary ===');
    console.log(
      `  Class hierarchy: ${CLASS_SEEDS.length} classes (max depth: 4)`,
    );
    console.log(`  Relationship types: ${RELTYPE_SEEDS.length} semantic types`);
    console.log(`  Sample CIs: ${CI_SEEDS.length} items`);
    console.log(`  Sample relationships: ${REL_SEEDS.length} edges`);
    console.log('=== Done ===');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

// Export constants for use in tests
export {
  CLASS_IDS,
  RELTYPE_IDS,
  CI_IDS,
  CLASS_SEEDS,
  RELTYPE_SEEDS,
  CI_SEEDS,
  REL_SEEDS,
};

void seedCmdbMiDemo();
