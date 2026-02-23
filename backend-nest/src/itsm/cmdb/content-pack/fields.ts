/**
 * CMDB Baseline Content Pack v1 — Field Definitions
 *
 * Defines the default fieldsSchema for each baseline CI class.
 * Fields use inheritance: child classes inherit parent fields automatically
 * via the effective schema resolution engine.
 *
 * Field naming conventions:
 * - snake_case keys
 * - Human-readable labels
 * - Grouped by functional area
 * - Ordered for logical form layout
 */

import { CiClassFieldDefinition } from '../ci-class/ci-class.entity';

// ============================================================================
// C1. Root / Common Fields (cmdb_ci)
// ============================================================================

export const ROOT_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'name',
    label: 'Name',
    dataType: 'string',
    required: true,
    maxLength: 255,
    order: 1,
    group: 'General',
    helpText: 'Primary display name for this configuration item.',
  },
  {
    key: 'status',
    label: 'Status',
    dataType: 'enum',
    choices: [
      'INSTALLED',
      'ACTIVE',
      'MAINTENANCE',
      'RETIRED',
      'DECOMMISSIONED',
    ],
    defaultValue: 'ACTIVE',
    order: 2,
    group: 'General',
    helpText: 'Current lifecycle status of the CI.',
  },
  {
    key: 'operational_status',
    label: 'Operational Status',
    dataType: 'enum',
    choices: ['OPERATIONAL', 'NON_OPERATIONAL', 'MAINTENANCE', 'RETIRED'],
    defaultValue: 'OPERATIONAL',
    order: 3,
    group: 'General',
    helpText: 'Real-time operational state of the CI.',
  },
  {
    key: 'environment',
    label: 'Environment',
    dataType: 'enum',
    choices: ['PRODUCTION', 'STAGING', 'UAT', 'TEST', 'DEVELOPMENT', 'DR'],
    order: 4,
    group: 'General',
    helpText: 'Deployment environment (DEV/TEST/UAT/PROD/DR).',
  },
  {
    key: 'criticality',
    label: 'Criticality',
    dataType: 'enum',
    choices: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    order: 5,
    group: 'General',
    helpText: 'Business criticality level.',
  },
  {
    key: 'description',
    label: 'Description',
    dataType: 'text',
    order: 6,
    group: 'General',
    helpText: 'Free-text description of the CI.',
  },
  {
    key: 'owner_group',
    label: 'Owner Group',
    dataType: 'string',
    order: 10,
    group: 'Ownership',
    helpText: 'Team or group responsible for this CI.',
  },
  {
    key: 'support_group',
    label: 'Support Group',
    dataType: 'string',
    order: 11,
    group: 'Ownership',
    helpText: 'Team or group providing operational support.',
  },
  {
    key: 'assigned_to',
    label: 'Assigned To',
    dataType: 'string',
    order: 12,
    group: 'Ownership',
    helpText: 'Individual assigned to manage this CI.',
  },
  {
    key: 'location',
    label: 'Location',
    dataType: 'string',
    order: 15,
    group: 'Location',
    helpText: 'Physical or logical location (data center, region, rack).',
  },
  {
    key: 'vendor',
    label: 'Vendor',
    dataType: 'string',
    order: 20,
    group: 'Asset',
    helpText: 'Vendor or manufacturer name.',
  },
  {
    key: 'model',
    label: 'Model',
    dataType: 'string',
    order: 21,
    group: 'Asset',
    helpText: 'Product model or SKU.',
  },
  {
    key: 'serial_number',
    label: 'Serial Number',
    dataType: 'string',
    order: 22,
    group: 'Asset',
    helpText: 'Manufacturer serial number.',
  },
  {
    key: 'asset_tag',
    label: 'Asset Tag',
    dataType: 'string',
    order: 23,
    group: 'Asset',
    helpText: 'Internal asset tracking tag.',
  },
  {
    key: 'source',
    label: 'Source',
    dataType: 'string',
    order: 30,
    group: 'Discovery',
    helpText:
      'Discovery source or import origin (e.g., manual, ServiceNow, AWS).',
  },
  {
    key: 'source_native_id',
    label: 'Source Native ID',
    dataType: 'string',
    order: 31,
    group: 'Discovery',
    helpText: 'Unique identifier in the source system.',
  },
  {
    key: 'last_discovered_at',
    label: 'Last Discovered At',
    dataType: 'date',
    order: 32,
    group: 'Discovery',
    helpText: 'Timestamp of the last successful discovery scan.',
  },
  {
    key: 'tags',
    label: 'Tags',
    dataType: 'json',
    order: 40,
    group: 'Metadata',
    helpText: 'Free-form tags for categorization (JSON array).',
  },
];

// ============================================================================
// C2. Hardware Fields (cmdb_ci_hardware — abstract)
// ============================================================================

export const HARDWARE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    dataType: 'string',
    order: 50,
    group: 'Hardware',
    helpText: 'Hardware manufacturer (e.g., Dell, HP, Cisco).',
  },
  {
    key: 'model_number',
    label: 'Model Number',
    dataType: 'string',
    order: 51,
    group: 'Hardware',
    helpText: 'Specific hardware model number.',
  },
  {
    key: 'warranty_expiry',
    label: 'Warranty Expiry',
    dataType: 'date',
    order: 52,
    group: 'Hardware',
    helpText: 'Hardware warranty expiration date.',
  },
];

// ============================================================================
// Computer Fields (cmdb_ci_computer)
// ============================================================================

export const COMPUTER_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'hostname',
    label: 'Hostname',
    dataType: 'string',
    order: 60,
    group: 'Compute',
    helpText: 'Short hostname of the computer.',
  },
  {
    key: 'fqdn',
    label: 'FQDN',
    dataType: 'string',
    order: 61,
    group: 'Compute',
    helpText: 'Fully qualified domain name.',
  },
  {
    key: 'ip_address',
    label: 'IP Address',
    dataType: 'string',
    order: 62,
    group: 'Network',
    helpText: 'Primary IP address.',
  },
  {
    key: 'os_name',
    label: 'OS Name',
    dataType: 'enum',
    choices: ['WINDOWS', 'LINUX', 'MACOS', 'UNIX', 'OTHER'],
    order: 63,
    group: 'Compute',
    helpText: 'Operating system name.',
  },
  {
    key: 'os_version',
    label: 'OS Version',
    dataType: 'string',
    order: 64,
    group: 'Compute',
    helpText: 'Operating system version string.',
  },
  {
    key: 'cpu_cores',
    label: 'CPU Cores',
    dataType: 'number',
    order: 65,
    group: 'Compute',
    helpText: 'Number of CPU cores (logical).',
  },
  {
    key: 'memory_gb',
    label: 'Memory (GB)',
    dataType: 'number',
    order: 66,
    group: 'Compute',
    helpText: 'Total RAM in gigabytes.',
  },
  {
    key: 'disk_gb',
    label: 'Disk (GB)',
    dataType: 'number',
    order: 67,
    group: 'Compute',
    helpText: 'Total disk capacity in gigabytes.',
  },
];

// ============================================================================
// Server Fields (cmdb_ci_server)
// ============================================================================

export const SERVER_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'server_role',
    label: 'Server Role',
    dataType: 'enum',
    choices: ['WEB', 'APP', 'DB', 'CACHE', 'PROXY', 'BATCH', 'OTHER'],
    order: 70,
    group: 'Server',
    helpText: 'Primary role of the server.',
  },
  {
    key: 'is_virtual',
    label: 'Is Virtual',
    dataType: 'boolean',
    defaultValue: false,
    order: 71,
    group: 'Server',
    helpText: 'Whether this is a virtual server.',
  },
  {
    key: 'cluster_name',
    label: 'Cluster Name',
    dataType: 'string',
    order: 72,
    group: 'Server',
    helpText: 'Name of the cluster this server belongs to.',
  },
  {
    key: 'patch_level',
    label: 'Patch Level',
    dataType: 'string',
    order: 73,
    group: 'Server',
    helpText: 'Current OS/firmware patch level.',
  },
  {
    key: 'backup_enabled',
    label: 'Backup Enabled',
    dataType: 'boolean',
    defaultValue: false,
    order: 74,
    group: 'Server',
    helpText: 'Whether automatic backups are enabled.',
  },
];

// ============================================================================
// Linux Server Fields (cmdb_ci_linux_server)
// ============================================================================

export const LINUX_SERVER_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'distro',
    label: 'Distribution',
    dataType: 'enum',
    choices: ['UBUNTU', 'RHEL', 'CENTOS', 'DEBIAN', 'ALPINE', 'SUSE', 'OTHER'],
    order: 80,
    group: 'Linux',
    helpText: 'Linux distribution.',
  },
  {
    key: 'kernel_version',
    label: 'Kernel Version',
    dataType: 'string',
    order: 81,
    group: 'Linux',
    helpText: 'Linux kernel version string.',
  },
  // Override: lock os_name to LINUX
  {
    key: 'os_name',
    label: 'OS Name',
    dataType: 'enum',
    choices: ['LINUX'],
    readOnly: true,
    defaultValue: 'LINUX',
    order: 63,
    group: 'Compute',
  },
];

// ============================================================================
// Windows Server Fields (cmdb_ci_win_server)
// ============================================================================

export const WINDOWS_SERVER_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'windows_version',
    label: 'Windows Version',
    dataType: 'enum',
    choices: ['2016', '2019', '2022', '2025'],
    order: 80,
    group: 'Windows',
    helpText: 'Windows Server edition/year.',
  },
  {
    key: 'domain_joined',
    label: 'Domain Joined',
    dataType: 'boolean',
    defaultValue: false,
    order: 81,
    group: 'Windows',
    helpText: 'Whether the server is joined to an Active Directory domain.',
  },
  // Override: lock os_name to WINDOWS
  {
    key: 'os_name',
    label: 'OS Name',
    dataType: 'enum',
    choices: ['WINDOWS'],
    readOnly: true,
    defaultValue: 'WINDOWS',
    order: 63,
    group: 'Compute',
  },
];

// ============================================================================
// Virtual Machine Fields (cmdb_ci_virtual_machine)
// ============================================================================

export const VIRTUAL_MACHINE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'virtualization_type',
    label: 'Virtualization Type',
    dataType: 'enum',
    choices: ['VMWARE', 'HYPER_V', 'KVM', 'XEN', 'DOCKER', 'LXC', 'OTHER'],
    order: 80,
    group: 'Virtualization',
    helpText: 'Hypervisor or virtualization platform type.',
  },
  {
    key: 'hypervisor_host',
    label: 'Hypervisor Host',
    dataType: 'string',
    order: 81,
    group: 'Virtualization',
    helpText: 'Name or IP of the hypervisor host.',
  },
  {
    key: 'vm_tools_version',
    label: 'VM Tools Version',
    dataType: 'string',
    order: 82,
    group: 'Virtualization',
    helpText: 'Guest agent / VM tools version.',
  },
];

// ============================================================================
// C3. Network Device Fields (cmdb_ci_network_device)
// ============================================================================

export const NETWORK_DEVICE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'management_ip',
    label: 'Management IP',
    dataType: 'string',
    order: 60,
    group: 'Network',
    helpText: 'Out-of-band management IP address.',
  },
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
      'OTHER',
    ],
    order: 61,
    group: 'Network',
    helpText: 'Category of network device.',
  },
  {
    key: 'firmware_version',
    label: 'Firmware Version',
    dataType: 'string',
    order: 62,
    group: 'Network',
    helpText: 'Current firmware or IOS version.',
  },
  {
    key: 'port_count',
    label: 'Port Count',
    dataType: 'number',
    order: 63,
    group: 'Network',
    helpText: 'Total number of physical ports.',
  },
  {
    key: 'rack_position',
    label: 'Rack Position',
    dataType: 'string',
    order: 64,
    group: 'Network',
    helpText: 'Position within the data center rack (e.g., U12-U14).',
  },
  {
    key: 'network_zone',
    label: 'Network Zone',
    dataType: 'enum',
    choices: ['DMZ', 'INTERNAL', 'EXTERNAL', 'MANAGEMENT', 'OTHER'],
    order: 65,
    group: 'Network',
    helpText: 'Logical network zone.',
  },
];

// Firewall-specific fields
export const FIREWALL_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'firewall_mode',
    label: 'Firewall Mode',
    dataType: 'enum',
    choices: ['ROUTED', 'TRANSPARENT', 'MIXED'],
    order: 80,
    group: 'Firewall',
    helpText: 'Operating mode of the firewall.',
  },
  {
    key: 'policy_count',
    label: 'Policy Count',
    dataType: 'number',
    order: 81,
    group: 'Firewall',
    helpText: 'Number of active firewall policies/rules.',
  },
  // Override device_type to FIREWALL
  {
    key: 'device_type',
    label: 'Device Type',
    dataType: 'enum',
    choices: ['FIREWALL'],
    readOnly: true,
    defaultValue: 'FIREWALL',
    order: 61,
    group: 'Network',
  },
];

// Load Balancer-specific fields
export const LOAD_BALANCER_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'lb_algorithm',
    label: 'LB Algorithm',
    dataType: 'enum',
    choices: [
      'ROUND_ROBIN',
      'LEAST_CONNECTIONS',
      'IP_HASH',
      'WEIGHTED',
      'OTHER',
    ],
    order: 80,
    group: 'Load Balancer',
    helpText: 'Load balancing algorithm.',
  },
  {
    key: 'vip_count',
    label: 'VIP Count',
    dataType: 'number',
    order: 81,
    group: 'Load Balancer',
    helpText: 'Number of virtual IP addresses configured.',
  },
  // Override device_type to LOAD_BALANCER
  {
    key: 'device_type',
    label: 'Device Type',
    dataType: 'enum',
    choices: ['LOAD_BALANCER'],
    readOnly: true,
    defaultValue: 'LOAD_BALANCER',
    order: 61,
    group: 'Network',
  },
];

// Storage-specific fields
export const STORAGE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'storage_type',
    label: 'Storage Type',
    dataType: 'enum',
    choices: ['SAN', 'NAS', 'OBJECT', 'BLOCK', 'FILE', 'OTHER'],
    order: 60,
    group: 'Storage',
    helpText: 'Type of storage system.',
  },
  {
    key: 'total_capacity_tb',
    label: 'Total Capacity (TB)',
    dataType: 'number',
    order: 61,
    group: 'Storage',
    helpText: 'Total raw capacity in terabytes.',
  },
  {
    key: 'used_capacity_tb',
    label: 'Used Capacity (TB)',
    dataType: 'number',
    order: 62,
    group: 'Storage',
    helpText: 'Currently used capacity in terabytes.',
  },
  {
    key: 'raid_level',
    label: 'RAID Level',
    dataType: 'enum',
    choices: ['RAID0', 'RAID1', 'RAID5', 'RAID6', 'RAID10', 'NONE', 'OTHER'],
    order: 63,
    group: 'Storage',
    helpText: 'RAID configuration level.',
  },
  {
    key: 'replication_enabled',
    label: 'Replication Enabled',
    dataType: 'boolean',
    defaultValue: false,
    order: 64,
    group: 'Storage',
    helpText: 'Whether cross-site replication is enabled.',
  },
];

// ============================================================================
// C5. Application Fields (cmdb_ci_application — abstract)
// ============================================================================

export const APPLICATION_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'app_code',
    label: 'Application Code',
    dataType: 'string',
    order: 60,
    group: 'Application',
    helpText: 'Short unique application code (e.g., GRC, ERP, CRM).',
  },
  {
    key: 'version',
    label: 'Version',
    dataType: 'string',
    order: 61,
    group: 'Application',
    helpText: 'Current deployed version.',
  },
  {
    key: 'tech_stack',
    label: 'Technology Stack',
    dataType: 'string',
    order: 62,
    group: 'Application',
    helpText: 'Primary technologies (e.g., NestJS, React, PostgreSQL).',
  },
  {
    key: 'url',
    label: 'URL',
    dataType: 'string',
    order: 63,
    group: 'Application',
    helpText: 'Primary URL or endpoint.',
  },
  {
    key: 'lifecycle_stage',
    label: 'Lifecycle Stage',
    dataType: 'enum',
    choices: [
      'PLANNING',
      'DEVELOPMENT',
      'TESTING',
      'PRODUCTION',
      'SUNSET',
      'RETIRED',
    ],
    order: 64,
    group: 'Application',
    helpText: 'Current application lifecycle stage.',
  },
  {
    key: 'internet_facing',
    label: 'Internet Facing',
    dataType: 'boolean',
    defaultValue: false,
    order: 65,
    group: 'Application',
    helpText: 'Whether the application is exposed to the internet.',
  },
  {
    key: 'tier',
    label: 'Tier',
    dataType: 'enum',
    choices: ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'],
    order: 66,
    group: 'Application',
    helpText: 'Application tier for SLA/support classification.',
  },
];

// Business Application-specific fields
export const BUSINESS_APP_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'business_owner',
    label: 'Business Owner',
    dataType: 'string',
    order: 80,
    group: 'Business',
    helpText: 'Business sponsor or product owner.',
  },
  {
    key: 'technical_owner',
    label: 'Technical Owner',
    dataType: 'string',
    order: 81,
    group: 'Business',
    helpText: 'Technical lead or engineering owner.',
  },
  {
    key: 'data_classification',
    label: 'Data Classification',
    dataType: 'enum',
    choices: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    order: 82,
    group: 'Business',
    helpText: 'Data classification level for compliance.',
  },
  {
    key: 'support_model',
    label: 'Support Model',
    dataType: 'enum',
    choices: ['INTERNAL', 'VENDOR', 'MANAGED_SERVICE', 'HYBRID'],
    order: 83,
    group: 'Business',
    helpText: 'Support delivery model.',
  },
];

// Web Application-specific fields
export const WEB_APPLICATION_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'public_url',
    label: 'Public URL',
    dataType: 'string',
    order: 80,
    group: 'Web',
    helpText: 'Public-facing URL of the web application.',
  },
  {
    key: 'ssl_expiry',
    label: 'SSL Certificate Expiry',
    dataType: 'date',
    order: 81,
    group: 'Web',
    helpText: 'SSL/TLS certificate expiration date.',
  },
  {
    key: 'cdn_enabled',
    label: 'CDN Enabled',
    dataType: 'boolean',
    defaultValue: false,
    order: 82,
    group: 'Web',
    helpText: 'Whether a CDN is configured for this application.',
  },
];

// Application Service-specific fields
export const APP_SERVICE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'api_endpoint',
    label: 'API Endpoint',
    dataType: 'string',
    order: 80,
    group: 'Service',
    helpText: 'Primary API endpoint URL.',
  },
  {
    key: 'protocol',
    label: 'Protocol',
    dataType: 'enum',
    choices: ['REST', 'GRAPHQL', 'GRPC', 'SOAP', 'WEBSOCKET', 'OTHER'],
    order: 81,
    group: 'Service',
    helpText: 'Communication protocol.',
  },
  {
    key: 'auth_method',
    label: 'Auth Method',
    dataType: 'enum',
    choices: ['JWT', 'OAUTH2', 'API_KEY', 'MTLS', 'BASIC', 'NONE'],
    order: 82,
    group: 'Service',
    helpText: 'Authentication method used.',
  },
];

// ============================================================================
// C4. Database Fields (cmdb_ci_database)
// ============================================================================

export const DATABASE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'db_engine',
    label: 'Database Engine',
    dataType: 'enum',
    choices: [
      'POSTGRESQL',
      'MYSQL',
      'MARIADB',
      'MSSQL',
      'ORACLE',
      'MONGODB',
      'REDIS',
      'ELASTICSEARCH',
      'CASSANDRA',
      'OTHER',
    ],
    order: 60,
    group: 'Database',
    helpText: 'Database engine/platform.',
  },
  {
    key: 'db_version',
    label: 'DB Version',
    dataType: 'string',
    order: 61,
    group: 'Database',
    helpText: 'Database engine version.',
  },
  {
    key: 'port',
    label: 'Port',
    dataType: 'number',
    order: 62,
    group: 'Database',
    helpText: 'Listening port number.',
  },
  {
    key: 'ha_enabled',
    label: 'HA Enabled',
    dataType: 'boolean',
    defaultValue: false,
    order: 63,
    group: 'Database',
    helpText: 'Whether high-availability clustering is enabled.',
  },
  {
    key: 'backup_policy',
    label: 'Backup Policy',
    dataType: 'enum',
    choices: ['DAILY', 'HOURLY', 'CONTINUOUS', 'WEEKLY', 'NONE'],
    order: 64,
    group: 'Database',
    helpText: 'Database backup frequency policy.',
  },
  {
    key: 'storage_tier',
    label: 'Storage Tier',
    dataType: 'enum',
    choices: ['SSD', 'HDD', 'NVME', 'CLOUD', 'OTHER'],
    order: 65,
    group: 'Database',
    helpText: 'Underlying storage tier.',
  },
];

// Database Instance-specific fields
export const DB_INSTANCE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'instance_name',
    label: 'Instance Name',
    dataType: 'string',
    order: 80,
    group: 'Instance',
    helpText: 'Database instance/schema name.',
  },
  {
    key: 'instance_port',
    label: 'Instance Port',
    dataType: 'number',
    order: 81,
    group: 'Instance',
    helpText:
      'Port for this specific instance (if different from engine default).',
  },
  {
    key: 'is_replica',
    label: 'Is Replica',
    dataType: 'boolean',
    defaultValue: false,
    order: 82,
    group: 'Instance',
    helpText: 'Whether this instance is a read replica.',
  },
  {
    key: 'max_connections',
    label: 'Max Connections',
    dataType: 'number',
    order: 83,
    group: 'Instance',
    helpText: 'Maximum allowed concurrent connections.',
  },
];

// ============================================================================
// C6. Service Fields (cmdb_ci_service — abstract)
// ============================================================================

export const SERVICE_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'service_owner',
    label: 'Service Owner',
    dataType: 'string',
    order: 60,
    group: 'Service',
    helpText: 'Person or team owning this service.',
  },
  {
    key: 'service_tier',
    label: 'Service Tier',
    dataType: 'enum',
    choices: ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'],
    order: 61,
    group: 'Service',
    helpText: 'SLA tier for this service.',
  },
  {
    key: 'availability_target',
    label: 'Availability Target (%)',
    dataType: 'number',
    order: 62,
    group: 'Service',
    helpText: 'Target availability percentage (e.g., 99.9).',
  },
  {
    key: 'support_hours',
    label: 'Support Hours',
    dataType: 'enum',
    choices: ['24X7', 'BUSINESS_HOURS', 'EXTENDED', 'BEST_EFFORT'],
    order: 63,
    group: 'Service',
    helpText: 'Support coverage hours.',
  },
  {
    key: 'customer_impact_level',
    label: 'Customer Impact Level',
    dataType: 'enum',
    choices: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'],
    order: 64,
    group: 'Service',
    helpText: 'Impact level if this service is degraded or unavailable.',
  },
  {
    key: 'rto',
    label: 'RTO (hours)',
    dataType: 'number',
    order: 65,
    group: 'BCM',
    helpText: 'Recovery Time Objective in hours.',
  },
  {
    key: 'rpo',
    label: 'RPO (hours)',
    dataType: 'number',
    order: 66,
    group: 'BCM',
    helpText: 'Recovery Point Objective in hours.',
  },
];

// Service Offering-specific fields
export const SERVICE_OFFERING_FIELDS: CiClassFieldDefinition[] = [
  {
    key: 'offering_name',
    label: 'Offering Name',
    dataType: 'string',
    order: 80,
    group: 'Offering',
    helpText:
      'Name of the specific service offering (e.g., Standard, Premium).',
  },
  {
    key: 'pricing_model',
    label: 'Pricing Model',
    dataType: 'enum',
    choices: [
      'SUBSCRIPTION',
      'PER_USER',
      'PER_TRANSACTION',
      'FLAT_RATE',
      'FREE',
    ],
    order: 81,
    group: 'Offering',
    helpText: 'Pricing model for this offering.',
  },
  {
    key: 'catalog_visible',
    label: 'Catalog Visible',
    dataType: 'boolean',
    defaultValue: true,
    order: 82,
    group: 'Offering',
    helpText: 'Whether this offering is visible in the service catalog.',
  },
];
