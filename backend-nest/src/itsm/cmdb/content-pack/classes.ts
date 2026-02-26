/**
 * CMDB Baseline Content Pack v1 — Class Hierarchy Definitions
 *
 * Defines the system-provided CI class hierarchy with deterministic UUIDs.
 * These classes form the default CMDB model that ships out-of-the-box.
 *
 * Hierarchy:
 *   cmdb_ci (abstract root)
 *   ├── cmdb_ci_hardware (abstract)
 *   │   ├── cmdb_ci_computer
 *   │   │   ├── cmdb_ci_server
 *   │   │   │   ├── cmdb_ci_linux_server
 *   │   │   │   └── cmdb_ci_win_server
 *   │   │   └── cmdb_ci_virtual_machine
 *   │   ├── cmdb_ci_network_device
 *   │   │   ├── cmdb_ci_firewall
 *   │   │   ├── cmdb_ci_load_balancer
 *   │   │   ├── cmdb_ci_router
 *   │   │   └── cmdb_ci_switch
 *   │   └── cmdb_ci_storage
 *   ├── cmdb_ci_application (abstract)
 *   │   ├── cmdb_ci_business_app
 *   │   ├── cmdb_ci_web_application
 *   │   └── cmdb_ci_app_service
 *   ├── cmdb_ci_database
 *   │   └── cmdb_ci_db_instance
 *   └── cmdb_ci_service (abstract)
 *       └── cmdb_ci_service_offering
 */

import { CiClassFieldDefinition } from '../ci-class/ci-class.entity';
import {
  ROOT_FIELDS,
  HARDWARE_FIELDS,
  COMPUTER_FIELDS,
  SERVER_FIELDS,
  LINUX_SERVER_FIELDS,
  WINDOWS_SERVER_FIELDS,
  VIRTUAL_MACHINE_FIELDS,
  NETWORK_DEVICE_FIELDS,
  FIREWALL_FIELDS,
  LOAD_BALANCER_FIELDS,
  ROUTER_FIELDS,
  SWITCH_FIELDS,
  STORAGE_FIELDS,
  APPLICATION_FIELDS,
  BUSINESS_APP_FIELDS,
  WEB_APPLICATION_FIELDS,
  APP_SERVICE_FIELDS,
  DATABASE_FIELDS,
  DB_INSTANCE_FIELDS,
  SERVICE_FIELDS,
  SERVICE_OFFERING_FIELDS,
} from './fields';

// ============================================================================
// Deterministic UUIDs — CI Classes
// Prefix: c1a00000-0000-0000-0000-0000000000xx
// ============================================================================

export const CLASS_IDS = {
  // Root
  cmdb_ci: 'c1a00000-0000-0000-0000-000000000001',

  // Hardware subtree
  cmdb_ci_hardware: 'c1a00000-0000-0000-0000-000000000010',
  cmdb_ci_computer: 'c1a00000-0000-0000-0000-000000000011',
  cmdb_ci_server: 'c1a00000-0000-0000-0000-000000000012',
  cmdb_ci_linux_server: 'c1a00000-0000-0000-0000-000000000013',
  cmdb_ci_win_server: 'c1a00000-0000-0000-0000-000000000014',
  cmdb_ci_virtual_machine: 'c1a00000-0000-0000-0000-000000000015',
  cmdb_ci_network_device: 'c1a00000-0000-0000-0000-000000000020',
  cmdb_ci_firewall: 'c1a00000-0000-0000-0000-000000000021',
  cmdb_ci_load_balancer: 'c1a00000-0000-0000-0000-000000000022',
  cmdb_ci_router: 'c1a00000-0000-0000-0000-000000000024',
  cmdb_ci_switch: 'c1a00000-0000-0000-0000-000000000025',
  cmdb_ci_storage: 'c1a00000-0000-0000-0000-000000000023',

  // Application subtree
  cmdb_ci_application: 'c1a00000-0000-0000-0000-000000000030',
  cmdb_ci_business_app: 'c1a00000-0000-0000-0000-000000000031',
  cmdb_ci_web_application: 'c1a00000-0000-0000-0000-000000000032',
  cmdb_ci_app_service: 'c1a00000-0000-0000-0000-000000000033',

  // Database subtree
  cmdb_ci_database: 'c1a00000-0000-0000-0000-000000000040',
  cmdb_ci_db_instance: 'c1a00000-0000-0000-0000-000000000041',

  // Service subtree
  cmdb_ci_service: 'c1a00000-0000-0000-0000-000000000050',
  cmdb_ci_service_offering: 'c1a00000-0000-0000-0000-000000000051',
} as const;

/**
 * Seed definition for a CI class in the baseline content pack.
 */
export interface BaselineClassDef {
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

/**
 * Complete list of baseline CI class definitions.
 * Order matters: parents must come before children for safe insertion.
 */
export const BASELINE_CLASSES: BaselineClassDef[] = [
  // ========================================================================
  // Root: cmdb_ci (abstract)
  // ========================================================================
  {
    id: CLASS_IDS.cmdb_ci,
    name: 'cmdb_ci',
    label: 'Configuration Item',
    description:
      'Root abstract class for all configuration items. Defines common fields inherited by all CI types.',
    icon: 'settings',
    parentClassId: null,
    isAbstract: true,
    sortOrder: 0,
    fieldsSchema: ROOT_FIELDS,
  },

  // ========================================================================
  // Hardware subtree
  // ========================================================================
  {
    id: CLASS_IDS.cmdb_ci_hardware,
    name: 'cmdb_ci_hardware',
    label: 'Hardware',
    description:
      'Abstract class for physical hardware items (servers, network devices, storage).',
    icon: 'memory',
    parentClassId: CLASS_IDS.cmdb_ci,
    isAbstract: true,
    sortOrder: 10,
    fieldsSchema: HARDWARE_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_computer,
    name: 'cmdb_ci_computer',
    label: 'Computer',
    description: 'Physical or virtual computer with CPU, memory, and OS.',
    icon: 'computer',
    parentClassId: CLASS_IDS.cmdb_ci_hardware,
    isAbstract: false,
    sortOrder: 20,
    fieldsSchema: COMPUTER_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_server,
    name: 'cmdb_ci_server',
    label: 'Server',
    description:
      'Production, staging, or development server (physical or virtual).',
    icon: 'dns',
    parentClassId: CLASS_IDS.cmdb_ci_computer,
    isAbstract: false,
    sortOrder: 30,
    fieldsSchema: SERVER_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_linux_server,
    name: 'cmdb_ci_linux_server',
    label: 'Linux Server',
    description: 'Linux-based server with distribution-specific fields.',
    icon: 'terminal',
    parentClassId: CLASS_IDS.cmdb_ci_server,
    isAbstract: false,
    sortOrder: 40,
    fieldsSchema: LINUX_SERVER_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_win_server,
    name: 'cmdb_ci_win_server',
    label: 'Windows Server',
    description: 'Windows Server with domain and version-specific fields.',
    icon: 'desktop_windows',
    parentClassId: CLASS_IDS.cmdb_ci_server,
    isAbstract: false,
    sortOrder: 41,
    fieldsSchema: WINDOWS_SERVER_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_virtual_machine,
    name: 'cmdb_ci_virtual_machine',
    label: 'Virtual Machine',
    description:
      'Virtual machine instance running on a hypervisor or cloud platform.',
    icon: 'cloud_queue',
    parentClassId: CLASS_IDS.cmdb_ci_computer,
    isAbstract: false,
    sortOrder: 42,
    fieldsSchema: VIRTUAL_MACHINE_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_network_device,
    name: 'cmdb_ci_network_device',
    label: 'Network Device',
    description:
      'Router, switch, firewall, load balancer, or other network equipment.',
    icon: 'router',
    parentClassId: CLASS_IDS.cmdb_ci_hardware,
    isAbstract: false,
    sortOrder: 50,
    fieldsSchema: NETWORK_DEVICE_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_firewall,
    name: 'cmdb_ci_firewall',
    label: 'Firewall',
    description: 'Network firewall or web application firewall (WAF) device.',
    icon: 'security',
    parentClassId: CLASS_IDS.cmdb_ci_network_device,
    isAbstract: false,
    sortOrder: 51,
    fieldsSchema: FIREWALL_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_load_balancer,
    name: 'cmdb_ci_load_balancer',
    label: 'Load Balancer',
    description: 'Application or network load balancer (hardware or virtual).',
    icon: 'balance',
    parentClassId: CLASS_IDS.cmdb_ci_network_device,
    isAbstract: false,
    sortOrder: 52,
    fieldsSchema: LOAD_BALANCER_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_router,
    name: 'cmdb_ci_router',
    label: 'Router',
    description: 'Network router for directing traffic between networks.',
    icon: 'router',
    parentClassId: CLASS_IDS.cmdb_ci_network_device,
    isAbstract: false,
    sortOrder: 53,
    fieldsSchema: ROUTER_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_switch,
    name: 'cmdb_ci_switch',
    label: 'Switch',
    description:
      'Network switch for connecting devices within a network segment.',
    icon: 'device_hub',
    parentClassId: CLASS_IDS.cmdb_ci_network_device,
    isAbstract: false,
    sortOrder: 54,
    fieldsSchema: SWITCH_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_storage,
    name: 'cmdb_ci_storage',
    label: 'Storage',
    description: 'SAN, NAS, or cloud storage device/array.',
    icon: 'sd_storage',
    parentClassId: CLASS_IDS.cmdb_ci_hardware,
    isAbstract: false,
    sortOrder: 60,
    fieldsSchema: STORAGE_FIELDS,
  },

  // ========================================================================
  // Application subtree
  // ========================================================================
  {
    id: CLASS_IDS.cmdb_ci_application,
    name: 'cmdb_ci_application',
    label: 'Application',
    description:
      'Abstract class for software applications, services, and microservices.',
    icon: 'apps',
    parentClassId: CLASS_IDS.cmdb_ci,
    isAbstract: true,
    sortOrder: 70,
    fieldsSchema: APPLICATION_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_business_app,
    name: 'cmdb_ci_business_app',
    label: 'Business Application',
    description:
      'Business-facing application with ownership and lifecycle management.',
    icon: 'business',
    parentClassId: CLASS_IDS.cmdb_ci_application,
    isAbstract: false,
    sortOrder: 71,
    fieldsSchema: BUSINESS_APP_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_web_application,
    name: 'cmdb_ci_web_application',
    label: 'Web Application',
    description:
      'Internet or intranet-facing web application (SPA, portal, etc.).',
    icon: 'language',
    parentClassId: CLASS_IDS.cmdb_ci_application,
    isAbstract: false,
    sortOrder: 72,
    fieldsSchema: WEB_APPLICATION_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_app_service,
    name: 'cmdb_ci_app_service',
    label: 'Application Service',
    description: 'Backend microservice, API service, or middleware component.',
    icon: 'api',
    parentClassId: CLASS_IDS.cmdb_ci_application,
    isAbstract: false,
    sortOrder: 73,
    fieldsSchema: APP_SERVICE_FIELDS,
  },

  // ========================================================================
  // Database subtree
  // ========================================================================
  {
    id: CLASS_IDS.cmdb_ci_database,
    name: 'cmdb_ci_database',
    label: 'Database',
    description: 'Database engine or logical database.',
    icon: 'storage',
    parentClassId: CLASS_IDS.cmdb_ci,
    isAbstract: false,
    sortOrder: 80,
    fieldsSchema: DATABASE_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_db_instance,
    name: 'cmdb_ci_db_instance',
    label: 'Database Instance',
    description:
      'Specific database instance (schema/catalog) running on a database engine.',
    icon: 'table_chart',
    parentClassId: CLASS_IDS.cmdb_ci_database,
    isAbstract: false,
    sortOrder: 81,
    fieldsSchema: DB_INSTANCE_FIELDS,
  },

  // ========================================================================
  // Service subtree
  // ========================================================================
  {
    id: CLASS_IDS.cmdb_ci_service,
    name: 'cmdb_ci_service',
    label: 'Service',
    description:
      'Abstract class for CI-backed services visible in the service catalog.',
    icon: 'miscellaneous_services',
    parentClassId: CLASS_IDS.cmdb_ci,
    isAbstract: true,
    sortOrder: 90,
    fieldsSchema: SERVICE_FIELDS,
  },
  {
    id: CLASS_IDS.cmdb_ci_service_offering,
    name: 'cmdb_ci_service_offering',
    label: 'Service Offering',
    description:
      'A specific offering/tier of a service (e.g., Standard vs. Premium).',
    icon: 'sell',
    parentClassId: CLASS_IDS.cmdb_ci_service,
    isAbstract: false,
    sortOrder: 91,
    fieldsSchema: SERVICE_OFFERING_FIELDS,
  },
];
