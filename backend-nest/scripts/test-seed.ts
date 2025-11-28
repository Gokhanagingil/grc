#!/usr/bin/env ts-node

/**
 * Deterministic Test Seed Script
 * Seeds test data for E2E and acceptance tests (idempotent)
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import {
  RiskCategoryEntity,
  RiskCatalogEntity,
  StandardEntity,
  StandardClauseEntity,
  ControlLibraryEntity,
  PolicyEntity,
} from '../src/entities/app';

config();

const TEST_TENANT_ID = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'grc',
    password: process.env.DB_PASS || '123456',
    database: process.env.DB_NAME || 'grc',
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
    entities: [
      RiskCategoryEntity,
      RiskCatalogEntity,
      StandardEntity,
      StandardClauseEntity,
      ControlLibraryEntity,
      PolicyEntity,
    ],
  });

  await ds.initialize();
  console.log('✅ Database connected');

  // 1. Risk Categories (7 standard categories)
  const categoryRepo = ds.getRepository(RiskCategoryEntity);
  const categories = [
    { code: 'Strategic', name: 'Strategic Risk', description: 'Strategic and business planning risks' },
    { code: 'Operational', name: 'Operational Risk', description: 'Day-to-day operational risks' },
    { code: 'Compliance', name: 'Compliance Risk', description: 'Regulatory and compliance risks' },
    { code: 'Financial', name: 'Financial Risk', description: 'Financial and economic risks' },
    { code: 'Vendor', name: 'Vendor Risk', description: 'Third-party and vendor risks' },
    { code: 'Security', name: 'Security Risk', description: 'Information security and cybersecurity risks' },
    { code: 'Privacy', name: 'Privacy Risk', description: 'Data privacy and protection risks' },
  ];

  console.log('📦 Seeding risk categories...');
  for (const cat of categories) {
    const existing = await categoryRepo.findOne({
      where: { code: cat.code, tenant_id: TEST_TENANT_ID },
    });
    if (existing) {
      await categoryRepo.update(existing.id, { name: cat.name, description: cat.description });
      console.log(`   Updated: ${cat.code}`);
    } else {
      await categoryRepo.insert({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        code: cat.code,
        name: cat.name,
        description: cat.description,
      });
      console.log(`   Created: ${cat.code}`);
    }
  }

  // 2. Sample Risks (deterministic codes)
  const riskRepo = ds.getRepository(RiskCatalogEntity);
  const operationalCategory = await categoryRepo.findOne({
    where: { code: 'Operational', tenant_id: TEST_TENANT_ID },
  });
  const complianceCategory = await categoryRepo.findOne({
    where: { code: 'Compliance', tenant_id: TEST_TENANT_ID },
  });

  if (operationalCategory && complianceCategory) {
    const risks = [
      {
        code: 'RISK-SEED-001',
        name: 'Test Operational Risk',
        description: 'Sample operational risk for E2E testing',
        category_id: operationalCategory.id,
        default_likelihood: 3,
        default_impact: 4,
        tags: ['test', 'e2e'],
      },
      {
        code: 'RISK-SEED-002',
        name: 'Test Compliance Risk',
        description: 'Sample compliance risk for E2E testing',
        category_id: complianceCategory.id,
        default_likelihood: 2,
        default_impact: 5,
        tags: ['test', 'compliance'],
      },
      {
        code: 'RISK-SEED-003',
        name: 'Test Vendor Risk',
        description: 'Sample vendor risk for testing',
        category_id: operationalCategory.id,
        default_likelihood: 4,
        default_impact: 3,
        tags: ['test', 'vendor'],
      },
    ];

    console.log('📦 Seeding sample risks...');
    for (const risk of risks) {
      const existing = await riskRepo.findOne({
        where: { code: risk.code, tenant_id: TEST_TENANT_ID },
      });
      if (existing) {
        await riskRepo.update(existing.id, risk);
        console.log(`   Updated: ${risk.code}`);
      } else {
        await riskRepo.insert({
          id: uuidv4(),
          tenant_id: TEST_TENANT_ID,
          ...risk,
          control_refs: [],
          schema_version: 1,
        });
        console.log(`   Created: ${risk.code}`);
      }
    }
  }

  // 3. Sample Policy (TR date format testable)
  const policyRepo = ds.getRepository(PolicyEntity);
  const policyCode = 'POL-SEED-001';
  const existingPolicy = await policyRepo.findOne({
    where: { code: policyCode, tenant_id: TEST_TENANT_ID },
  });

  if (existingPolicy) {
    await policyRepo.update(existingPolicy.id, {
      title: 'Test Policy for E2E',
      status: 'draft',
      effective_date: '2024-01-01',
      review_date: '2024-12-31',
      content: '<p>Test policy content for E2E testing</p>',
    });
    console.log(`   Updated: ${policyCode}`);
  } else {
    await policyRepo.insert({
      id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      code: policyCode,
      title: 'Test Policy for E2E',
      status: 'draft',
      effective_date: '2024-01-01',
      review_date: '2024-12-31',
      content: '<p>Test policy content for E2E testing</p>',
    });
    console.log(`   Created: ${policyCode}`);
  }

  // 4. Sample Standard (for drawer testing)
  const standardRepo = ds.getRepository(StandardEntity);
  const standardCode = 'ISO27001';
  const existingStandard = await standardRepo.findOne({
    where: { code: standardCode, tenant_id: TEST_TENANT_ID },
  });

  if (!existingStandard) {
    await standardRepo.insert({
      id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      code: standardCode,
      name: 'ISO/IEC 27001',
      description: 'Information Security Management',
    });
    console.log(`   Created: ${standardCode}`);
  }

  // 5. Sample Control (for drawer testing)
  const controlRepo = ds.getRepository(ControlLibraryEntity);
  const controlCode = 'CTL-SEED-001';
  const existingControl = await controlRepo.findOne({
    where: { code: controlCode, tenant_id: TEST_TENANT_ID },
  });

  if (existingControl) {
    await controlRepo.update(existingControl.id, {
      name: 'Test Control for E2E',
      family: 'Access Control',
      description: 'Sample control for drawer testing',
    });
    console.log(`   Updated: ${controlCode}`);
  } else {
    await controlRepo.insert({
      id: uuidv4(),
      tenant_id: TEST_TENANT_ID,
      code: controlCode,
      name: 'Test Control for E2E',
      family: 'Access Control',
      description: 'Sample control for drawer testing',
    });
    console.log(`   Created: ${controlCode}`);
  }

  // 6. Sample Clause (for compliance testing)
  if (existingStandard) {
    const clauseRepo = ds.getRepository(StandardClauseEntity);
    const clauseCode = 'A.5.1.1';
    const existingClause = await clauseRepo.findOne({
      where: {
        standard_id: existingStandard.id,
        clause_code: clauseCode,
        tenant_id: TEST_TENANT_ID,
      },
    });

    if (existingClause) {
      await clauseRepo.update(existingClause.id, {
        title: 'Test Clause for E2E',
        text: 'Sample clause description for testing',
        synthetic: true,
      });
      console.log(`   Updated: ${clauseCode}`);
    } else {
      await clauseRepo.insert({
        id: uuidv4(),
        tenant_id: TEST_TENANT_ID,
        standard_id: existingStandard.id,
        clause_code: clauseCode,
        title: 'Test Clause for E2E',
        text: 'Sample clause description for testing',
        synthetic: true,
        path: `${standardCode}:${clauseCode}`,
      });
      console.log(`   Created: ${clauseCode}`);
    }
  }

  await ds.destroy();
  console.log('✅ Test seed completed');
}

// Export for use in reset-db.ts
export { seed as testSeed };

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

