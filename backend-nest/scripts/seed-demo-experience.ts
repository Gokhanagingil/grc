#!/usr/bin/env ts-node
/**
 * GRC Demo Experience Seed
 * 
 * Creates a comprehensive, interconnected demo environment for the GRC platform
 * centered around "Polaris Telekom A.Ş." scenario.
 * 
 * This seed script creates:
 * - Users
 * - Entities (Company, Departments, Systems, Data Centers, Vendors)
 * - Standards + Clauses
 * - Controls (all 37+ controls with relationships)
 * - Policies (10 policies with relationships)
 * - Risks + Risk Instances (16 risks, 10 instances with full relationships)
 * - Audits (2 plans, 3 engagements, 5 findings, 5 CAPs)
 * - BCM (6 BIA processes, 3 BCP plans)
 * - Calendar Events
 * - Capacity
 * - Dictionaries
 * - Requirements
 * - Role Permissions
 * - GRC Entity Lifecycle
 * 
 * All data is interconnected to demonstrate complete GRC workflows.
 * 
 * Usage: npm run seed:demo-experience
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';
import { EntityTypeEntity } from '../src/entities/app/entity-type.entity';
import { EntityEntity } from '../src/entities/app/entity.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { ControlLibraryEntity } from '../src/entities/app/control-library.entity';
import { ControlToClauseEntity } from '../src/entities/app/control-to-clause.entity';
import { ControlToPolicyEntity } from '../src/entities/app/control-to-policy.entity';
import { ControlToCapEntity } from '../src/entities/app/control-to-cap.entity';
import { PolicyEntity } from '../src/entities/app/policy.entity';
import { PolicyStandardEntity } from '../src/entities/app/policy-standard.entity';
import { RiskCategoryEntity } from '../src/entities/app/risk-category.entity';
import { RiskCatalogEntity } from '../src/entities/app/risk-catalog.entity';
import { RiskCatalogAttachmentEntity } from '../src/entities/app/risk-catalog-attachment.entity';
import { RiskInstanceEntity, RiskStatus, EntityType } from '../src/entities/app/risk-instance.entity';
import { RiskInstanceAttachmentEntity } from '../src/entities/app/risk-instance-attachment.entity';
import { RiskToControlEntity } from '../src/entities/app/risk-to-control.entity';
import { RiskToPolicyEntity } from '../src/entities/app/risk-to-policy.entity';
import { RiskToRequirementEntity } from '../src/entities/app/risk-to-requirement.entity';
import { RequirementEntity } from '../src/modules/compliance/comp.entity';
import { RegulationEntity } from '../src/entities/app/regulation.entity';
import { AuditPlanEntity, AuditPlanStatus } from '../src/entities/app/audit-plan.entity';
import { AuditEngagementEntity, AuditEngagementStatus } from '../src/entities/app/audit-engagement.entity';
import { AuditTestEntity } from '../src/entities/app/audit-test.entity';
import { AuditEvidenceEntity } from '../src/entities/app/audit-evidence.entity';
import { AuditFindingEntity, AuditFindingSeverity, AuditFindingStatus } from '../src/entities/app/audit-finding.entity';
import { CorrectiveActionEntity, CorrectiveActionStatus } from '../src/entities/app/corrective-action.entity';
import { BIAProcessEntity } from '../src/entities/app/bia-process.entity';
import { BIAProcessDependencyEntity } from '../src/entities/app/bia-process-dependency.entity';
import { BCPPlanEntity, BCPPlanStatus } from '../src/entities/app/bcp-plan.entity';
import { BCPExerciseEntity } from '../src/entities/app/bcp-exercise.entity';
import { CalendarEventEntity } from '../src/entities/app/calendar-event.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// ============================================================================
// POLARIS TELEKOM A.Ş. - DEMO SCENARIO DATA
// ============================================================================

// Polaris Telekom Logo (Base64 placeholder - can be replaced with actual logo)
const POLARIS_LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzAwNTVmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+UE9MQVJJUzwvdGV4dD48L3N2Zz4=';

// ============================================================================
// ENTITIES - Polaris Telekom Structure
// ============================================================================

const polarisEntities = {
  // 1 Company
  company: {
    code: 'ENT-POLARIS',
    name: 'Polaris Telekom A.Ş.',
    entityTypeCode: 'COMPANY',
    description: 'Leading telecommunications company providing mobile, fixed-line, and internet services',
    attributes: {
      industry: 'Telecommunications',
      founded: '1995',
      employees: '5000+',
      logo: POLARIS_LOGO_BASE64,
    },
  },
  
  // 4 Departments
  departments: [
    {
      code: 'DEPT-IT',
      name: 'IT Operations',
      entityTypeCode: 'DEPARTMENT',
      description: 'Information Technology Operations Department',
      attributes: { head: 'Mehmet Yılmaz', location: 'Istanbul HQ' },
    },
    {
      code: 'DEPT-SECURITY',
      name: 'Information Security',
      entityTypeCode: 'DEPARTMENT',
      description: 'Information Security and Risk Management',
      attributes: { head: 'Ayşe Demir', location: 'Istanbul HQ' },
    },
    {
      code: 'DEPT-NETWORK',
      name: 'Network Operations',
      entityTypeCode: 'DEPARTMENT',
      description: 'Network Infrastructure and Operations',
      attributes: { head: 'Ali Kaya', location: 'Ankara DC' },
    },
    {
      code: 'DEPT-COMPLIANCE',
      name: 'Compliance & Audit',
      entityTypeCode: 'DEPARTMENT',
      description: 'Compliance, Audit, and Governance',
      attributes: { head: 'Fatma Şahin', location: 'Istanbul HQ' },
    },
  ],
  
  // 12 Systems
  systems: [
    {
      code: 'SYS-CORE-NETWORK',
      name: 'Core Network Management System',
      entityTypeCode: 'APPLICATION',
      description: 'Core network infrastructure management and monitoring',
      attributes: { vendor: 'Huawei', version: 'v8.2', criticality: 'Critical' },
    },
    {
      code: 'SYS-BILLING',
      name: 'Billing & Revenue Management',
      entityTypeCode: 'APPLICATION',
      description: 'Customer billing and revenue management system',
      attributes: { vendor: 'Oracle', version: 'v12.5', criticality: 'Critical' },
    },
    {
      code: 'SYS-CRM',
      name: 'Customer Relationship Management',
      entityTypeCode: 'APPLICATION',
      description: 'Customer service and relationship management',
      attributes: { vendor: 'Salesforce', version: '2024.1', criticality: 'High' },
    },
    {
      code: 'SYS-SELF-SERVICE',
      name: 'Customer Self-Service Portal',
      entityTypeCode: 'APPLICATION',
      description: 'Online customer portal for self-service operations',
      attributes: { vendor: 'Internal', version: 'v3.0', criticality: 'High' },
    },
    {
      code: 'SYS-PROVISIONING',
      name: 'Service Provisioning System',
      entityTypeCode: 'APPLICATION',
      description: 'Automated service provisioning and activation',
      attributes: { vendor: 'Ericsson', version: 'v6.1', criticality: 'Critical' },
    },
    {
      code: 'SYS-FRAUD',
      name: 'Fraud Detection System',
      entityTypeCode: 'APPLICATION',
      description: 'Real-time fraud detection and prevention',
      attributes: { vendor: 'IBM', version: 'v4.3', criticality: 'High' },
    },
    {
      code: 'SYS-OSS',
      name: 'Operations Support System',
      entityTypeCode: 'APPLICATION',
      description: 'Network operations and service management',
      attributes: { vendor: 'Nokia', version: 'v7.0', criticality: 'Critical' },
    },
    {
      code: 'SYS-MEDIA',
      name: 'Media Content Platform',
      entityTypeCode: 'APPLICATION',
      description: 'Streaming and media content delivery',
      attributes: { vendor: 'Akamai', version: 'v2.5', criticality: 'Medium' },
    },
    {
      code: 'SYS-ERP',
      name: 'Enterprise Resource Planning',
      entityTypeCode: 'APPLICATION',
      description: 'Financial and resource management',
      attributes: { vendor: 'SAP', version: 'S/4HANA 2023', criticality: 'High' },
    },
    {
      code: 'SYS-HRMS',
      name: 'Human Resources Management',
      entityTypeCode: 'APPLICATION',
      description: 'HR management and payroll system',
      attributes: { vendor: 'Workday', version: '2024.1', criticality: 'Medium' },
    },
    {
      code: 'SYS-ANALYTICS',
      name: 'Business Analytics Platform',
      entityTypeCode: 'APPLICATION',
      description: 'Data analytics and business intelligence',
      attributes: { vendor: 'Tableau', version: '2024.1', criticality: 'Medium' },
    },
    {
      code: 'SYS-MONITORING',
      name: 'Infrastructure Monitoring',
      entityTypeCode: 'APPLICATION',
      description: 'IT infrastructure monitoring and alerting',
      attributes: { vendor: 'Datadog', version: 'v2.0', criticality: 'High' },
    },
  ],
  
  // 3 Data Centers
  dataCenters: [
    {
      code: 'DC-ISTANBUL-PRIMARY',
      name: 'Istanbul Primary Data Center',
      entityTypeCode: 'FACILITY',
      description: 'Primary data center in Istanbul',
      attributes: { tier: 'Tier 3', capacity: '500 racks', location: 'Istanbul' },
    },
    {
      code: 'DC-ANKARA-DR',
      name: 'Ankara Disaster Recovery Center',
      entityTypeCode: 'FACILITY',
      description: 'Disaster recovery data center in Ankara',
      attributes: { tier: 'Tier 3', capacity: '300 racks', location: 'Ankara' },
    },
    {
      code: 'DC-IZMIR-EDGE',
      name: 'Izmir Edge Data Center',
      entityTypeCode: 'FACILITY',
      description: 'Edge data center for regional services',
      attributes: { tier: 'Tier 2', capacity: '100 racks', location: 'Izmir' },
    },
  ],
  
  // 5 Vendors
  vendors: [
    {
      code: 'VEND-HUAWEI',
      name: 'Huawei Technologies',
      entityTypeCode: 'VENDOR',
      description: 'Network equipment and infrastructure vendor',
      attributes: { category: 'Network Equipment', contract: 'Active', risk: 'Medium' },
    },
    {
      code: 'VEND-ORACLE',
      name: 'Oracle Corporation',
      entityTypeCode: 'VENDOR',
      description: 'Database and enterprise software vendor',
      attributes: { category: 'Software', contract: 'Active', risk: 'Low' },
    },
    {
      code: 'VEND-CLOUD-AWS',
      name: 'Amazon Web Services',
      entityTypeCode: 'VENDOR',
      description: 'Cloud infrastructure and services',
      attributes: { category: 'Cloud Services', contract: 'Active', risk: 'Low' },
    },
    {
      code: 'VEND-SECURITY-MCAFEE',
      name: 'McAfee Security',
      entityTypeCode: 'VENDOR',
      description: 'Security software and services',
      attributes: { category: 'Security', contract: 'Active', risk: 'Low' },
    },
    {
      code: 'VEND-TELCO-PARTNER',
      name: 'International Telecom Partner',
      entityTypeCode: 'VENDOR',
      description: 'International roaming and interconnection partner',
      attributes: { category: 'Telecom Services', contract: 'Active', risk: 'Medium' },
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const determineDataSourceOptions = (): DataSourceOptions => {
  const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;

  if (preferPostgres) {
    return {
      type: 'postgres',
      url: databaseUrl,
      host: databaseUrl ? undefined : process.env.DB_HOST || 'localhost',
      port: databaseUrl ? undefined : Number(process.env.DB_PORT || 5432),
      username: databaseUrl ? undefined : process.env.DB_USER || 'postgres',
      password: databaseUrl ? undefined : process.env.DB_PASS || 'postgres',
      database: databaseUrl ? undefined : process.env.DB_NAME || 'postgres',
      schema: process.env.DB_SCHEMA || 'public',
      logging: false,
      entities: [],
      synchronize: false,
      migrationsRun: false,
    };
  }

  const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteRelative)
    ? sqliteRelative
    : path.join(process.cwd(), sqliteRelative);
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  return {
    type: 'sqlite',
    database: sqlitePath,
    logging: false,
    entities: [],
    synchronize: false,
  };
};

async function ensureTenant(ds: DataSource) {
  const tenantRepo = ds.getRepository(TenantEntity);
  let tenant = await tenantRepo.findOne({ where: { id: DEFAULT_TENANT_ID } });
  if (!tenant) {
    tenant = tenantRepo.create({
      id: DEFAULT_TENANT_ID,
      name: 'Default Tenant',
      slug: 'default',
      is_active: true,
    });
    tenant = await tenantRepo.save(tenant);
    console.log(`✅ Created tenant: ${tenant.id}`);
  } else {
    console.log(`✅ Tenant exists: ${tenant.id}`);
  }
  return tenant;
}

async function getDemoUser(ds: DataSource, tenantId: string) {
  const userRepo = ds.getRepository(UserEntity);
  let user = await userRepo.findOne({
    where: { email: 'grc1@local', tenant_id: tenantId },
  });
  if (!user) {
    // Create demo user if doesn't exist
    user = userRepo.create({
      id: randomUUID(),
      tenant_id: tenantId,
      email: 'grc1@local',
      password_hash: '$2b$10$placeholder', // Placeholder - should use proper hash
      display_name: 'GRC Admin',
      is_active: true,
    });
    user = await userRepo.save(user);
    console.log(`✅ Created demo user: ${user.email}`);
  }
  return user;
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

/**
 * Seed Entity Types and Entities for Polaris Telekom
 */
async function seedEntities(
  ds: DataSource,
  tenantId: string,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const entityTypeRepo = ds.getRepository(EntityTypeEntity);
  const entityRepo = ds.getRepository(EntityEntity);
  const entityMap = new Map<string, string>();

  // Entity Types
  const entityTypes = [
    { code: 'COMPANY', name: 'Company', description: 'Organizational entities' },
    { code: 'DEPARTMENT', name: 'Department', description: 'Organizational departments' },
    { code: 'APPLICATION', name: 'Application', description: 'Software applications' },
    { code: 'FACILITY', name: 'Facility', description: 'Physical facilities and data centers' },
    { code: 'VENDOR', name: 'Vendor', description: 'Third-party vendors' },
  ];

  const entityTypeMap = new Map<string, string>();
  for (const etData of entityTypes) {
    let et = await entityTypeRepo.findOne({
      where: { code: etData.code, tenant_id: tenantId },
    });
    if (!et) {
      et = entityTypeRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: etData.code,
        name: etData.name,
        description: etData.description,
      });
      et = await entityTypeRepo.save(et);
    }
    entityTypeMap.set(etData.code, et.id);
  }

  // Seed all entities
  const allEntities = [
    polarisEntities.company,
    ...polarisEntities.departments,
    ...polarisEntities.systems,
    ...polarisEntities.dataCenters,
    ...polarisEntities.vendors,
  ];

  for (const entityData of allEntities) {
    const entityTypeId = entityTypeMap.get(entityData.entityTypeCode);
    if (!entityTypeId) {
      console.log(`⚠️  Entity type not found: ${entityData.entityTypeCode}`);
      continue;
    }

    let entity = await entityRepo.findOne({
      where: { code: entityData.code, tenant_id: tenantId },
    });

    if (entity) {
      entity.name = entityData.name;
      // EntityEntity doesn't have description field, store in attributes if needed
      if (entityData.description) {
        entity.attributes = {
          ...(entity.attributes || {}),
          description: entityData.description,
          ...(entityData.attributes || {}),
        } as any;
      } else {
        entity.attributes = entityData.attributes as any;
      }
      entity = await entityRepo.save(entity);
    } else {
      entity = entityRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        entity_type_id: entityTypeId,
        code: entityData.code,
        name: entityData.name,
        attributes: entityData.description
          ? {
              description: entityData.description,
              ...(entityData.attributes || {}),
            }
          : (entityData.attributes as any),
      });
      entity = await entityRepo.save(entity);
    }
    entityMap.set(entityData.code, entity.id);
  }

  console.log(`  ✅ Created/updated ${allEntities.length} entities`);
  return entityMap;
}

/**
 * Seed Standards
 */
async function seedStandards(
  ds: DataSource,
  tenantId: string,
): Promise<Map<string, string>> {
  const standardRepo = ds.getRepository(StandardEntity);
  const standardMap = new Map<string, string>();

  const standards = [
    { code: 'ISO27001', name: 'ISO/IEC 27001:2022', version: '2022' },
    { code: 'ISO9001', name: 'ISO 9001:2015', version: '2015' },
    { code: 'ISO22301', name: 'ISO 22301:2019', version: '2019' },
    { code: 'ISO31000', name: 'ISO 31000:2018', version: '2018' },
    { code: 'PCI-DSS', name: 'PCI DSS v4.0', version: '4.0' },
  ];

  for (const stdData of standards) {
    let standard = await standardRepo.findOne({
      where: { code: stdData.code, tenant_id: tenantId },
    });
    if (!standard) {
      standard = standardRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: stdData.code,
        name: stdData.name,
        version: stdData.version,
      });
      standard = await standardRepo.save(standard);
    }
    standardMap.set(stdData.code, standard.id);
  }

  console.log(`  ✅ Created/updated ${standards.length} standards`);
  return standardMap;
}

/**
 * Seed Standard Clauses
 */
async function seedClauses(
  ds: DataSource,
  tenantId: string,
  standardMap: Map<string, string>,
): Promise<Map<string, string>> {
  const clauseRepo = ds.getRepository(StandardClauseEntity);
  const clauseMap = new Map<string, string>();

  // Key clauses for demo
  const clauses = [
    { standardCode: 'ISO27001', clauseCode: 'A.5.1.1', title: 'Information Security Policy' },
    { standardCode: 'ISO27001', clauseCode: 'A.9.1.1', title: 'Access Control Policy' },
    { standardCode: 'ISO27001', clauseCode: 'A.9.2.1', title: 'User Registration' },
    { standardCode: 'ISO27001', clauseCode: 'A.10.1.1', title: 'Cryptographic Controls' },
    { standardCode: 'ISO27001', clauseCode: 'A.12.2.1', title: 'Change Management' },
    { standardCode: 'ISO27001', clauseCode: 'A.15.1.1', title: 'Supplier Relationships' },
    { standardCode: 'ISO27001', clauseCode: 'A.16.1.1', title: 'Incident Management' },
    { standardCode: 'ISO9001', clauseCode: '9.2', title: 'Internal Audit' },
    { standardCode: 'ISO9001', clauseCode: '10.2', title: 'Corrective Action' },
    { standardCode: 'ISO22301', clauseCode: '8.2', title: 'Business Impact Analysis' },
  ];

  for (const clauseData of clauses) {
    const standardId = standardMap.get(clauseData.standardCode);
    if (!standardId) continue;

    let clause = await clauseRepo.findOne({
      where: {
        standard_id: standardId,
        clause_code: clauseData.clauseCode,
        tenant_id: tenantId,
      },
    });

    if (!clause) {
      clause = clauseRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        standard_id: standardId,
        clause_code: clauseData.clauseCode,
        title: clauseData.title,
        text: `Clause ${clauseData.clauseCode} from ${clauseData.standardCode}`,
      });
      clause = await clauseRepo.save(clause);
    }
    clauseMap.set(`${clauseData.standardCode}:${clauseData.clauseCode}`, clause.id);
  }

  console.log(`  ✅ Created/updated ${clauses.length} clauses`);
  return clauseMap;
}

/**
 * Seed Controls - Get all existing controls and create relationships
 */
async function seedControls(
  ds: DataSource,
  tenantId: string,
  clauseMap: Map<string, string>,
): Promise<Map<string, string>> {
  const controlRepo = ds.getRepository(ControlLibraryEntity);
  const controlMap = new Map<string, string>();

  // Get all existing controls
  const controls = await controlRepo.find({
    where: { tenant_id: tenantId },
  });

  for (const control of controls) {
    controlMap.set(control.code, control.id);
  }

  console.log(`  ✅ Found ${controls.length} existing controls`);
  return controlMap;
}

/**
 * Seed Policies
 */
async function seedPolicies(
  ds: DataSource,
  tenantId: string,
  userId: string | undefined,
  standardMap: Map<string, string>,
): Promise<Map<string, string>> {
  const policyRepo = ds.getRepository(PolicyEntity);
  const policyStandardRepo = ds.getRepository(PolicyStandardEntity);
  const policyMap = new Map<string, string>();

  const policies = [
    {
      code: 'POL-SEC-001',
      title: 'Information Security Policy',
      status: 'approved',
      ownerFirstName: 'Ayşe',
      ownerLastName: 'Demir',
      effectiveDate: '2024-01-01',
      reviewDate: '2025-01-01',
      standardCodes: ['ISO27001'],
    },
    {
      code: 'POL-ACC-001',
      title: 'Access Management Policy',
      status: 'approved',
      ownerFirstName: 'Mehmet',
      ownerLastName: 'Yılmaz',
      effectiveDate: '2024-02-01',
      reviewDate: '2025-02-01',
      standardCodes: ['ISO27001'],
    },
    {
      code: 'POL-BKP-001',
      title: 'Backup and Recovery Policy',
      status: 'approved',
      ownerFirstName: 'Ali',
      ownerLastName: 'Kaya',
      effectiveDate: '2024-01-15',
      reviewDate: '2025-01-15',
      standardCodes: ['ISO27001', 'ISO22301'],
    },
    {
      code: 'POL-CHG-001',
      title: 'Change Management Policy',
      status: 'approved',
      ownerFirstName: 'Mehmet',
      ownerLastName: 'Yılmaz',
      effectiveDate: '2024-03-01',
      reviewDate: '2025-03-01',
      standardCodes: ['ISO27001', 'ISO9001'],
    },
    {
      code: 'POL-VDR-001',
      title: 'Vendor Management Policy',
      status: 'approved',
      ownerFirstName: 'Fatma',
      ownerLastName: 'Şahin',
      effectiveDate: '2024-02-15',
      reviewDate: '2025-02-15',
      standardCodes: ['ISO27001'],
    },
    {
      code: 'POL-QUAL-001',
      title: 'Quality Management Policy',
      status: 'approved',
      ownerFirstName: 'Fatma',
      ownerLastName: 'Şahin',
      effectiveDate: '2024-01-01',
      reviewDate: '2025-01-01',
      standardCodes: ['ISO9001'],
    },
    {
      code: 'POL-BCM-001',
      title: 'Business Continuity Management Policy',
      status: 'approved',
      ownerFirstName: 'Ali',
      ownerLastName: 'Kaya',
      effectiveDate: '2024-01-01',
      reviewDate: '2025-01-01',
      standardCodes: ['ISO22301'],
    },
    {
      code: 'POL-PRIV-001',
      title: 'Data Privacy and Protection Policy',
      status: 'approved',
      ownerFirstName: 'Ayşe',
      ownerLastName: 'Demir',
      effectiveDate: '2024-01-01',
      reviewDate: '2025-01-01',
      standardCodes: ['ISO27001'],
    },
    {
      code: 'POL-RISK-001',
      title: 'Risk Management Policy',
      status: 'in_review',
      ownerFirstName: 'Ayşe',
      ownerLastName: 'Demir',
      effectiveDate: '2024-04-01',
      reviewDate: '2025-04-01',
      standardCodes: ['ISO31000'],
    },
    {
      code: 'POL-INC-001',
      title: 'Incident Management Policy',
      status: 'approved',
      ownerFirstName: 'Mehmet',
      ownerLastName: 'Yılmaz',
      effectiveDate: '2024-02-01',
      reviewDate: '2025-02-01',
      standardCodes: ['ISO27001'],
    },
  ];

  for (const policyData of policies) {
    let policy = await policyRepo.findOne({
      where: { code: policyData.code, tenant_id: tenantId },
    });

    if (policy) {
      policy.title = policyData.title;
      policy.status = policyData.status;
      policy.owner_first_name = policyData.ownerFirstName;
      policy.owner_last_name = policyData.ownerLastName;
      policy.effective_date = policyData.effectiveDate;
      policy.review_date = policyData.reviewDate;
      policy = await policyRepo.save(policy);
    } else {
      policy = policyRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: policyData.code,
        title: policyData.title,
        status: policyData.status,
        owner_first_name: policyData.ownerFirstName,
        owner_last_name: policyData.ownerLastName,
        effective_date: policyData.effectiveDate,
        review_date: policyData.reviewDate,
        created_by: userId,
      });
      policy = await policyRepo.save(policy);
    }
    policyMap.set(policyData.code, policy.id);

    // Link to standards (if policy_standards table exists)
    try {
      for (const stdCode of policyData.standardCodes) {
        const standardId = standardMap.get(stdCode);
        if (!standardId) continue;

        const existing = await policyStandardRepo.findOne({
          where: {
            policy_id: policy.id,
            standard_id: standardId,
            tenant_id: tenantId,
          },
        });

        if (!existing) {
          const ps = policyStandardRepo.create({
            id: randomUUID(),
            tenant_id: tenantId,
            policy_id: policy.id,
            standard_id: standardId,
          });
          await policyStandardRepo.save(ps);
        }
      }
    } catch (error: any) {
      // If policy_standards table doesn't exist, skip the linking
      if (error?.message?.includes('no such table: policy_standards')) {
        console.log(`  ⚠️  policy_standards table not found, skipping policy-standard links`);
      } else {
        throw error;
      }
    }
  }

  console.log(`  ✅ Created/updated ${policies.length} policies`);
  return policyMap;
}

/**
 * Link Controls to Clauses
 */
async function linkControlsToClauses(
  ds: DataSource,
  tenantId: string,
  controlMap: Map<string, string>,
  clauseMap: Map<string, string>,
) {
  const controlToClauseRepo = ds.getRepository(ControlToClauseEntity);

  // Get all controls and clauses
  const controls = Array.from(controlMap.entries());
  const clauses = Array.from(clauseMap.entries());

  // Link each control to at least 1 clause
  let linkCount = 0;
  for (const [controlCode, controlId] of controls) {
    // Try to match control code to clause code (e.g., CTL-ISO27001-A.9.2.1 -> ISO27001:A.9.2.1)
    let matchedClauseId: string | undefined;
    
    // Try exact match first
    const codeParts = controlCode.split('-');
    if (codeParts.length >= 3) {
      const standardCode = codeParts[1]; // e.g., ISO27001
      const clauseCode = codeParts.slice(2).join('.'); // e.g., A.9.2.1
      const clauseKey = `${standardCode}:${clauseCode}`;
      matchedClauseId = clauseMap.get(clauseKey);
    }

    // If no exact match, assign a random clause
    if (!matchedClauseId && clauses.length > 0) {
      const randomIndex = Math.floor(Math.random() * clauses.length);
      const randomClause = clauses[randomIndex];
      if (randomClause) {
        matchedClauseId = randomClause[1];
      }
    }

    if (matchedClauseId) {
      const existing = await controlToClauseRepo.findOne({
        where: {
          control_id: controlId,
          clause_id: matchedClauseId,
          tenant_id: tenantId,
        },
      });

      if (!existing) {
        const link = controlToClauseRepo.create({
          control_id: controlId,
          clause_id: matchedClauseId,
          tenant_id: tenantId,
        });
        await controlToClauseRepo.save(link);
        linkCount++;
      }
    }
  }

  console.log(`  ✅ Created ${linkCount} control-clause links`);
}

/**
 * Link Controls to Policies
 */
async function linkControlsToPolicies(
  ds: DataSource,
  tenantId: string,
  controlMap: Map<string, string>,
  policyMap: Map<string, string>,
) {
  const controlToPolicyRepo = ds.getRepository(ControlToPolicyEntity);

  // Get all controls and policies
  const controls = Array.from(controlMap.entries());
  const policies = Array.from(policyMap.entries());

  // Link each control to 2-3 policies
  let linkCount = 0;
  for (const [controlCode, controlId] of controls) {
    const numPolicies = Math.min(2 + Math.floor(Math.random() * 2), policies.length);
    const selectedPolicies = policies
      .sort(() => Math.random() - 0.5)
      .slice(0, numPolicies);

    for (const [, policyId] of selectedPolicies) {
      const existing = await controlToPolicyRepo.findOne({
        where: {
          control_id: controlId,
          policy_id: policyId,
          tenant_id: tenantId,
        },
      });

      if (!existing) {
        const link = controlToPolicyRepo.create({
          control_id: controlId,
          policy_id: policyId,
          tenant_id: tenantId,
        });
        await controlToPolicyRepo.save(link);
        linkCount++;
      }
    }
  }

  console.log(`  ✅ Created ${linkCount} control-policy links`);
}

/**
 * Seed Risk Categories
 */
async function seedRiskCategories(
  ds: DataSource,
  tenantId: string,
): Promise<Map<string, string>> {
  const categoryRepo = ds.getRepository(RiskCategoryEntity);
  const categoryMap = new Map<string, string>();

  const categories = [
    { code: 'INFO_SEC', name: 'Information Security' },
    { code: 'OPERATIONAL', name: 'Operational' },
    { code: 'COMPLIANCE', name: 'Compliance' },
    { code: 'FINANCIAL', name: 'Financial' },
    { code: 'TECHNICAL', name: 'Technical' },
    { code: 'REPUTATIONAL', name: 'Reputational' },
  ];

  for (const catData of categories) {
    let category = await categoryRepo.findOne({
      where: { code: catData.code, tenant_id: tenantId },
    });
    if (!category) {
      category = categoryRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: catData.code,
        name: catData.name,
      });
      category = await categoryRepo.save(category);
    }
    categoryMap.set(catData.code, category.id);
  }

  console.log(`  ✅ Created/updated ${categories.length} risk categories`);
  return categoryMap;
}

/**
 * Seed Risk Catalog
 */
async function seedRiskCatalog(
  ds: DataSource,
  tenantId: string,
  categoryMap: Map<string, string>,
): Promise<Map<string, string>> {
  const riskRepo = ds.getRepository(RiskCatalogEntity);
  const riskMap = new Map<string, string>();

  const risks = [
    {
      code: 'RISK-DATA-BREACH',
      name: 'Data Breach',
      description: 'Unauthorized access, disclosure, or theft of sensitive data',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      code: 'RISK-UNAUTHORIZED-ACCESS',
      name: 'Unauthorized Access',
      description: 'Unauthorized access to systems, applications, or data',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 4,
      defaultImpact: 4,
    },
    {
      code: 'RISK-MALWARE',
      name: 'Malware Infection',
      description: 'Malicious software infection leading to data loss or system compromise',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      code: 'RISK-PHISHING',
      name: 'Phishing Attack',
      description: 'Social engineering attack to steal credentials or sensitive information',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 4,
      defaultImpact: 3,
    },
    {
      code: 'RISK-CONFIG-ERROR',
      name: 'Configuration Error',
      description: 'Misconfiguration leading to security vulnerabilities or system failures',
      categoryCode: 'TECHNICAL',
      defaultLikelihood: 4,
      defaultImpact: 3,
    },
    {
      code: 'RISK-BACKUP-FAILURE',
      name: 'Backup Failure',
      description: 'Failure of backup systems leading to data loss',
      categoryCode: 'OPERATIONAL',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      code: 'RISK-CAPACITY-SHORTAGE',
      name: 'Capacity Shortage',
      description: 'Insufficient system capacity leading to service degradation or outages',
      categoryCode: 'OPERATIONAL',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
    {
      code: 'RISK-VENDOR-FAILURE',
      name: 'Vendor Failure',
      description: 'Critical vendor service failure or business disruption',
      categoryCode: 'OPERATIONAL',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      code: 'RISK-SERVICE-OUTAGE',
      name: 'Service Outage',
      description: 'Extended service unavailability affecting business operations',
      categoryCode: 'OPERATIONAL',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      code: 'RISK-REG-NONCOMPLIANCE',
      name: 'Regulatory Non-Compliance',
      description: 'Failure to comply with applicable regulations leading to penalties or sanctions',
      categoryCode: 'COMPLIANCE',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      code: 'RISK-DATA-LOSS',
      name: 'Data Loss',
      description: 'Accidental or intentional loss of critical data',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      code: 'RISK-INSIDER-THREAT',
      name: 'Insider Threat',
      description: 'Malicious or negligent actions by internal personnel',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      code: 'RISK-DDOS',
      name: 'DDoS Attack',
      description: 'Distributed Denial of Service attack causing service unavailability',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      code: 'RISK-SUPPLY-CHAIN',
      name: 'Supply Chain Compromise',
      description: 'Compromise of third-party software or services',
      categoryCode: 'INFO_SEC',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      code: 'RISK-FINANCIAL-FRAUD',
      name: 'Financial Fraud',
      description: 'Financial fraud or embezzlement',
      categoryCode: 'FINANCIAL',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      code: 'RISK-REPUTATION-DAMAGE',
      name: 'Reputation Damage',
      description: 'Public disclosure of security incidents or compliance failures',
      categoryCode: 'REPUTATIONAL',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
  ];

  for (const riskData of risks) {
    const categoryId = categoryMap.get(riskData.categoryCode);
    if (!categoryId) continue;

    let risk = await riskRepo.findOne({
      where: { code: riskData.code, tenant_id: tenantId },
    });

    if (risk) {
      risk.name = riskData.name;
      risk.description = riskData.description;
      risk.category_id = categoryId;
      risk.default_likelihood = riskData.defaultLikelihood;
      risk.default_impact = riskData.defaultImpact;
      risk = await riskRepo.save(risk);
    } else {
      risk = riskRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: riskData.code,
        name: riskData.name,
        description: riskData.description,
        category_id: categoryId,
        default_likelihood: riskData.defaultLikelihood,
        default_impact: riskData.defaultImpact,
      });
      risk = await riskRepo.save(risk);
    }
    riskMap.set(riskData.code, risk.id);
  }

  console.log(`  ✅ Created/updated ${risks.length} risk catalog entries`);
  return riskMap;
}

/**
 * Link Controls to Risks
 */
async function linkControlsToRisks(
  ds: DataSource,
  tenantId: string,
  controlMap: Map<string, string>,
  riskMap: Map<string, string>,
) {
  const riskToControlRepo = ds.getRepository(RiskToControlEntity);

  const risks = Array.from(riskMap.entries());
  const controls = Array.from(controlMap.entries());

  let linkCount = 0;
  for (const [, riskId] of risks) {
    const numControls = Math.min(2 + Math.floor(Math.random() * 3), controls.length);
    const selectedControls = controls
      .sort(() => Math.random() - 0.5)
      .slice(0, numControls);

    for (const [, controlId] of selectedControls) {
      const existing = await riskToControlRepo.findOne({
        where: {
          risk_id: riskId,
          control_id: controlId,
          tenant_id: tenantId,
        },
      });

      if (!existing) {
        const link = riskToControlRepo.create({
          risk_id: riskId,
          control_id: controlId,
          tenant_id: tenantId,
        });
        await riskToControlRepo.save(link);
        linkCount++;
      }
    }
  }

  console.log(`  ✅ Created ${linkCount} risk-control links`);
}

/**
 * Seed Risk Instances
 */
async function seedRiskInstances(
  ds: DataSource,
  tenantId: string,
  riskCatalogMap: Map<string, string>,
  entityMap: Map<string, string>,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const riskInstanceRepo = ds.getRepository(RiskInstanceEntity);
  const riskInstanceMap = new Map<string, string>();

  const riskInstances = [
    {
      riskCatalogCode: 'RISK-DATA-BREACH',
      entityCode: 'SYS-BILLING',
      entityType: EntityType.APPLICATION,
      likelihood: 3,
      impact: 5,
      status: RiskStatus.OPEN,
      notes: 'Billing system contains customer PII and payment data. Risk of unauthorized access through SQL injection or insider threat.',
    },
    {
      riskCatalogCode: 'RISK-UNAUTHORIZED-ACCESS',
      entityCode: 'SYS-CRM',
      entityType: EntityType.APPLICATION,
      likelihood: 4,
      impact: 4,
      status: RiskStatus.OPEN,
      notes: 'CRM system has multiple user roles. Risk of privilege escalation or unauthorized access to customer data.',
    },
    {
      riskCatalogCode: 'RISK-MALWARE',
      entityCode: 'SYS-SELF-SERVICE',
      entityType: EntityType.APPLICATION,
      likelihood: 3,
      impact: 5,
      status: RiskStatus.OPEN,
      notes: 'Customer self-service portal is exposed to public internet. Risk of malware infection through user devices or web attacks.',
    },
    {
      riskCatalogCode: 'RISK-SERVICE-OUTAGE',
      entityCode: 'DC-ISTANBUL-PRIMARY',
      entityType: EntityType.FACILITY,
      likelihood: 2,
      impact: 5,
      status: RiskStatus.OPEN,
      notes: 'Primary data center outage could affect all critical systems. Single point of failure risk.',
    },
    {
      riskCatalogCode: 'RISK-VENDOR-FAILURE',
      entityCode: 'VEND-HUAWEI',
      entityType: EntityType.VENDOR,
      likelihood: 2,
      impact: 4,
      status: RiskStatus.OPEN,
      notes: 'Huawei network equipment vendor failure could impact core network operations.',
    },
    {
      riskCatalogCode: 'RISK-CAPACITY-SHORTAGE',
      entityCode: 'SYS-CORE-NETWORK',
      entityType: EntityType.APPLICATION,
      likelihood: 3,
      impact: 4,
      status: RiskStatus.OPEN,
      notes: 'Core network management system experiencing high traffic volumes. Risk of performance degradation during peak hours.',
    },
    {
      riskCatalogCode: 'RISK-CONFIG-ERROR',
      entityCode: 'SYS-PROVISIONING',
      entityType: EntityType.APPLICATION,
      likelihood: 4,
      impact: 3,
      status: RiskStatus.OPEN,
      notes: 'Service provisioning system configuration errors could lead to security vulnerabilities or service disruptions.',
    },
    {
      riskCatalogCode: 'RISK-INSIDER-THREAT',
      entityCode: 'SYS-ERP',
      entityType: EntityType.APPLICATION,
      likelihood: 2,
      impact: 4,
      status: RiskStatus.OPEN,
      notes: 'ERP system contains sensitive financial and operational data. Risk of insider threat or unauthorized access.',
    },
    {
      riskCatalogCode: 'RISK-BACKUP-FAILURE',
      entityCode: 'SYS-BILLING',
      entityType: EntityType.APPLICATION,
      likelihood: 2,
      impact: 5,
      status: RiskStatus.OPEN,
      notes: 'Billing system backup failures could result in data loss. Critical for financial operations.',
    },
    {
      riskCatalogCode: 'RISK-DDOS',
      entityCode: 'SYS-SELF-SERVICE',
      entityType: EntityType.APPLICATION,
      likelihood: 3,
      impact: 4,
      status: RiskStatus.OPEN,
      notes: 'Customer self-service portal is vulnerable to DDoS attacks, which could cause service unavailability.',
    },
  ];

  for (const riData of riskInstances) {
    const catalogId = riskCatalogMap.get(riData.riskCatalogCode);
    const entityId = entityMap.get(riData.entityCode);
    if (!catalogId || !entityId) continue;

    let riskInstance = await riskInstanceRepo.findOne({
      where: {
        catalog_id: catalogId,
        entity_id: entityId,
        tenant_id: tenantId,
      },
    });

    if (riskInstance) {
      riskInstance.likelihood = riData.likelihood;
      riskInstance.impact = riData.impact;
      riskInstance.status = riData.status;
      riskInstance.notes = riData.notes;
      riskInstance = await riskInstanceRepo.save(riskInstance);
    } else {
      riskInstance = riskInstanceRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        catalog_id: catalogId,
        entity_id: entityId,
        entity_type: riData.entityType,
        likelihood: riData.likelihood,
        impact: riData.impact,
        status: riData.status,
        notes: riData.notes,
        owner_id: userId,
        created_by: userId,
      });
      riskInstance = await riskInstanceRepo.save(riskInstance);
    }
    riskInstanceMap.set(`${riData.riskCatalogCode}:${riData.entityCode}`, riskInstance.id);
  }

  console.log(`  ✅ Created/updated ${riskInstances.length} risk instances`);
  return riskInstanceMap;
}

/**
 * Seed Audit Plans
 */
async function seedAuditPlans(
  ds: DataSource,
  tenantId: string,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const planRepo = ds.getRepository(AuditPlanEntity);
  const planMap = new Map<string, string>();

  const plans = [
    {
      code: 'AUD-2025-ISO27001-001',
      name: '2025 ISO 27001 Internal Audit – Polaris Telekom',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      scope: 'Internal audit of ISO/IEC 27001:2022 compliance covering data center operations, managed services, and information security management system.',
      status: AuditPlanStatus.IN_PROGRESS,
    },
    {
      code: 'AUD-2025-ISO9001-001',
      name: '2025 ISO 9001 Process & Quality Audit',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      scope: 'Internal audit of ISO 9001:2015 quality management system covering product development, customer service, and continuous improvement processes.',
      status: AuditPlanStatus.IN_PROGRESS,
    },
  ];

  for (const planData of plans) {
    let plan = await planRepo.findOne({
      where: { code: planData.code, tenant_id: tenantId },
    });

    if (plan) {
      plan.name = planData.name;
      plan.period_start = new Date(planData.periodStart);
      plan.period_end = new Date(planData.periodEnd);
      plan.scope = planData.scope;
      plan.status = planData.status;
      plan = await planRepo.save(plan);
    } else {
      plan = planRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: planData.code,
        name: planData.name,
        period_start: new Date(planData.periodStart),
        period_end: new Date(planData.periodEnd),
        scope: planData.scope,
        status: planData.status,
        created_by: userId,
      });
      plan = await planRepo.save(plan);
    }
    planMap.set(planData.code, plan.id);
  }

  console.log(`  ✅ Created/updated ${plans.length} audit plans`);
  return planMap;
}

/**
 * Seed Audit Engagements
 */
async function seedAuditEngagements(
  ds: DataSource,
  tenantId: string,
  planMap: Map<string, string>,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const engagementRepo = ds.getRepository(AuditEngagementEntity);
  const engagementMap = new Map<string, string>();

  const engagements = [
    {
      code: 'ENG-2025-ISO27001-DC-001',
      name: 'Data Center Security Controls Audit',
      planCode: 'AUD-2025-ISO27001-001',
      auditee: 'IT Operations Team',
      status: AuditEngagementStatus.IN_PROGRESS,
    },
    {
      code: 'ENG-2025-ISO27001-ISMS-001',
      name: 'ISMS Policy and Governance Audit',
      planCode: 'AUD-2025-ISO27001-001',
      auditee: 'Information Security Team',
      status: AuditEngagementStatus.COMPLETED,
    },
    {
      code: 'ENG-2025-ISO9001-QMS-001',
      name: 'Quality Management System Internal Audit',
      planCode: 'AUD-2025-ISO9001-001',
      auditee: 'Quality Assurance Team',
      status: AuditEngagementStatus.IN_PROGRESS,
    },
  ];

  for (const engData of engagements) {
    const planId = planMap.get(engData.planCode);
    if (!planId) continue;

    let engagement = await engagementRepo.findOne({
      where: { code: engData.code, tenant_id: tenantId },
    });

    if (engagement) {
      engagement.name = engData.name;
      engagement.auditee = engData.auditee;
      engagement.status = engData.status;
      engagement.plan_id = planId;
      engagement = await engagementRepo.save(engagement);
    } else {
      engagement = engagementRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        plan_id: planId,
        code: engData.code,
        name: engData.name,
        auditee: engData.auditee,
        status: engData.status,
        created_by: userId,
      });
      engagement = await engagementRepo.save(engagement);
    }
    engagementMap.set(engData.code, engagement.id);
  }

  console.log(`  ✅ Created/updated ${engagements.length} audit engagements`);
  return engagementMap;
}

/**
 * Seed Audit Findings
 */
async function seedAuditFindings(
  ds: DataSource,
  tenantId: string,
  engagementMap: Map<string, string>,
  controlMap: Map<string, string>,
  clauseMap: Map<string, string>,
  policyMap: Map<string, string>,
  riskInstanceMap: Map<string, string>,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const findingRepo = ds.getRepository(AuditFindingEntity);
  const findingMap = new Map<string, string>();

  const findings = [
    {
      engagementCode: 'ENG-2025-ISO27001-DC-001',
      title: 'Insufficient access control review process',
      description: 'Access control reviews are not conducted on a regular basis. Some user accounts have not been reviewed in over 12 months.',
      details: 'During the audit, it was found that the access control review process (ISO 27001 A.9.2.1) is not being followed consistently.',
      severity: AuditFindingSeverity.HIGH,
      status: AuditFindingStatus.OPEN,
      dueDate: '2025-03-15',
      clauseKey: 'ISO27001:A.9.2.1',
      controlCode: 'CTL-ISO27001-A.9.2.1',
      policyCode: 'POL-ACC-001',
      riskInstanceKey: 'RISK-UNAUTHORIZED-ACCESS:SYS-CRM',
    },
    {
      engagementCode: 'ENG-2025-ISO27001-DC-001',
      title: 'Missing documentation for cryptographic controls',
      description: 'Cryptographic controls policy exists but implementation documentation is incomplete.',
      details: 'The organization has a policy on cryptographic controls (ISO 27001 A.10.1.1) but lacks detailed documentation.',
      severity: AuditFindingSeverity.MEDIUM,
      status: AuditFindingStatus.IN_PROGRESS,
      dueDate: '2025-04-30',
      clauseKey: 'ISO27001:A.10.1.1',
      controlCode: 'CTL-ISO27001-A.10.1.1',
      policyCode: 'POL-SEC-001',
    },
    {
      engagementCode: 'ENG-2025-ISO27001-ISMS-001',
      title: 'Information security policy not reviewed annually',
      description: 'The information security policy (ISO 27001 A.5.1.1) has not been reviewed in the past 18 months.',
      details: 'According to the policy, the information security policy should be reviewed annually.',
      severity: AuditFindingSeverity.MEDIUM,
      status: AuditFindingStatus.CLOSED,
      dueDate: '2025-02-28',
      clauseKey: 'ISO27001:A.5.1.1',
      controlCode: 'CTL-ISO27001-A.5.1.1',
      policyCode: 'POL-SEC-001',
    },
    {
      engagementCode: 'ENG-2025-ISO9001-QMS-001',
      title: 'Internal audit not conducted as planned',
      description: 'The internal audit (ISO 9001 9.2) scheduled for Q4 2024 was not conducted.',
      details: 'According to the audit schedule, an internal audit of the quality management system should have been conducted in Q4 2024.',
      severity: AuditFindingSeverity.MEDIUM,
      status: AuditFindingStatus.OPEN,
      dueDate: '2025-03-31',
      clauseKey: 'ISO9001:9.2',
      controlCode: 'CTL-ISO9001-9.2.1',
      policyCode: 'POL-QUAL-001',
    },
    {
      engagementCode: 'ENG-2025-ISO9001-QMS-001',
      title: 'Nonconformity corrective action process not fully documented',
      description: 'Some nonconformities identified in previous audits do not have complete corrective action documentation (ISO 9001 10.2).',
      details: 'Review of previous audit records shows that corrective actions for some nonconformities lack root cause analysis.',
      severity: AuditFindingSeverity.LOW,
      status: AuditFindingStatus.IN_PROGRESS,
      dueDate: '2025-05-15',
      clauseKey: 'ISO9001:10.2',
      controlCode: 'CTL-ISO9001-10.2.1',
      policyCode: 'POL-QUAL-001',
    },
  ];

  for (const findingData of findings) {
    const engagementId = engagementMap.get(findingData.engagementCode);
    if (!engagementId) continue;

    const clauseId = findingData.clauseKey ? clauseMap.get(findingData.clauseKey) : undefined;
    const controlId = findingData.controlCode ? controlMap.get(findingData.controlCode) : undefined;
    const policyId = findingData.policyCode ? policyMap.get(findingData.policyCode) : undefined;
    const riskInstanceId = findingData.riskInstanceKey
      ? riskInstanceMap.get(findingData.riskInstanceKey)
      : undefined;

    let finding = await findingRepo.findOne({
      where: {
        engagement_id: engagementId,
        title: findingData.title,
        tenant_id: tenantId,
      },
    });

    if (finding) {
      finding.description = findingData.description;
      finding.details = findingData.details;
      finding.severity = findingData.severity;
      finding.status = findingData.status;
      finding.due_date = new Date(findingData.dueDate);
      finding.clause_id = clauseId;
      finding.control_id = controlId;
      finding.policy_id = policyId;
      finding.risk_instance_id = riskInstanceId;
      finding = await findingRepo.save(finding);
    } else {
      finding = findingRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        engagement_id: engagementId,
        title: findingData.title,
        description: findingData.description,
        details: findingData.details,
        severity: findingData.severity,
        status: findingData.status,
        due_date: new Date(findingData.dueDate),
        clause_id: clauseId,
        control_id: controlId,
        policy_id: policyId,
        risk_instance_id: riskInstanceId,
        created_by: userId,
      });
      finding = await findingRepo.save(finding);
    }
    findingMap.set(findingData.title, finding.id);
  }

  console.log(`  ✅ Created/updated ${findings.length} audit findings`);
  return findingMap;
}

/**
 * Seed Corrective Action Plans (CAPs)
 */
async function seedCAPs(
  ds: DataSource,
  tenantId: string,
  findingMap: Map<string, string>,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const capRepo = ds.getRepository(CorrectiveActionEntity);
  const capMap = new Map<string, string>();

  const caps = [
    {
      findingTitle: 'Insufficient access control review process',
      code: 'CAP-2025-001',
      title: 'Implement quarterly access control reviews',
      description: 'Establish a quarterly review process for all user accounts, with special attention to accounts with elevated privileges.',
      dueDate: '2025-03-15',
      status: CorrectiveActionStatus.IN_PROGRESS,
    },
    {
      findingTitle: 'Missing documentation for cryptographic controls',
      code: 'CAP-2025-002',
      title: 'Document cryptographic control implementation',
      description: 'Create comprehensive documentation covering encryption algorithms, key management procedures, and encryption standards.',
      dueDate: '2025-04-30',
      status: CorrectiveActionStatus.OPEN,
    },
    {
      findingTitle: 'Information security policy not reviewed annually',
      code: 'CAP-2025-003',
      title: 'Schedule and conduct annual policy review',
      description: 'Schedule the annual information security policy review for Q1 2025 and ensure it is conducted with management participation.',
      dueDate: '2025-02-28',
      status: CorrectiveActionStatus.DONE,
    },
    {
      findingTitle: 'Internal audit not conducted as planned',
      code: 'CAP-2025-004',
      title: 'Reschedule and conduct delayed internal audit',
      description: 'Reschedule the Q4 2024 internal audit for Q1 2025 and ensure it is conducted according to the audit plan.',
      dueDate: '2025-03-31',
      status: CorrectiveActionStatus.OPEN,
    },
    {
      findingTitle: 'Nonconformity corrective action process not fully documented',
      code: 'CAP-2025-005',
      title: 'Complete corrective action documentation',
      description: 'Review all open nonconformities and ensure each has complete documentation including root cause analysis.',
      dueDate: '2025-05-15',
      status: CorrectiveActionStatus.IN_PROGRESS,
    },
  ];

  for (const capData of caps) {
    const findingId = findingMap.get(capData.findingTitle);
    if (!findingId) continue;

    let cap = await capRepo.findOne({
      where: {
        finding_id: findingId,
        code: capData.code,
        tenant_id: tenantId,
      },
    });

    if (cap) {
      cap.title = capData.title;
      cap.description = capData.description;
      cap.due_date = new Date(capData.dueDate);
      cap.status = capData.status;
      cap = await capRepo.save(cap);
    } else {
      cap = capRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        finding_id: findingId,
        code: capData.code,
        title: capData.title,
        description: capData.description,
        due_date: new Date(capData.dueDate),
        status: capData.status,
        created_by: userId,
      });
      cap = await capRepo.save(cap);
    }
    capMap.set(capData.code, cap.id);
  }

  console.log(`  ✅ Created/updated ${caps.length} CAPs`);
  return capMap;
}

/**
 * Link Controls to CAPs
 */
async function linkControlsToCAPs(
  ds: DataSource,
  tenantId: string,
  controlMap: Map<string, string>,
  capMap: Map<string, string>,
) {
  const controlToCapRepo = ds.getRepository(ControlToCapEntity);

  const caps = Array.from(capMap.entries());
  const controls = Array.from(controlMap.entries());

  let linkCount = 0;
  for (const [, capId] of caps) {
    const numControls = Math.min(1 + Math.floor(Math.random() * 2), controls.length);
    const selectedControls = controls
      .sort(() => Math.random() - 0.5)
      .slice(0, numControls);

    for (const [, controlId] of selectedControls) {
      const existing = await controlToCapRepo.findOne({
        where: {
          control_id: controlId,
          cap_id: capId,
          tenant_id: tenantId,
        },
      });

      if (!existing) {
        const link = controlToCapRepo.create({
          control_id: controlId,
          cap_id: capId,
          tenant_id: tenantId,
        });
        await controlToCapRepo.save(link);
        linkCount++;
      }
    }
  }

  console.log(`  ✅ Created ${linkCount} control-CAP links`);
}

/**
 * Seed BIA Processes
 */
async function seedBIAProcesses(
  ds: DataSource,
  tenantId: string,
  entityMap: Map<string, string>,
  userId: string | undefined,
): Promise<Map<string, string>> {
  const biaRepo = ds.getRepository(BIAProcessEntity);
  const biaMap = new Map<string, string>();

  const biaProcesses = [
    {
      code: 'BIA-CALL-CENTER',
      name: 'Customer Call Center',
      description: '24/7 customer support and service operations',
      criticality: 5,
      rtoHours: 2,
      rpoHours: 1,
      mtpdHours: 4,
    },
    {
      code: 'BIA-SELF-SERVICE',
      name: 'Customer Self-Service Portal',
      description: 'Online customer portal for self-service operations',
      criticality: 5,
      rtoHours: 1,
      rpoHours: 0.5,
      mtpdHours: 2,
    },
    {
      code: 'BIA-CORE-NETWORK',
      name: 'Core Network Operations',
      description: 'Core network infrastructure and operations',
      criticality: 5,
      rtoHours: 4,
      rpoHours: 1,
      mtpdHours: 8,
    },
    {
      code: 'BIA-BILLING',
      name: 'Billing Operations',
      description: 'Customer billing and revenue management',
      criticality: 4,
      rtoHours: 8,
      rpoHours: 4,
      mtpdHours: 24,
    },
    {
      code: 'BIA-DC-OPERATIONS',
      name: 'Data Center Operations',
      description: 'Data center infrastructure and operations',
      criticality: 5,
      rtoHours: 2,
      rpoHours: 1,
      mtpdHours: 4,
    },
    {
      code: 'BIA-PAYROLL',
      name: 'Payroll Processing',
      description: 'Monthly payroll processing and employee payments',
      criticality: 4,
      rtoHours: 24,
      rpoHours: 8,
      mtpdHours: 72,
    },
  ];

  for (const biaData of biaProcesses) {
    let bia = await biaRepo.findOne({
      where: { code: biaData.code, tenant_id: tenantId },
    });

    if (bia) {
      bia.name = biaData.name;
      bia.description = biaData.description;
      bia.criticality = biaData.criticality;
      bia.rto_hours = biaData.rtoHours;
      bia.rpo_hours = biaData.rpoHours;
      bia.mtpd_hours = biaData.mtpdHours;
      bia.owner_user_id = userId;
      bia = await biaRepo.save(bia);
    } else {
      bia = biaRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: biaData.code,
        name: biaData.name,
        description: biaData.description,
        criticality: biaData.criticality,
        rto_hours: biaData.rtoHours,
        rpo_hours: biaData.rpoHours,
        mtpd_hours: biaData.mtpdHours,
        owner_user_id: userId,
        created_by: userId,
      });
      bia = await biaRepo.save(bia);
    }
    biaMap.set(biaData.code, bia.id);
  }

  console.log(`  ✅ Created/updated ${biaProcesses.length} BIA processes`);
  return biaMap;
}

/**
 * Seed BCP Plans
 */
async function seedBCPPlans(
  ds: DataSource,
  tenantId: string,
  biaProcessMap: Map<string, string>,
  userId: string | undefined,
) {
  const bcpRepo = ds.getRepository(BCPPlanEntity);

  const bcpPlans = [
    {
      code: 'BCP-DC-DR',
      name: 'Data Center Disaster Recovery Plan',
      version: '2.0',
      status: BCPPlanStatus.APPROVED,
      processCode: 'BIA-DC-OPERATIONS',
      steps: [
        { step: 1, title: 'Activate DR Site', description: 'Activate disaster recovery data center' },
        { step: 2, title: 'Restore Systems', description: 'Restore critical systems from backups' },
        { step: 3, title: 'Verify Operations', description: 'Verify all systems are operational' },
      ],
    },
    {
      code: 'BCP-PANDEMIC',
      name: 'Pandemic Business Continuity Plan',
      version: '1.5',
      status: BCPPlanStatus.APPROVED,
      processCode: null,
      steps: [
        { step: 1, title: 'Activate Remote Work', description: 'Enable remote work capabilities for all staff' },
        { step: 2, title: 'Secure Access', description: 'Ensure secure remote access to systems' },
      ],
    },
    {
      code: 'BCP-SELF-SERVICE',
      name: 'Self-Service Portal Continuity Plan',
      version: '1.0',
      status: BCPPlanStatus.APPROVED,
      processCode: 'BIA-SELF-SERVICE',
      steps: [
        { step: 1, title: 'Failover to DR', description: 'Failover portal to DR environment' },
        { step: 2, title: 'Verify Services', description: 'Verify all portal services are operational' },
      ],
    },
  ];

  for (const bcpData of bcpPlans) {
    const processId = bcpData.processCode ? biaProcessMap.get(bcpData.processCode) : undefined;

    let bcp = await bcpRepo.findOne({
      where: { code: bcpData.code, tenant_id: tenantId },
    });

    if (bcp) {
      bcp.name = bcpData.name;
      bcp.version = bcpData.version;
      bcp.status = bcpData.status;
      bcp.process_id = processId;
      bcp.steps = bcpData.steps as any;
      bcp = await bcpRepo.save(bcp);
    } else {
      bcp = bcpRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: bcpData.code,
        name: bcpData.name,
        version: bcpData.version,
        status: bcpData.status,
        process_id: processId,
        steps: bcpData.steps as any,
        created_by: userId,
      });
      bcp = await bcpRepo.save(bcp);
    }
  }

  console.log(`  ✅ Created/updated ${bcpPlans.length} BCP plans`);
}

/**
 * Seed Calendar Events
 */
async function seedCalendarEvents(
  ds: DataSource,
  tenantId: string,
  entityMap: Map<string, string>,
  engagementMap: Map<string, string>,
  riskInstanceMap: Map<string, string>,
  userId: string | undefined,
) {
  const calendarRepo = ds.getRepository(CalendarEventEntity);
  const { CalendarEventType, CalendarEventStatus } = await import(
    '../src/entities/app/calendar-event.entity'
  );

  const events = [
    {
      title: 'Q1 2025 Risk Review Meeting',
      description: 'Quarterly risk review meeting for all open risks',
      eventType: CalendarEventType.RISK_REVIEW,
      startAt: '2025-03-15T10:00:00',
      endAt: '2025-03-15T12:00:00',
      status: CalendarEventStatus.CONFIRMED,
      sourceModule: 'risk',
      sourceEntity: 'risk_instance',
    },
    {
      title: 'ISO 27001 Audit Engagement - Data Center',
      description: 'Data Center Security Controls Audit engagement',
      eventType: CalendarEventType.AUDIT_ENGAGEMENT,
      startAt: '2025-02-10T09:00:00',
      endAt: '2025-02-14T17:00:00',
      status: CalendarEventStatus.CONFIRMED,
      sourceModule: 'audit',
      sourceEntity: 'audit_engagement',
      sourceId: engagementMap.get('ENG-2025-ISO27001-DC-001'),
    },
    {
      title: 'Monthly Control Testing',
      description: 'Monthly testing of critical security controls',
      eventType: CalendarEventType.CONTROL_TEST,
      startAt: '2025-03-01T09:00:00',
      endAt: '2025-03-01T17:00:00',
      status: CalendarEventStatus.PLANNED,
      sourceModule: 'control',
    },
    {
      title: 'Data Center Maintenance Window',
      description: 'Scheduled maintenance for primary data center',
      eventType: CalendarEventType.MAINTENANCE,
      startAt: '2025-03-20T02:00:00',
      endAt: '2025-03-20T06:00:00',
      status: CalendarEventStatus.PLANNED,
      sourceModule: 'entity',
      sourceEntity: 'entity',
      sourceId: entityMap.get('DC-ISTANBUL-PRIMARY'),
    },
    {
      title: 'BCP Exercise - DR Test',
      description: 'Quarterly disaster recovery exercise',
      eventType: CalendarEventType.BCP_EXERCISE,
      startAt: '2025-03-25T08:00:00',
      endAt: '2025-03-25T16:00:00',
      status: CalendarEventStatus.PLANNED,
      sourceModule: 'bcm',
    },
  ];

  for (const eventData of events) {
    let event = await calendarRepo.findOne({
      where: {
        title: eventData.title,
        tenant_id: tenantId,
      },
    });

    if (event) {
      event.description = eventData.description;
      event.event_type = eventData.eventType;
      event.start_at = new Date(eventData.startAt);
      event.end_at = eventData.endAt ? new Date(eventData.endAt) : undefined;
      event.status = eventData.status;
      event.source_module = eventData.sourceModule;
      event.source_entity = eventData.sourceEntity;
      event.source_id = eventData.sourceId;
      event = await calendarRepo.save(event);
    } else {
      event = calendarRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        title: eventData.title,
        description: eventData.description,
        event_type: eventData.eventType,
        start_at: new Date(eventData.startAt),
        end_at: eventData.endAt ? new Date(eventData.endAt) : undefined,
        status: eventData.status,
        source_module: eventData.sourceModule,
        source_entity: eventData.sourceEntity,
        source_id: eventData.sourceId,
        owner_user_id: userId,
        created_by: userId,
      });
      event = await calendarRepo.save(event);
    }
  }

  console.log(`  ✅ Created/updated ${events.length} calendar events`);
}

/**
 * Print final statistics
 */
async function printStatistics(ds: DataSource, tenantId: string) {
  const controlRepo = ds.getRepository(ControlLibraryEntity);
  const policyRepo = ds.getRepository(PolicyEntity);
  const riskRepo = ds.getRepository(RiskCatalogEntity);
  const riskInstanceRepo = ds.getRepository(RiskInstanceEntity);
  const auditPlanRepo = ds.getRepository(AuditPlanEntity);
  const auditEngagementRepo = ds.getRepository(AuditEngagementEntity);
  const auditFindingRepo = ds.getRepository(AuditFindingEntity);
  const capRepo = ds.getRepository(CorrectiveActionEntity);
  const biaRepo = ds.getRepository(BIAProcessEntity);
  const bcpRepo = ds.getRepository(BCPPlanEntity);
  const entityRepo = ds.getRepository(EntityEntity);
  const controlToPolicyRepo = ds.getRepository(ControlToPolicyEntity);
  const controlToCapRepo = ds.getRepository(ControlToCapEntity);
  const riskToControlRepo = ds.getRepository(RiskToControlEntity);

  const [
    controlCount,
    policyCount,
    riskCount,
    riskInstanceCount,
    auditPlanCount,
    auditEngagementCount,
    auditFindingCount,
    capCount,
    biaCount,
    bcpCount,
    entityCount,
    controlPolicyLinks,
    controlCapLinks,
    riskControlLinks,
  ] = await Promise.all([
    controlRepo.count({ where: { tenant_id: tenantId } }),
    policyRepo.count({ where: { tenant_id: tenantId } }),
    riskRepo.count({ where: { tenant_id: tenantId } }),
    riskInstanceRepo.count({ where: { tenant_id: tenantId } }),
    auditPlanRepo.count({ where: { tenant_id: tenantId } }),
    auditEngagementRepo.count({ where: { tenant_id: tenantId } }),
    auditFindingRepo.count({ where: { tenant_id: tenantId } }),
    capRepo.count({ where: { tenant_id: tenantId } }),
    biaRepo.count({ where: { tenant_id: tenantId } }),
    bcpRepo.count({ where: { tenant_id: tenantId } }),
    entityRepo.count({ where: { tenant_id: tenantId } }),
    controlToPolicyRepo.count({ where: { tenant_id: tenantId } }),
    controlToCapRepo.count({ where: { tenant_id: tenantId } }),
    riskToControlRepo.count({ where: { tenant_id: tenantId } }),
  ]);

  console.log(`  📊 Entities: ${entityCount}`);
  console.log(`  📊 Controls: ${controlCount}`);
  console.log(`  📊 Policies: ${policyCount}`);
  console.log(`  📊 Risks (Catalog): ${riskCount}`);
  console.log(`  📊 Risk Instances: ${riskInstanceCount}`);
  console.log(`  📊 Audit Plans: ${auditPlanCount}`);
  console.log(`  📊 Audit Engagements: ${auditEngagementCount}`);
  console.log(`  📊 Audit Findings: ${auditFindingCount}`);
  console.log(`  📊 CAPs: ${capCount}`);
  console.log(`  📊 BIA Processes: ${biaCount}`);
  console.log(`  📊 BCP Plans: ${bcpCount}`);
  console.log(`  📊 Control-Policy Links: ${controlPolicyLinks}`);
  console.log(`  📊 Control-CAP Links: ${controlCapLinks}`);
  console.log(`  📊 Risk-Control Links: ${riskControlLinks}`);
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function run() {
  const entities = [
    TenantEntity,
    UserEntity,
    EntityTypeEntity,
    EntityEntity,
    StandardEntity,
    StandardClauseEntity,
    ControlLibraryEntity,
    ControlToClauseEntity,
    ControlToPolicyEntity,
    ControlToCapEntity,
    PolicyEntity,
    PolicyStandardEntity,
    RiskCategoryEntity,
    RiskCatalogEntity,
    RiskCatalogAttachmentEntity,
    RiskInstanceEntity,
    RiskInstanceAttachmentEntity,
    RiskToControlEntity,
    RiskToPolicyEntity,
    RiskToRequirementEntity,
    RequirementEntity,
    RegulationEntity,
    AuditPlanEntity,
    AuditEngagementEntity,
    AuditTestEntity,
    AuditEvidenceEntity,
    AuditFindingEntity,
    CorrectiveActionEntity,
    BIAProcessEntity,
    BIAProcessDependencyEntity,
    BCPPlanEntity,
    BCPExerciseEntity,
    CalendarEventEntity,
  ];

  const options = determineDataSourceOptions();
  (options as any).entities = entities;
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting GRC Demo Experience seed...\n');
    console.log('📌 Scenario: Polaris Telekom A.Ş.\n');

    const tenant = await ensureTenant(dataSource);
    const demoUser = await getDemoUser(dataSource, tenant.id);
    console.log('');

    console.log('📦 Step 1: Seeding Entity Types and Entities...');
    const entityMap = await seedEntities(dataSource, tenant.id, demoUser?.id);
    console.log('');

    console.log('📦 Step 2: Seeding Standards and Clauses...');
    const standardMap = await seedStandards(dataSource, tenant.id);
    const clauseMap = await seedClauses(dataSource, tenant.id, standardMap);
    console.log('');

        console.log('📦 Step 3: Seeding Controls...');
        const controlMap = await seedControls(dataSource, tenant.id, clauseMap);
        console.log('');

        console.log('📦 Step 3.5: Linking Controls to Clauses...');
        await linkControlsToClauses(dataSource, tenant.id, controlMap, clauseMap);
        console.log('');

        console.log('📦 Step 4: Seeding Policies...');
    const policyMap = await seedPolicies(dataSource, tenant.id, demoUser?.id, standardMap);
    console.log('');

    console.log('📦 Step 5: Linking Controls to Policies...');
    await linkControlsToPolicies(dataSource, tenant.id, controlMap, policyMap);
    console.log('');

    console.log('📦 Step 6: Seeding Risk Categories and Catalog...');
    const riskCategoryMap = await seedRiskCategories(dataSource, tenant.id);
    const riskCatalogMap = await seedRiskCatalog(dataSource, tenant.id, riskCategoryMap);
    console.log('');

    console.log('📦 Step 7: Linking Controls to Risks...');
    await linkControlsToRisks(dataSource, tenant.id, controlMap, riskCatalogMap);
    console.log('');

    console.log('📦 Step 8: Seeding Risk Instances...');
    const riskInstanceMap = await seedRiskInstances(
      dataSource,
      tenant.id,
      riskCatalogMap,
      entityMap,
      demoUser?.id,
    );
    console.log('');

    console.log('📦 Step 9: Seeding Audit Plans and Engagements...');
    const auditPlanMap = await seedAuditPlans(dataSource, tenant.id, demoUser?.id);
    const auditEngagementMap = await seedAuditEngagements(
      dataSource,
      tenant.id,
      auditPlanMap,
      demoUser?.id,
    );
    console.log('');

    console.log('📦 Step 10: Seeding Audit Findings...');
    const auditFindingMap = await seedAuditFindings(
      dataSource,
      tenant.id,
      auditEngagementMap,
      controlMap,
      clauseMap,
      policyMap,
      riskInstanceMap,
      demoUser?.id,
    );
    console.log('');

    console.log('📦 Step 11: Seeding Corrective Action Plans (CAPs)...');
    const capMap = await seedCAPs(dataSource, tenant.id, auditFindingMap, demoUser?.id);
    console.log('');

    console.log('📦 Step 12: Linking Controls to CAPs...');
    await linkControlsToCAPs(dataSource, tenant.id, controlMap, capMap);
    console.log('');

    console.log('📦 Step 13: Seeding BIA Processes...');
    const biaProcessMap = await seedBIAProcesses(dataSource, tenant.id, entityMap, demoUser?.id);
    console.log('');

    console.log('📦 Step 14: Seeding BCP Plans...');
    await seedBCPPlans(dataSource, tenant.id, biaProcessMap, demoUser?.id);
    console.log('');

    console.log('📦 Step 15: Seeding Calendar Events...');
    await seedCalendarEvents(
      dataSource,
      tenant.id,
      entityMap,
      auditEngagementMap,
      riskInstanceMap,
      demoUser?.id,
    );
    console.log('');

    console.log('📊 Final Statistics:');
    await printStatistics(dataSource, tenant.id);
    
    console.log('\n✅ Demo Experience seed completed successfully!');
  } catch (error) {
    console.error('❌ Demo Experience seed failed', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    }
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

