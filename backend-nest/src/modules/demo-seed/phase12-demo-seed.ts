#!/usr/bin/env ts-node

/**
 * Phase 12 Demo Seed Script
 * Seeds comprehensive demo data: entities, users, controls, risk catalog, instances, policy/compliance
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import {
  RiskCategoryEntity,
  RiskCatalogEntity,
  RiskInstanceEntity,
  EntityType,
  RiskStatus,
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  PolicyEntity,
  ImpactArea,
} from '../../entities/app';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { EntityEntity } from '../../entities/app/entity.entity';
import { UserEntity } from '../../entities/auth/user.entity';
import { RequirementEntity } from '../../modules/compliance/comp.entity';

config();

const TEST_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

// Mock Entity Registry (in production, would be a separate table/service)
interface DemoEntity {
  id: string;
  type: EntityType;
  code: string;
  name: string;
  criticality: number;
  owner_email: string;
}

const DEMO_ENTITIES: DemoEntity[] = [
  // Applications (8)
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-HR',
    name: 'HR Management System',
    criticality: 5,
    owner_email: 'ali.kilic@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-FIN',
    name: 'Financial System',
    criticality: 5,
    owner_email: 'ayse.demir@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-CRM',
    name: 'Customer CRM',
    criticality: 4,
    owner_email: 'mehmet.ekin@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-DATA',
    name: 'Data Warehouse',
    criticality: 4,
    owner_email: 'zeynep.kaya@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-MKT',
    name: 'Marketing Platform',
    criticality: 3,
    owner_email: 'cem.oz@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-OPS',
    name: 'Operations Dashboard',
    criticality: 3,
    owner_email: 'ali.kilic@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-ANL',
    name: 'Analytics Portal',
    criticality: 2,
    owner_email: 'ayse.demir@local',
  },
  {
    id: uuidv4(),
    type: EntityType.APPLICATION,
    code: 'APP-HLP',
    name: 'Help Desk',
    criticality: 1,
    owner_email: 'mehmet.ekin@local',
  },
  // Databases (3)
  {
    id: uuidv4(),
    type: EntityType.DATABASE,
    code: 'DB-HR',
    name: 'HR Database',
    criticality: 5,
    owner_email: 'ali.kilic@local',
  },
  {
    id: uuidv4(),
    type: EntityType.DATABASE,
    code: 'DB-FIN',
    name: 'Finance Database',
    criticality: 4,
    owner_email: 'ayse.demir@local',
  },
  {
    id: uuidv4(),
    type: EntityType.DATABASE,
    code: 'DB-CRM',
    name: 'CRM Database',
    criticality: 3,
    owner_email: 'mehmet.ekin@local',
  },
  // Services (3)
  {
    id: uuidv4(),
    type: EntityType.SERVICE,
    code: 'SVC-LOGIN',
    name: 'Authentication Service',
    criticality: 5,
    owner_email: 'zeynep.kaya@local',
  },
  {
    id: uuidv4(),
    type: EntityType.SERVICE,
    code: 'SVC-ETL',
    name: 'ETL Service',
    criticality: 4,
    owner_email: 'cem.oz@local',
  },
  {
    id: uuidv4(),
    type: EntityType.SERVICE,
    code: 'SVC-NOTIF',
    name: 'Notification Service',
    criticality: 3,
    owner_email: 'ali.kilic@local',
  },
];

async function seedPhase12Demo(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'grc',
    password: process.env.DB_PASS || '123456',
    database: process.env.DB_NAME || 'grc',
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
  });

  await ds.initialize();
  console.log('✅ Database connected for Phase 12 Demo Seed');

  // Store DataSource reference for Phase 14 seed
  (global as any).__phase12_datasource = ds;

  // 1. Users (5 users)
  const userRepo = ds.getRepository(UserEntity);
  const users: UserEntity[] = [];
  const userEmails = [
    'ali.kilic@local',
    'ayse.demir@local',
    'mehmet.ekin@local',
    'zeynep.kaya@local',
    'cem.oz@local',
  ];
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('📦 Seeding users...');
  for (const email of userEmails) {
    const existing = await userRepo.findOne({
      where: { email, tenant_id: TEST_TENANT_ID },
    });
    if (existing) {
      users.push(existing);
      console.log(`   Exists: ${email}`);
    } else {
      const user = userRepo.create({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        email,
        password_hash: passwordHash,
        display_name: email
          .split('@')[0]
          .replace('.', ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        is_email_verified: true,
        is_active: true,
      });
      const saved = await userRepo.save(user);
      users.push(saved);
      console.log(`   Created: ${email}`);
    }
  }

  // Helper: Get user by email
  const getUserByEmail = (email: string) =>
    users.find((u) => u.email === email);

  // 2. Risk Categories (ensure exists)
  const categoryRepo = ds.getRepository(RiskCategoryEntity);
  const securityCategory = await categoryRepo.findOne({
    where: { code: 'Security', tenant_id: TEST_TENANT_ID },
  });
  const operationalCategory = await categoryRepo.findOne({
    where: { code: 'Operational', tenant_id: TEST_TENANT_ID },
  });

  if (!securityCategory || !operationalCategory) {
    console.log('⚠️  Risk categories not found. Run test-seed.ts first.');
    await ds.destroy();
    throw new Error('Risk categories not found. Run test-seed.ts first.');
  }

  // 3. Controls (6 controls with effectiveness)
  const controlRepo = ds.getRepository(ControlLibraryEntity);
  const controls = [
    {
      code: 'CTRL-MFA',
      name: 'Multi-Factor Authentication',
      effectiveness: 0.6,
      family: 'Access Control',
    },
    {
      code: 'CTRL-PAM',
      name: 'Privileged Access Management',
      effectiveness: 0.5,
      family: 'Access Control',
    },
    {
      code: 'CTRL-SSO',
      name: 'Single Sign-On',
      effectiveness: 0.35,
      family: 'Access Control',
    },
    {
      code: 'CTRL-BKP',
      name: 'Automated Backups',
      effectiveness: 0.3,
      family: 'Data Protection',
    },
    {
      code: 'CTRL-LM',
      name: 'Logging & Monitoring',
      effectiveness: 0.25,
      family: 'Monitoring',
    },
    {
      code: 'CTRL-ENC',
      name: 'Data Encryption',
      effectiveness: 0.4,
      family: 'Data Protection',
    },
  ];

  console.log('📦 Seeding controls...');
  const savedControls: ControlLibraryEntity[] = [];
  for (const ctrl of controls) {
    const existing = await controlRepo.findOne({
      where: { code: ctrl.code, tenant_id: TEST_TENANT_ID },
    });
    if (existing) {
      await controlRepo.update(existing.id, {
        name: ctrl.name,
        family: ctrl.family,
        effectiveness: ctrl.effectiveness,
      });
      savedControls.push(existing);
      console.log(`   Updated: ${ctrl.code}`);
    } else {
      const control = controlRepo.create({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        code: ctrl.code,
        name: ctrl.name,
        family: ctrl.family,
        effectiveness: ctrl.effectiveness,
        description: `${ctrl.name} control with ${(ctrl.effectiveness * 100).toFixed(0)}% effectiveness`,
      });
      const saved = await controlRepo.save(control);
      savedControls.push(saved);
      console.log(`   Created: ${ctrl.code}`);
    }
  }

  // Helper: Get control by code
  const getControlByCode = (code: string) =>
    savedControls.find((c) => c.code === code);

  // 4. Risk Catalog (8-10 entries with all new fields)
  const riskCatalogRepo = ds.getRepository(RiskCatalogEntity);
  const riskCatalogs = [
    {
      code: 'R-UNAUTH-APP',
      title: 'Unauthorized Access to Applications',
      name: 'Unauthorized Access to Applications',
      risk_statement: 'Malicious actors gain unauthorized access to critical business applications, potentially compromising sensitive data and system integrity.',
      root_cause: 'Insufficient authentication mechanisms, weak password policies, and lack of multi-factor authentication.',
      category: securityCategory.id,
      entity_type: EntityType.APPLICATION,
      entity_filter: 'criticality>=4',
      default_inherent_likelihood: 3,
      default_inherent_impact: 4,
      impact_areas: [ImpactArea.CONFIDENTIALITY, ImpactArea.INTEGRITY, ImpactArea.AVAILABILITY],
      suggestedControls: ['CTRL-MFA', 'CTRL-SSO', 'CTRL-PAM'],
      owner_role: 'Security Owner',
    },
    {
      code: 'R-UNAUTH-DB',
      title: 'Unauthorized Access to Databases',
      name: 'Unauthorized Access to Databases',
      risk_statement: 'Unauthorized individuals access production databases containing sensitive customer or corporate data.',
      root_cause: 'Weak database access controls, excessive user privileges, and lack of network segmentation.',
      category: securityCategory.id,
      entity_type: EntityType.DATABASE,
      entity_filter: 'criticality>=4',
      default_inherent_likelihood: 2,
      default_inherent_impact: 5,
      impact_areas: [ImpactArea.CONFIDENTIALITY, ImpactArea.INTEGRITY, ImpactArea.COMPLIANCE],
      suggestedControls: ['CTRL-PAM', 'CTRL-ENC'],
      owner_role: 'Data Owner',
    },
    {
      code: 'R-DATALOSS-BKP',
      title: 'Data Loss - Backup Failure',
      name: 'Data Loss - Backup Failure',
      risk_statement: 'Critical business data is permanently lost due to backup system failures or inadequate recovery procedures.',
      root_cause: 'Inadequate backup procedures, lack of backup testing, and insufficient redundancy.',
      category: operationalCategory.id,
      entity_type: EntityType.DATABASE,
      entity_filter: 'criticality>=3',
      default_inherent_likelihood: 2,
      default_inherent_impact: 5,
      impact_areas: [ImpactArea.AVAILABILITY, ImpactArea.OPERATIONAL, ImpactArea.FINANCE],
      suggestedControls: ['CTRL-BKP'],
      owner_role: 'Data Owner',
    },
    {
      code: 'R-AUTH-SVC',
      title: 'Authentication Service Compromise',
      name: 'Authentication Service Compromise',
      risk_statement: 'Central authentication service is compromised, allowing unauthorized access to all connected systems.',
      root_cause: 'Vulnerabilities in authentication infrastructure, insufficient monitoring, and lack of service redundancy.',
      category: securityCategory.id,
      entity_type: EntityType.SERVICE,
      entity_filter: 'criticality>=5',
      default_inherent_likelihood: 2,
      default_inherent_impact: 5,
      impact_areas: [ImpactArea.CONFIDENTIALITY, ImpactArea.INTEGRITY, ImpactArea.AVAILABILITY],
      suggestedControls: ['CTRL-MFA', 'CTRL-PAM'],
      owner_role: 'Security Owner',
    },
    {
      code: 'R-DATA-ENC',
      title: 'Unencrypted Data Exposure',
      name: 'Unencrypted Data Exposure',
      risk_statement: 'Sensitive data stored or transmitted without encryption is exposed to unauthorized parties.',
      root_cause: 'Lack of encryption policies, misconfigured systems, and insufficient data classification.',
      category: securityCategory.id,
      entity_type: EntityType.DATABASE,
      entity_filter: 'criticality>=3',
      default_inherent_likelihood: 3,
      default_inherent_impact: 4,
      impact_areas: [ImpactArea.CONFIDENTIALITY, ImpactArea.COMPLIANCE, ImpactArea.LEGAL],
      suggestedControls: ['CTRL-ENC'],
      owner_role: 'Data Owner',
    },
    {
      code: 'R-APP-OBS',
      title: 'Application Obsolescence',
      name: 'Application Obsolescence',
      risk_statement: 'Legacy applications with unsupported technologies create security vulnerabilities and operational risks.',
      root_cause: 'Lack of application lifecycle management, insufficient IT budget allocation, and delayed modernization initiatives.',
      category: operationalCategory.id,
      entity_type: EntityType.APPLICATION,
      entity_filter: 'criticality>=3',
      default_inherent_likelihood: 4,
      default_inherent_impact: 3,
      impact_areas: [ImpactArea.OPERATIONAL, ImpactArea.AVAILABILITY],
      suggestedControls: ['CTRL-LM'],
      owner_role: 'Application Owner',
    },
    {
      code: 'R-RANSOMWARE',
      title: 'Ransomware Attack',
      name: 'Ransomware Attack',
      risk_statement: 'Malicious software encrypts critical systems and data, demanding ransom payment for decryption keys.',
      root_cause: 'Insufficient endpoint protection, lack of user awareness training, and unpatched system vulnerabilities.',
      category: securityCategory.id,
      entity_type: EntityType.APPLICATION,
      entity_filter: 'criticality>=4',
      default_inherent_likelihood: 3,
      default_inherent_impact: 5,
      impact_areas: [ImpactArea.AVAILABILITY, ImpactArea.OPERATIONAL, ImpactArea.FINANCE, ImpactArea.REPUTATION],
      suggestedControls: ['CTRL-ENC', 'CTRL-BKP'],
      owner_role: 'Security Owner',
    },
    {
      code: 'R-VENDOR-BREACH',
      title: 'Third-Party Vendor Data Breach',
      name: 'Third-Party Vendor Data Breach',
      risk_statement: 'Vendor systems storing our data are compromised, leading to unauthorized disclosure of sensitive information.',
      root_cause: 'Insufficient vendor risk assessments, weak contractual security requirements, and lack of vendor monitoring.',
      category: securityCategory.id,
      entity_type: EntityType.VENDOR,
      entity_filter: 'criticality>=3',
      default_inherent_likelihood: 2,
      default_inherent_impact: 4,
      impact_areas: [ImpactArea.CONFIDENTIALITY, ImpactArea.COMPLIANCE, ImpactArea.REPUTATION, ImpactArea.LEGAL],
      suggestedControls: [],
      owner_role: 'Vendor Manager',
    },
    {
      code: 'R-SERVICE-OUTAGE',
      title: 'Critical Service Outage',
      name: 'Critical Service Outage',
      risk_statement: 'Extended downtime of critical business services due to infrastructure failures or cyber attacks.',
      root_cause: 'Single points of failure, insufficient redundancy, inadequate disaster recovery planning.',
      category: operationalCategory.id,
      entity_type: EntityType.SERVICE,
      entity_filter: 'criticality>=5',
      default_inherent_likelihood: 2,
      default_inherent_impact: 5,
      impact_areas: [ImpactArea.AVAILABILITY, ImpactArea.OPERATIONAL, ImpactArea.FINANCE, ImpactArea.REPUTATION],
      suggestedControls: [],
      owner_role: 'Infrastructure Owner',
    },
    {
      code: 'R-COMPLIANCE-FAIL',
      title: 'Regulatory Compliance Failure',
      name: 'Regulatory Compliance Failure',
      risk_statement: 'Organization fails to meet regulatory requirements, resulting in fines, sanctions, or legal action.',
      root_cause: 'Insufficient compliance monitoring, lack of regulatory awareness, and inadequate control implementation.',
      category: securityCategory.id,
      entity_type: EntityType.APPLICATION,
      entity_filter: 'criticality>=3',
      default_inherent_likelihood: 3,
      default_inherent_impact: 4,
      impact_areas: [ImpactArea.COMPLIANCE, ImpactArea.LEGAL, ImpactArea.FINANCE, ImpactArea.REPUTATION],
      suggestedControls: [],
      owner_role: 'Compliance Officer',
    },
  ];

  console.log('📦 Seeding risk catalog...');
  const savedCatalogs: RiskCatalogEntity[] = [];
  for (const rc of riskCatalogs) {
    const existing = await riskCatalogRepo.findOne({
      where: { code: rc.code, tenant_id: TEST_TENANT_ID },
    });
    if (existing) {
      const inherentLikelihood = rc.default_inherent_likelihood ?? rc.default_likelihood ?? 3;
      const inherentImpact = rc.default_inherent_impact ?? rc.default_impact ?? 3;
      await riskCatalogRepo.update(existing.id, {
        title: rc.title || rc.name,
        name: rc.name || rc.title,
        risk_statement: rc.risk_statement,
        root_cause: rc.root_cause,
        category_id: rc.category,
        entity_type: rc.entity_type,
        entity_filter: rc.entity_filter,
        default_inherent_likelihood: inherentLikelihood,
        default_inherent_impact: inherentImpact,
        default_inherent_score: inherentLikelihood * inherentImpact,
        default_likelihood: inherentLikelihood,
        default_impact: inherentImpact,
        impact_areas: rc.impact_areas || [],
        control_refs: rc.suggestedControls
          .map((c) => getControlByCode(c)?.id || '')
          .filter(Boolean),
        owner_role: rc.owner_role,
      });
      savedCatalogs.push(existing);
      console.log(`   Updated: ${rc.code}`);
    } else {
      const inherentLikelihood = rc.default_inherent_likelihood ?? rc.default_likelihood ?? 3;
      const inherentImpact = rc.default_inherent_impact ?? rc.default_impact ?? 3;
      const catalog = riskCatalogRepo.create({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        code: rc.code,
        title: rc.title || rc.name,
        name: rc.name || rc.title,
        risk_statement: rc.risk_statement,
        root_cause: rc.root_cause,
        description: `Demo risk catalog entry: ${rc.name || rc.title}`,
        category_id: rc.category,
        entity_type: rc.entity_type,
        entity_filter: rc.entity_filter,
        default_inherent_likelihood: inherentLikelihood,
        default_inherent_impact: inherentImpact,
        default_inherent_score: inherentLikelihood * inherentImpact,
        default_likelihood: inherentLikelihood,
        default_impact: inherentImpact,
        impact_areas: rc.impact_areas || [],
        control_refs: rc.suggestedControls
          .map((c) => getControlByCode(c)?.id || '')
          .filter(Boolean),
        owner_role: rc.owner_role,
        tags: [],
        schema_version: 1,
      });
      const saved = await riskCatalogRepo.save(catalog);
      savedCatalogs.push(saved);
      console.log(`   Created: ${rc.code}`);
    }
  }

  // 5. Risk Instances (auto-generated based on entity_filter)
  const instanceRepo = ds.getRepository(RiskInstanceEntity);
  console.log('📦 Generating risk instances...');
  let totalInstances = 0;

  for (const catalog of savedCatalogs) {
    if (!catalog.entity_type || !catalog.entity_filter) continue;

    // Filter entities matching entity_filter
    const matchingEntities = DEMO_ENTITIES.filter((e) => {
      if (e.type !== catalog.entity_type) return false;
      if (!catalog.entity_filter) return true;
      // Parse filter: criticality>=4
      if (catalog.entity_filter.includes('criticality>=')) {
        const threshold = parseInt(catalog.entity_filter.split('>=')[1]);
        return e.criticality >= threshold;
      }
      if (catalog.entity_filter.includes('criticality>')) {
        const threshold = parseInt(catalog.entity_filter.split('>')[1]);
        return e.criticality > threshold;
      }
      return true;
    });

    for (const entity of matchingEntities) {
      const owner = getUserByEmail(entity.owner_email);
      const existing = await instanceRepo.findOne({
        where: {
          catalog_id: catalog.id,
          entity_id: entity.id,
          tenant_id: TEST_TENANT_ID,
        },
      });

      if (existing) {
        console.log(`   Instance exists: ${catalog.code} -> ${entity.code}`);
        continue;
      }

      // Calculate inherent and residual scores
      const controlIds = catalog.control_refs || [];
      const inherentLikelihood =
        catalog.default_inherent_likelihood ?? catalog.default_likelihood ?? 3;
      const inherentImpact =
        catalog.default_inherent_impact ?? catalog.default_impact ?? 3;
      const inherentScore = inherentLikelihood * inherentImpact;

      // Calculate residual (after controls)
      const controlEffectiveness =
        controlIds.length > 0 ? Math.min(0.85, controlIds.length * 0.15) : 0;
      const residualLikelihood = Math.max(
        1,
        Math.round(inherentLikelihood * (1 - controlEffectiveness)),
      );
      const residualImpact = Math.max(
        1,
        Math.round(inherentImpact * (1 - controlEffectiveness)),
      );
      const residualScore = residualLikelihood * residualImpact;

      // Determine status based on score and randomness
      const statusOptions = [
        RiskStatus.OPEN,
        RiskStatus.IN_PROGRESS,
        RiskStatus.MITIGATED,
        RiskStatus.ACCEPTED,
      ];
      const randomStatus =
        statusOptions[Math.floor(Math.random() * statusOptions.length)];

      // Treatment plan data (for some instances)
      const hasTreatmentPlan = Math.random() > 0.5;
      const treatmentDueDate = hasTreatmentPlan
        ? new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000)
        : undefined;

      const instance = instanceRepo.create({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        catalog_id: catalog.id,
        entity_id: entity.id,
        entity_type: catalog.entity_type,
        description: `Risk instance for ${entity.name} (${entity.code}) based on ${catalog.code}`,
        inherent_likelihood: inherentLikelihood,
        inherent_impact: inherentImpact,
        inherent_score: inherentScore,
        residual_likelihood: residualLikelihood,
        residual_impact: residualImpact,
        residual_score: residualScore,
        treatment_action: hasTreatmentPlan
          ? `Implement controls to reduce risk from ${inherentScore} to ${residualScore}`
          : undefined,
        treatment_owner_id: owner?.id,
        treatment_due_date: treatmentDueDate,
        expected_reduction: hasTreatmentPlan
          ? `Expected reduction: Likelihood ${inherentLikelihood}→${residualLikelihood}, Impact ${inherentImpact}→${residualImpact}`
          : undefined,
        status: randomStatus,
        owner_id: owner?.id,
        controls_linked: controlIds,
        notes: `Auto-generated for ${entity.name} (${entity.code})`,
        // Backward compatibility
        likelihood: inherentLikelihood,
        impact: inherentImpact,
        residual_risk: residualScore,
      });

      await instanceRepo.save(instance);
      totalInstances++;
      console.log(
        `   Created instance: ${catalog.code} -> ${entity.code} (residual: ${residualRisk.toFixed(2)})`,
      );
    }
  }

  // 6. Policy
  const policyRepo = ds.getRepository(PolicyEntity);
  const policyCode = 'POL-AC-001';
  let savedPolicy = await policyRepo.findOne({
    where: { code: policyCode, tenant_id: TEST_TENANT_ID },
  });

  if (!savedPolicy) {
    const policyId = uuidv4();
    await policyRepo.insert({
      id: policyId,
      tenant_id: TEST_TENANT_ID,
      code: policyCode,
      title: 'Access Control Policy v1',
      status: 'approved',
      effective_date: '2024-01-01',
      review_date: '2025-01-01',
      content:
        '<h1>Access Control Policy</h1><p>This policy defines access control requirements...</p>',
    });
    savedPolicy = await policyRepo.findOne({ where: { id: policyId } });
    console.log(`   Created policy: ${policyCode}`);
  }

  // 7. Standards & Clauses
  const standardRepo = ds.getRepository(StandardEntity);
  const isoStandard = await standardRepo.findOne({
    where: { code: 'ISO27001', tenant_id: TEST_TENANT_ID },
  });
  const nistStandard = await standardRepo.findOne({
    where: { code: 'NIST-800-53', tenant_id: TEST_TENANT_ID },
  });

  // Create/Get ISO27001 standard
  let isoStandardId: string;
  if (!isoStandard) {
    const id = uuidv4();
    await standardRepo.insert({
      id,
      tenant_id: TEST_TENANT_ID,
      code: 'ISO27001',
      name: 'ISO/IEC 27001',
    });
    isoStandardId = id;
    console.log(`   Created standard: ISO27001`);
  } else {
    isoStandardId = isoStandard.id;
  }

  // Create/Get NIST standard
  let nistStandardId: string;
  if (!nistStandard) {
    const id = uuidv4();
    await standardRepo.insert({
      id,
      tenant_id: TEST_TENANT_ID,
      code: 'NIST-800-53',
      name: 'NIST SP 800-53',
    });
    nistStandardId = id;
    console.log(`   Created standard: NIST-800-53`);
  } else {
    nistStandardId = nistStandard.id;
  }

  // Create Clauses
  const clauseRepo = ds.getRepository(StandardClauseEntity);
  const isoClauseCode = 'A.9.1.1';
  const nistClauseCode = 'AC-2';

  let isoClause = await clauseRepo.findOne({
    where: {
      standard_id: isoStandardId,
      clause_code: isoClauseCode,
      tenant_id: TEST_TENANT_ID,
    },
  });
  if (!isoClause) {
    const id = uuidv4();
    await clauseRepo.insert({
      id,
      tenant_id: TEST_TENANT_ID,
      standard_id: isoStandardId,
      clause_code: isoClauseCode,
      title: 'Access control policy',
      text: 'Access control policy and procedures shall be established, documented and reviewed',
      synthetic: false,
      path: `ISO27001:${isoClauseCode}`,
    });
    isoClause = await clauseRepo.findOne({ where: { id } });
    console.log(`   Created clause: ISO27001:${isoClauseCode}`);
  }

  let nistClause = await clauseRepo.findOne({
    where: {
      standard_id: nistStandardId,
      clause_code: nistClauseCode,
      tenant_id: TEST_TENANT_ID,
    },
  });
  if (!nistClause) {
    const id = uuidv4();
    await clauseRepo.insert({
      id,
      tenant_id: TEST_TENANT_ID,
      standard_id: nistStandardId,
      clause_code: nistClauseCode,
      title: 'Account Management',
      text: 'Manage system accounts, including establishing, activating, modifying, disabling, and removing accounts',
      synthetic: false,
      path: `NIST-800-53:${nistClauseCode}`,
    });
    nistClause = await clauseRepo.findOne({ where: { id } });
    console.log(`   Created clause: NIST-800-53:${nistClauseCode}`);
  }

  // 8. Compliance (Requirements) linked to Policy & Clauses
  const complianceRepo = ds.getRepository(RequirementEntity);
  const complianceCodes = [
    {
      code: 'CMP-ISO27001-A9',
      title: 'ISO 27001 A.9 Access Control',
      policyId: savedPolicy?.id,
      clauseId: isoClause?.id,
    },
    {
      code: 'CMP-NIST-AC2',
      title: 'NIST AC-2 Account Management',
      policyId: savedPolicy?.id,
      clauseId: nistClause?.id,
    },
  ];

  console.log('📦 Seeding compliance requirements...');
  for (const comp of complianceCodes) {
    const existing = await complianceRepo.findOne({
      where: { title: comp.title, deleted_at: null as any },
    });
    if (!existing && comp.policyId && comp.clauseId) {
      await complianceRepo.insert({
        id: uuidv4(),
        title: comp.title,
        description: `Compliance requirement linked to policy and clause`,
        regulation: comp.code.includes('ISO') ? 'ISO27001' : 'NIST-800-53',
        status: 'pending',
        policy_id: comp.policyId,
        clause_id: comp.clauseId,
      });
      console.log(`   Created compliance: ${comp.code}`);
    }
  }

  // 9. Link Controls to Clauses
  console.log('📦 Linking controls to clauses...');
  // ISO A.9 → MFA, SSO, PAM
  const isoControls = ['CTRL-MFA', 'CTRL-SSO', 'CTRL-PAM'];
  for (const ctrlCode of isoControls) {
    const ctrl = getControlByCode(ctrlCode);
    if (ctrl && isoClause && !ctrl.clause_id) {
      await controlRepo.update(ctrl.id, { clause_id: isoClause.id });
      console.log(`   Linked ${ctrlCode} to ISO27001:${isoClauseCode}`);
    }
  }

  // NIST AC-2 → PAM, LM
  const nistControls = ['CTRL-PAM', 'CTRL-LM'];
  for (const ctrlCode of nistControls) {
    const ctrl = getControlByCode(ctrlCode);
    if (ctrl && nistClause) {
      // PAM already linked to ISO, skip or link to both (would need many-to-many)
      if (ctrlCode === 'CTRL-LM' && !ctrl.clause_id) {
        await controlRepo.update(ctrl.id, { clause_id: nistClause.id });
        console.log(`   Linked ${ctrlCode} to NIST-800-53:${nistClauseCode}`);
      }
    }
  }

  // 10. Entity Types & Entities
  const entityTypeRepo = ds.getRepository(EntityTypeEntity);
  const entityRepo = ds.getRepository(EntityEntity);

  console.log('📦 Seeding entity types...');
  const entityTypes = [
    {
      code: 'Application',
      name: 'Application',
      description: 'Software applications and systems',
    },
    { code: 'Database', name: 'Database', description: 'Database systems' },
    { code: 'Service', name: 'Service', description: 'Microservices and APIs' },
    { code: 'Process', name: 'Process', description: 'Business processes' },
    { code: 'Vendor', name: 'Vendor', description: 'Third-party vendors' },
  ];

  const savedEntityTypes: EntityTypeEntity[] = [];
  for (const et of entityTypes) {
    const existing = await entityTypeRepo.findOne({
      where: { code: et.code, tenant_id: TEST_TENANT_ID },
    });
    if (existing) {
      await entityTypeRepo.update(existing.id, {
        name: et.name,
        description: et.description,
      });
      savedEntityTypes.push(existing);
      console.log(`   Updated: ${et.code}`);
    } else {
      const entityType = entityTypeRepo.create({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        code: et.code,
        name: et.name,
        description: et.description,
      });
      const saved = await entityTypeRepo.save(entityType);
      savedEntityTypes.push(saved);
      console.log(`   Created: ${et.code}`);
    }
  }

  const getEntityTypeByCode = (code: string) =>
    savedEntityTypes.find((et) => et.code === code);

  console.log('📦 Seeding entities...');
  let totalEntities = 0;
  for (const demoEntity of DEMO_ENTITIES) {
    const entityType = getEntityTypeByCode(demoEntity.type);
    if (!entityType) {
      console.log(
        `   Skipping ${demoEntity.code}: entity type ${demoEntity.type} not found`,
      );
      continue;
    }

    const existing = await entityRepo.findOne({
      where: { code: demoEntity.code, tenant_id: TEST_TENANT_ID },
    });

    if (existing) {
      existing.name = demoEntity.name;
      existing.criticality = demoEntity.criticality;
      existing.owner_user_id = getUserByEmail(demoEntity.owner_email)?.id;
      existing.attributes = {
        tier:
          demoEntity.criticality >= 4
            ? 'L1'
            : demoEntity.criticality >= 3
              ? 'L2'
              : 'L3',
      };
      await entityRepo.save(existing);
      console.log(`   Updated: ${demoEntity.code}`);
    } else {
      const entity = entityRepo.create({
        id: demoEntity.id,
        tenant_id: TEST_TENANT_ID,
        entity_type_id: entityType.id,
        code: demoEntity.code,
        name: demoEntity.name,
        criticality: demoEntity.criticality,
        owner_user_id: getUserByEmail(demoEntity.owner_email)?.id,
        attributes: {
          tier:
            demoEntity.criticality >= 4
              ? 'L1'
              : demoEntity.criticality >= 3
                ? 'L2'
                : 'L3',
          repo:
            demoEntity.type === 'Application'
              ? `git://repo/${demoEntity.code.toLowerCase()}`
              : undefined,
        },
      });
      await entityRepo.save(entity);
      totalEntities++;
      console.log(`   Created: ${demoEntity.code}`);
    }
  }

  console.log(
    `✅ Phase 12 Demo Seed completed! Generated risk instances and ${totalEntities} entities.`,
  );
  return ds; // Return DataSource instead of destroying it
}

async function main() {
  const ds = await seedPhase12Demo();

  // Phase 14: Seed Audit data
  try {
    const { seedPhase14AuditData } = await import('./phase14-audit-seed');
    await seedPhase14AuditData(ds);
  } catch (error: any) {
    console.warn('⚠️  Phase 14 audit seed skipped:', error?.message || error);
  } finally {
    if (ds && ds.isInitialized) {
      await ds.destroy();
    }
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
