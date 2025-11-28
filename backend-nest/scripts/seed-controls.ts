#!/usr/bin/env ts-node
/**
 * Seed Controls
 * 
 * Seeds control library with realistic GRC controls linked to standard clauses.
 * 
 * Usage: npm run seed:controls
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { ControlLibraryEntity } from '../src/entities/app/control-library.entity';
import { StandardClauseEntity } from '../src/entities/app/standard-clause.entity';
import { StandardEntity } from '../src/entities/app/standard.entity';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Controls data - linked to standard clauses
const controls = [
  // ISO 27001 Controls
  {
    code: 'CTL-ISO27001-A.5.1.1',
    name: 'Information Security Policy Management',
    description: 'Policies for information security are defined, approved, published, communicated, and reviewed at planned intervals.',
    family: 'Governance',
    effectiveness: 0.85,
    standardCode: 'ISO27001',
    clauseCode: 'A.5.1.1',
  },
  {
    code: 'CTL-ISO27001-A.5.2.1',
    name: 'Roles and Responsibilities Assignment',
    description: 'Roles and responsibilities for information security are defined and allocated.',
    family: 'Governance',
    effectiveness: 0.80,
    standardCode: 'ISO27001',
    clauseCode: 'A.5.2.1',
  },
  {
    code: 'CTL-ISO27001-A.9.1.1',
    name: 'Access Control Policy',
    description: 'An access control policy is established, documented, and reviewed based on business and information security requirements.',
    family: 'Access Control',
    effectiveness: 0.90,
    standardCode: 'ISO27001',
    clauseCode: 'A.9.1.1',
  },
  {
    code: 'CTL-ISO27001-A.9.2.1',
    name: 'User Registration and De-registration',
    description: 'A formal user registration and de-registration process is implemented to enable assignment of access rights.',
    family: 'Access Control',
    effectiveness: 0.85,
    standardCode: 'ISO27001',
    clauseCode: 'A.9.2.1',
  },
  {
    code: 'CTL-ISO27001-A.9.3.1',
    name: 'Management of Secret Authentication Information',
    description: 'Secret authentication information is managed securely, including password policies, MFA, and credential storage.',
    family: 'Access Control',
    effectiveness: 0.88,
    standardCode: 'ISO27001',
    clauseCode: 'A.9.3.1',
  },
  {
    code: 'CTL-ISO27001-A.10.1.1',
    name: 'Cryptographic Controls Policy',
    description: 'A policy on the use of cryptographic controls for protection of information is developed and implemented.',
    family: 'Cryptography',
    effectiveness: 0.82,
    standardCode: 'ISO27001',
    clauseCode: 'A.10.1.1',
  },
  {
    code: 'CTL-ISO27001-A.12.2.1',
    name: 'Change Management',
    description: 'Changes to information processing facilities and systems are controlled through a formal change management process.',
    family: 'Change Management',
    effectiveness: 0.87,
    standardCode: 'ISO27001',
    clauseCode: 'A.12.2.1',
  },
  {
    code: 'CTL-ISO27001-A.13.1.1',
    name: 'Network Security Management',
    description: 'Networks are managed and controlled to protect information in systems and applications.',
    family: 'Network Security',
    effectiveness: 0.83,
    standardCode: 'ISO27001',
    clauseCode: 'A.13.1.1',
  },
  {
    code: 'CTL-ISO27001-A.15.1.1',
    name: 'Information Security in Supplier Relationships',
    description: 'Processes and procedures are established and applied to manage information security in supplier relationships.',
    family: 'Supplier Management',
    effectiveness: 0.75,
    standardCode: 'ISO27001',
    clauseCode: 'A.15.1.1',
  },
  {
    code: 'CTL-ISO27001-A.16.1.1',
    name: 'Information Security Incident Management',
    description: 'Information security events are assessed and classified as information security incidents when appropriate.',
    family: 'Incident Management',
    effectiveness: 0.88,
    standardCode: 'ISO27001',
    clauseCode: 'A.16.1.1',
  },
  {
    code: 'CTL-ISO27001-A.17.1.1',
    name: 'Information Security Continuity',
    description: 'Information security continuity is embedded in the organization\'s business continuity management systems.',
    family: 'Business Continuity',
    effectiveness: 0.80,
    standardCode: 'ISO27001',
    clauseCode: 'A.17.1.1',
  },
  {
    code: 'CTL-ISO27001-A.8.1.1',
    name: 'Asset Inventory Management',
    description: 'Assets associated with information and information processing facilities are identified and an inventory is maintained.',
    family: 'Asset Management',
    effectiveness: 0.85,
    standardCode: 'ISO27001',
    clauseCode: 'A.8.1.1',
  },
  {
    code: 'CTL-ISO27001-A.8.2.1',
    name: 'Information Classification',
    description: 'Information is classified in terms of legal requirements, value, criticality and sensitivity to unauthorized disclosure or modification.',
    family: 'Asset Management',
    effectiveness: 0.78,
    standardCode: 'ISO27001',
    clauseCode: 'A.8.2.1',
  },
  {
    code: 'CTL-ISO27001-A.7.1.1',
    name: 'Physical Security Perimeters',
    description: 'Physical security perimeters are defined and used to protect areas containing sensitive or critical information and information processing facilities.',
    family: 'Physical Security',
    effectiveness: 0.90,
    standardCode: 'ISO27001',
    clauseCode: 'A.7.1.1',
  },
  {
    code: 'CTL-ISO27001-A.7.2.1',
    name: 'Physical Entry Controls',
    description: 'Secure areas are protected by appropriate entry controls to ensure that only authorized personnel are allowed access.',
    family: 'Physical Security',
    effectiveness: 0.92,
    standardCode: 'ISO27001',
    clauseCode: 'A.7.2.1',
  },
  // ISO 9001 Controls
  {
    code: 'CTL-ISO9001-8.3.2',
    name: 'Design and Development Planning',
    description: 'Design and development planning is established, implemented, and maintained for products and services.',
    family: 'Quality Management',
    effectiveness: 0.85,
    standardCode: 'ISO9001',
    clauseCode: '8.3',
  },
  {
    code: 'CTL-ISO9001-8.4.1',
    name: 'Control of Externally Provided Processes',
    description: 'Externally provided processes, products, and services conform to specified requirements.',
    family: 'Quality Management',
    effectiveness: 0.80,
    standardCode: 'ISO9001',
    clauseCode: '8.4',
  },
  {
    code: 'CTL-ISO9001-9.2.1',
    name: 'Internal Audit Program',
    description: 'Internal audits are conducted at planned intervals to verify conformity of the quality management system.',
    family: 'Quality Management',
    effectiveness: 0.88,
    standardCode: 'ISO9001',
    clauseCode: '9.2',
  },
  {
    code: 'CTL-ISO9001-10.2.1',
    name: 'Nonconformity and Corrective Action',
    description: 'When nonconformities occur, the organization reacts, controls, and corrects them, and deals with consequences.',
    family: 'Quality Management',
    effectiveness: 0.82,
    standardCode: 'ISO9001',
    clauseCode: '10.2',
  },
  // ISO 31000 Controls
  {
    code: 'CTL-ISO31000-6.2',
    name: 'Risk Identification Process',
    description: 'The organization identifies sources of risk, areas of impacts, events, their causes, and potential consequences.',
    family: 'Risk Management',
    effectiveness: 0.85,
    standardCode: 'ISO31000',
    clauseCode: '6.2',
  },
  {
    code: 'CTL-ISO31000-6.3',
    name: 'Risk Analysis Process',
    description: 'Risk analysis involves consideration of causes, sources, positive and negative consequences, and likelihood.',
    family: 'Risk Management',
    effectiveness: 0.83,
    standardCode: 'ISO31000',
    clauseCode: '6.3',
  },
  {
    code: 'CTL-ISO31000-6.4',
    name: 'Risk Evaluation Process',
    description: 'Risk evaluation involves comparing risk analysis results with risk criteria to determine acceptability.',
    family: 'Risk Management',
    effectiveness: 0.80,
    standardCode: 'ISO31000',
    clauseCode: '6.4',
  },
  {
    code: 'CTL-ISO31000-6.5',
    name: 'Risk Treatment Process',
    description: 'Risk treatment involves selecting and implementing options for modifying risk.',
    family: 'Risk Management',
    effectiveness: 0.78,
    standardCode: 'ISO31000',
    clauseCode: '6.5',
  },
  // ISO 22301 Controls
  {
    code: 'CTL-ISO22301-8.2',
    name: 'Business Impact Analysis',
    description: 'Business impact analysis is conducted to determine the impact of disruption on organizational activities.',
    family: 'Business Continuity',
    effectiveness: 0.85,
    standardCode: 'ISO22301',
    clauseCode: '8.2',
  },
  {
    code: 'CTL-ISO22301-8.3',
    name: 'Risk Assessment for Business Continuity',
    description: 'Risk assessment is conducted to identify risks that could cause disruption to organizational activities.',
    family: 'Business Continuity',
    effectiveness: 0.82,
    standardCode: 'ISO22301',
    clauseCode: '8.3',
  },
  {
    code: 'CTL-ISO22301-8.4',
    name: 'Business Continuity Strategy',
    description: 'Business continuity strategies are determined and selected based on BIA and risk assessment results.',
    family: 'Business Continuity',
    effectiveness: 0.80,
    standardCode: 'ISO22301',
    clauseCode: '8.4',
  },
  {
    code: 'CTL-ISO22301-8.6',
    name: 'Business Continuity Exercising and Testing',
    description: 'Business continuity procedures and plans are exercised and tested to ensure effectiveness and currency.',
    family: 'Business Continuity',
    effectiveness: 0.75,
    standardCode: 'ISO22301',
    clauseCode: '8.6',
  },
  // PCI DSS Controls
  {
    code: 'CTL-PCI-DSS-1.1',
    name: 'Network Security Controls Installation',
    description: 'Network security controls (firewalls) are installed and maintained.',
    family: 'Network Security',
    effectiveness: 0.95,
    standardCode: 'PCI-DSS',
    clauseCode: '1.1',
  },
  {
    code: 'CTL-PCI-DSS-3.1',
    name: 'Cardholder Data Storage Minimization',
    description: 'Cardholder data storage is kept to a minimum.',
    family: 'Data Protection',
    effectiveness: 0.88,
    standardCode: 'PCI-DSS',
    clauseCode: '3.1',
  },
  {
    code: 'CTL-PCI-DSS-4.1',
    name: 'Strong Cryptography for PAN Transmission',
    description: 'Primary account numbers are protected with strong cryptography during transmission over open, public networks.',
    family: 'Cryptography',
    effectiveness: 0.92,
    standardCode: 'PCI-DSS',
    clauseCode: '4.1',
  },
  {
    code: 'CTL-PCI-DSS-7.1',
    name: 'Access Restriction to Cardholder Data',
    description: 'Access to system components and cardholder data is restricted to only those individuals whose job requires such access.',
    family: 'Access Control',
    effectiveness: 0.90,
    standardCode: 'PCI-DSS',
    clauseCode: '7.1',
  },
  {
    code: 'CTL-PCI-DSS-8.1',
    name: 'User Identification and Authentication',
    description: 'User identification and authentication are managed via an authentication system.',
    family: 'Access Control',
    effectiveness: 0.93,
    standardCode: 'PCI-DSS',
    clauseCode: '8.1',
  },
  {
    code: 'CTL-PCI-DSS-10.1',
    name: 'Audit Log Implementation',
    description: 'Audit logs are implemented to link all access to system components to each individual user.',
    family: 'Logging and Monitoring',
    effectiveness: 0.87,
    standardCode: 'PCI-DSS',
    clauseCode: '10.1',
  },
  // Generic/Cross-cutting Controls
  {
    code: 'CTL-GEN-001',
    name: 'Backup Management',
    description: 'Regular backups of critical data and systems are performed, tested, and stored securely.',
    family: 'Data Protection',
    effectiveness: 0.85,
    standardCode: null,
    clauseCode: null,
  },
  {
    code: 'CTL-GEN-002',
    name: 'Vulnerability Management',
    description: 'Security vulnerabilities are identified, assessed, prioritized, and remediated in a timely manner.',
    family: 'Security Operations',
    effectiveness: 0.80,
    standardCode: null,
    clauseCode: null,
  },
  {
    code: 'CTL-GEN-003',
    name: 'Security Awareness Training',
    description: 'Security awareness training is provided to all personnel on a regular basis.',
    family: 'Awareness and Training',
    effectiveness: 0.75,
    standardCode: null,
    clauseCode: null,
  },
  {
    code: 'CTL-GEN-004',
    name: 'Vendor Risk Assessment',
    description: 'Third-party vendors are assessed for security risks before engagement and monitored on an ongoing basis.',
    family: 'Supplier Management',
    effectiveness: 0.78,
    standardCode: null,
    clauseCode: null,
  },
];

async function run() {
  const entities = [
    TenantEntity,
    StandardEntity,
    StandardClauseEntity,
    ControlLibraryEntity,
  ];

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

  const findStandardClause = async (
    ds: DataSource,
    tenantId: string,
    standardCode: string | null,
    clauseCode: string | null,
  ): Promise<StandardClauseEntity | null> => {
    if (!standardCode || !clauseCode) {
      return null;
    }

    const standardRepo = ds.getRepository(StandardEntity);
    const standard = await standardRepo.findOne({
      where: { code: standardCode, tenant_id: tenantId },
    });

    if (!standard) {
      return null;
    }

    const clauseRepo = ds.getRepository(StandardClauseEntity);
    const clause = await clauseRepo.findOne({
      where: {
        standard_id: standard.id,
        clause_code: clauseCode,
        tenant_id: tenantId,
      },
    });

    return clause;
  };

  const ensureControl = async (
    ds: DataSource,
    tenantId: string,
    controlData: typeof controls[0],
  ) => {
    const controlRepo = ds.getRepository(ControlLibraryEntity);
    let control = await controlRepo.findOne({
      where: { code: controlData.code, tenant_id: tenantId },
    });

    // Find clause if specified
    let clauseId: string | undefined = undefined;
    if (controlData.standardCode && controlData.clauseCode) {
      const clause = await findStandardClause(
        ds,
        tenantId,
        controlData.standardCode,
        controlData.clauseCode,
      );
      if (clause) {
        clauseId = clause.id;
      }
    }

    if (control) {
      control.name = controlData.name;
      control.description = controlData.description;
      control.family = controlData.family;
      control.effectiveness = controlData.effectiveness;
      control.clause_id = clauseId;
      control = await controlRepo.save(control);
      console.log(`  ✅ Updated control: ${controlData.code}`);
    } else {
      control = controlRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: controlData.code,
        name: controlData.name,
        description: controlData.description,
        family: controlData.family,
        effectiveness: controlData.effectiveness,
        clause_id: clauseId,
      });
      control = await controlRepo.save(control);
      console.log(`  ✅ Created control: ${controlData.code}`);
    }

    return control;
  };

  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('🌱 Starting controls seed...\n');

    const tenant = await ensureTenant(dataSource);
    console.log('');

    for (const controlData of controls) {
      await ensureControl(dataSource, tenant.id, controlData);
    }

    console.log('\n✅ Controls seed completed');
  } catch (error) {
    console.error('❌ Controls seed failed', error);
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

