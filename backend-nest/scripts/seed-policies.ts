#!/usr/bin/env ts-node
/**
 * Seed Policies
 * 
 * Seeds governance policies with realistic content linked to standards.
 * 
 * Usage: npm run seed:policies
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { PolicyEntity } from '../src/entities/app/policy.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Policies data
const policies = [
  {
    code: 'POL-SEC-001',
    title: 'Information Security Policy',
    status: 'approved',
    ownerFirstName: 'GRC',
    ownerLastName: 'Admin',
    effectiveDate: '2024-01-01',
    reviewDate: '2025-01-01',
    content: `# Information Security Policy

## 1. Purpose
This policy establishes the framework for managing information security across the organization to protect information assets from threats and vulnerabilities.

## 2. Scope
This policy applies to all employees, contractors, vendors, and third parties who access organizational information systems and data.

## 3. Policy Statement
The organization is committed to protecting the confidentiality, integrity, and availability of information assets through the implementation of appropriate security controls and practices.

## 4. Responsibilities
- **Management**: Establish and maintain the information security management system
- **IT Security**: Implement and monitor security controls
- **All Personnel**: Comply with security policies and procedures

## 5. Key Requirements
- All information must be classified according to sensitivity
- Access controls must be implemented based on the principle of least privilege
- Security incidents must be reported immediately
- Regular security awareness training must be provided

## 6. Compliance
This policy aligns with ISO/IEC 27001:2022 requirements, particularly clauses A.5.1.1 and A.5.2.1.

## 7. Review
This policy shall be reviewed annually or when significant changes occur.`,
    standardCodes: ['ISO27001'],
  },
  {
    code: 'POL-ACC-001',
    title: 'Access Management Policy',
    status: 'approved',
    ownerFirstName: 'IT',
    ownerLastName: 'Security',
    effectiveDate: '2024-02-01',
    reviewDate: '2025-02-01',
    content: `# Access Management Policy

## 1. Purpose
To ensure that access to information systems and data is granted only to authorized individuals based on business requirements and the principle of least privilege.

## 2. Scope
This policy applies to all information systems, applications, databases, and network resources.

## 3. Access Control Requirements
- User accounts must be created only for authorized personnel
- Access rights must be reviewed quarterly
- Privileged access must be granted only when necessary
- Access must be revoked immediately upon termination

## 4. Authentication
- Strong passwords are required (minimum 12 characters)
- Multi-factor authentication is mandatory for privileged accounts
- Password changes are required every 90 days

## 5. Compliance
This policy aligns with ISO/IEC 27001:2022 clause A.9.1.1 (Access Control Policy) and A.9.2.1 (User Registration).`,
    standardCodes: ['ISO27001'],
  },
  {
    code: 'POL-BKP-001',
    title: 'Backup and Recovery Policy',
    status: 'approved',
    ownerFirstName: 'IT',
    ownerLastName: 'Operations',
    effectiveDate: '2024-01-15',
    reviewDate: '2025-01-15',
    content: `# Backup and Recovery Policy

## 1. Purpose
To ensure that critical data and systems are backed up regularly and can be recovered in the event of data loss or system failure.

## 2. Backup Requirements
- Critical systems must be backed up daily
- Backups must be stored off-site
- Backup integrity must be tested monthly
- Retention period: 90 days for daily backups, 1 year for monthly backups

## 3. Recovery Objectives
- Recovery Time Objective (RTO): 4 hours for critical systems
- Recovery Point Objective (RPO): 24 hours for critical data

## 4. Responsibilities
- IT Operations: Perform backups and maintain backup systems
- IT Security: Ensure backup security and encryption
- Business Units: Identify critical data and systems

## 5. Compliance
This policy supports ISO/IEC 27001:2022 clause A.12.3.1 (Information Backup) and ISO 22301:2019 business continuity requirements.`,
    standardCodes: ['ISO27001', 'ISO22301'],
  },
  {
    code: 'POL-CHG-001',
    title: 'Change Management Policy',
    status: 'approved',
    ownerFirstName: 'IT',
    ownerLastName: 'Operations',
    effectiveDate: '2024-03-01',
    reviewDate: '2025-03-01',
    content: `# Change Management Policy

## 1. Purpose
To ensure that all changes to information systems are planned, tested, approved, and implemented in a controlled manner to minimize risks.

## 2. Change Categories
- **Emergency**: Critical security patches, system outages
- **Standard**: Routine updates, feature enhancements
- **Normal**: Planned upgrades, new implementations

## 3. Change Process
1. Change request submission
2. Impact assessment
3. Approval (based on risk level)
4. Testing in non-production environment
5. Implementation during maintenance window
6. Post-implementation review

## 4. Compliance
This policy aligns with ISO/IEC 27001:2022 clause A.12.2.1 (Change Management) and ISO 9001:2015 clause 8.5.6 (Control of Changes).`,
    standardCodes: ['ISO27001', 'ISO9001'],
  },
  {
    code: 'POL-VDR-001',
    title: 'Vendor Management Policy',
    status: 'approved',
    ownerFirstName: 'Procurement',
    ownerLastName: 'Manager',
    effectiveDate: '2024-02-15',
    reviewDate: '2025-02-15',
    content: `# Vendor Management Policy

## 1. Purpose
To ensure that third-party vendors and suppliers meet security and compliance requirements and do not introduce unacceptable risks.

## 2. Vendor Assessment
- Security questionnaires must be completed before engagement
- Vendor security controls must be verified
- Contracts must include security and compliance clauses
- Ongoing monitoring of vendor security posture

## 3. Risk Management
- High-risk vendors require additional security assessments
- Vendor access to systems must be monitored and logged
- Vendor incidents must be reported and managed

## 4. Compliance
This policy aligns with ISO/IEC 27001:2022 clause A.15.1.1 (Information Security in Supplier Relationships).`,
    standardCodes: ['ISO27001'],
  },
  {
    code: 'POL-QUAL-001',
    title: 'Quality Management Policy',
    status: 'approved',
    ownerFirstName: 'Quality',
    ownerLastName: 'Manager',
    effectiveDate: '2024-01-01',
    reviewDate: '2025-01-01',
    content: `# Quality Management Policy

## 1. Purpose
To establish a framework for maintaining and improving the quality of products and services through systematic quality management practices.

## 2. Quality Objectives
- Customer satisfaction: >90%
- Defect rate: <1%
- On-time delivery: >95%
- Continuous improvement initiatives

## 3. Quality Management System
- Documented procedures for all key processes
- Regular internal audits
- Management reviews
- Corrective and preventive actions

## 4. Compliance
This policy aligns with ISO 9001:2015 requirements, particularly clauses 5.2 (Policy) and 6.2 (Quality Objectives).`,
    standardCodes: ['ISO9001'],
  },
  {
    code: 'POL-BCM-001',
    title: 'Business Continuity Management Policy',
    status: 'approved',
    ownerFirstName: 'BCM',
    ownerLastName: 'Manager',
    effectiveDate: '2024-01-01',
    reviewDate: '2025-01-01',
    content: `# Business Continuity Management Policy

## 1. Purpose
To ensure the organization can continue critical business operations during and after disruptive events.

## 2. Business Continuity Framework
- Business Impact Analysis (BIA) for all critical processes
- Risk assessment for business continuity risks
- Business continuity plans for critical processes
- Regular testing and exercises

## 3. Recovery Objectives
- Maximum Tolerable Period of Disruption (MTPD): Defined per process
- Recovery Time Objective (RTO): Defined per process
- Recovery Point Objective (RPO): Defined per process

## 4. Compliance
This policy aligns with ISO 22301:2019 requirements, particularly clauses 5.2 (Policy) and 8.2 (Business Impact Analysis).`,
    standardCodes: ['ISO22301'],
  },
  {
    code: 'POL-PRIV-001',
    title: 'Data Privacy and Protection Policy',
    status: 'approved',
    ownerFirstName: 'Privacy',
    ownerLastName: 'Officer',
    effectiveDate: '2024-01-01',
    reviewDate: '2025-01-01',
    content: `# Data Privacy and Protection Policy

## 1. Purpose
To protect personal data and ensure compliance with applicable data protection regulations (GDPR, KVKK, etc.).

## 2. Data Protection Principles
- Lawfulness, fairness, and transparency
- Purpose limitation
- Data minimization
- Accuracy
- Storage limitation
- Integrity and confidentiality

## 3. Data Subject Rights
- Right to access
- Right to rectification
- Right to erasure
- Right to restrict processing
- Right to data portability
- Right to object

## 4. Compliance
This policy ensures compliance with GDPR, KVKK, and ISO/IEC 27001:2022 clause A.18.1.1 (Compliance with Legal Requirements).`,
    standardCodes: ['ISO27001'],
  },
  {
    code: 'POL-RISK-001',
    title: 'Risk Management Policy',
    status: 'in_review',
    ownerFirstName: 'Risk',
    ownerLastName: 'Manager',
    effectiveDate: '2024-04-01',
    reviewDate: '2025-04-01',
    content: `# Risk Management Policy

## 1. Purpose
To establish a systematic approach to identifying, assessing, treating, and monitoring risks across the organization.

## 2. Risk Management Framework
- Risk identification
- Risk analysis (likelihood and impact)
- Risk evaluation
- Risk treatment (mitigate, accept, transfer, avoid)
- Risk monitoring and review

## 3. Risk Appetite
- Low tolerance for information security risks
- Moderate tolerance for operational risks
- Risk acceptance requires management approval

## 4. Compliance
This policy aligns with ISO 31000:2018 requirements, particularly clauses 5.3 (Design) and 6.1-6.5 (Risk Assessment).`,
    standardCodes: ['ISO31000'],
  },
  {
    code: 'POL-INC-001',
    title: 'Incident Management Policy',
    status: 'approved',
    ownerFirstName: 'IT',
    ownerLastName: 'Security',
    effectiveDate: '2024-02-01',
    reviewDate: '2025-02-01',
    content: `# Incident Management Policy

## 1. Purpose
To ensure that security incidents are identified, contained, eradicated, and recovered from in a timely and effective manner.

## 2. Incident Classification
- **Critical**: Immediate business impact, data breach
- **High**: Significant business impact, system compromise
- **Medium**: Moderate business impact, security violation
- **Low**: Minor impact, policy violation

## 3. Incident Response Process
1. Detection and identification
2. Containment
3. Eradication
4. Recovery
5. Post-incident review

## 4. Compliance
This policy aligns with ISO/IEC 27001:2022 clause A.16.1.1 (Management of Information Security Incidents).`,
    standardCodes: ['ISO27001'],
  },
];

async function run() {
  const entities = [TenantEntity, PolicyEntity, StandardEntity, UserEntity];

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
        entities,
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
      entities,
      synchronize: false, // Use migrations, not synchronize
    };
  };

  const ensureTenant = async (ds: DataSource) => {
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
  };

  const getDemoUser = async (ds: DataSource, tenantId: string) => {
    const userRepo = ds.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { email: 'grc1@local', tenant_id: tenantId },
    });
    return user;
  };

  const ensurePolicy = async (
    ds: DataSource,
    tenantId: string,
    policyData: typeof policies[0],
    userId: string | undefined,
  ) => {
    const policyRepo = ds.getRepository(PolicyEntity);
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
      policy.content = policyData.content;
      policy.created_by = userId;
      policy = await policyRepo.save(policy);
      console.log(`  ✅ Updated policy: ${policyData.code}`);
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
        content: policyData.content,
        created_by: userId,
      });
      policy = await policyRepo.save(policy);
      console.log(`  ✅ Created policy: ${policyData.code}`);
    }

    return policy;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting policies seed...\n');

    const tenant = await ensureTenant(dataSource);
    const demoUser = await getDemoUser(dataSource, tenant.id);
    console.log('');

    for (const policyData of policies) {
      await ensurePolicy(dataSource, tenant.id, policyData, demoUser?.id);
    }

    console.log('\n✅ Policies seed completed');
  } catch (error) {
    console.error('❌ Policies seed failed', error);
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

