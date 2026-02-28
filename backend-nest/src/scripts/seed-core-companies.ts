/**
 * Seed script: Core Companies
 *
 * Creates demo companies for the default tenant.
 * Idempotent: checks for existing records before inserting.
 *
 * Usage:
 *   npx ts-node src/scripts/seed-core-companies.ts   (dev)
 *   node dist/scripts/seed-core-companies.js          (prod)
 */
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { CoreCompany } from '../core-company/core-company.entity';
import { CompanyType, CompanyStatus } from '../core-company/core-company.enum';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface CompanySeed {
  name: string;
  code: string;
  type: CompanyType;
  status: CompanyStatus;
  domain: string | null;
  country: string | null;
  notes: string | null;
}

const DEMO_COMPANIES: CompanySeed[] = [
  {
    name: 'Niles Demo Customer',
    code: 'NILES-CUST',
    type: CompanyType.CUSTOMER,
    status: CompanyStatus.ACTIVE,
    domain: 'niles-demo.example.com',
    country: 'Germany',
    notes: 'Demo customer for testing and onboarding.',
  },
  {
    name: 'Acme Vendor Corp',
    code: 'ACME-VEND',
    type: CompanyType.VENDOR,
    status: CompanyStatus.ACTIVE,
    domain: 'acme-vendor.example.com',
    country: 'United States',
    notes: 'Demo vendor for third-party service integration testing.',
  },
  {
    name: 'Internal IT Operations',
    code: 'INT-OPS',
    type: CompanyType.INTERNAL,
    status: CompanyStatus.ACTIVE,
    domain: null,
    country: null,
    notes: 'Internal entity representing the IT operations department.',
  },
];

async function seedCoreCompanies(): Promise<void> {
  console.log('[seed-core-companies] Starting...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const repo = ds.getRepository(CoreCompany);

  let created = 0;
  let skipped = 0;

  for (const seed of DEMO_COMPANIES) {
    const existing = await repo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        code: seed.code,
        isDeleted: false,
      },
    });

    if (existing) {
      console.log(`  [skip] "${seed.name}" (code=${seed.code}) already exists`);
      skipped++;
      continue;
    }

    const entity = repo.create({
      tenantId: DEMO_TENANT_ID,
      name: seed.name,
      code: seed.code,
      type: seed.type,
      status: seed.status,
      domain: seed.domain,
      country: seed.country,
      notes: seed.notes,
      createdBy: DEMO_ADMIN_ID,
      isDeleted: false,
    });

    await repo.save(entity);
    console.log(`  [created] "${seed.name}" (code=${seed.code})`);
    created++;
  }

  console.log(
    `[seed-core-companies] Done. Created: ${created}, Skipped: ${skipped}`,
  );

  await app.close();
}

seedCoreCompanies().catch((err) => {
  console.error('[seed-core-companies] FATAL:', err);
  process.exit(1);
});
