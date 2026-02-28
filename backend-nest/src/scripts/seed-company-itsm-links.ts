/**
 * Seed script: Link demo companies to ITSM entities
 *
 * Links existing demo companies to existing ITSM services, incidents, and changes.
 * Idempotent: only updates records that don't already have a customer_company_id set.
 *
 * Prerequisites: Run seed-core-companies.ts first to ensure demo companies exist.
 *
 * Usage:
 *   npx ts-node src/scripts/seed-company-itsm-links.ts   (dev)
 *   node dist/scripts/seed-company-itsm-links.js          (prod)
 */
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { CoreCompany } from '../core-company/core-company.entity';
import { ItsmService } from '../itsm/service/service.entity';
import { Incident } from '../itsm/incident/incident.entity';
import { Change } from '../itsm/change/change.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function seedCompanyItsmLinks(): Promise<void> {
  console.log('[seed-company-itsm-links] Starting...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);

  // 1. Look up the three demo companies by code
  const companyRepo = ds.getRepository(CoreCompany);
  const customerCompany = await companyRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, code: 'NILES-CUST', isDeleted: false },
  });
  const vendorCompany = await companyRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, code: 'ACME-VEND', isDeleted: false },
  });
  const internalCompany = await companyRepo.findOne({
    where: { tenantId: DEMO_TENANT_ID, code: 'INT-OPS', isDeleted: false },
  });

  if (!customerCompany && !vendorCompany && !internalCompany) {
    console.log(
      '[seed-company-itsm-links] No demo companies found. Run seed-core-companies.ts first.',
    );
    await app.close();
    return;
  }

  let updated = 0;
  let skipped = 0;

  // 2. Link first available ITSM service to the customer company
  if (customerCompany) {
    const serviceRepo = ds.getRepository(ItsmService);
    const service = await serviceRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
    if (service) {
      if (!service.customerCompanyId) {
        service.customerCompanyId = customerCompany.id;
        await serviceRepo.save(service);
        console.log(
          `  [updated] Service "${service.name}" -> Company "${customerCompany.name}"`,
        );
        updated++;
      } else {
        console.log(
          `  [skip] Service "${service.name}" already linked to a company`,
        );
        skipped++;
      }
    } else {
      console.log('  [skip] No ITSM service found to link');
      skipped++;
    }
  }

  // 3. Link first available ITSM incident to the vendor company (or customer if vendor missing)
  const incidentCompany = vendorCompany || customerCompany;
  if (incidentCompany) {
    const incidentRepo = ds.getRepository(Incident);
    const incident = await incidentRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
    if (incident) {
      if (!incident.customerCompanyId) {
        incident.customerCompanyId = incidentCompany.id;
        await incidentRepo.save(incident);
        console.log(
          `  [updated] Incident "${incident.shortDescription}" -> Company "${incidentCompany.name}"`,
        );
        updated++;
      } else {
        console.log(
          `  [skip] Incident "${incident.shortDescription}" already linked to a company`,
        );
        skipped++;
      }
    } else {
      console.log('  [skip] No ITSM incident found to link');
      skipped++;
    }
  }

  // 4. Link first available ITSM change to the internal company (or customer if internal missing)
  const changeCompany = internalCompany || customerCompany;
  if (changeCompany) {
    const changeRepo = ds.getRepository(Change);
    const change = await changeRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
    if (change) {
      if (!change.customerCompanyId) {
        change.customerCompanyId = changeCompany.id;
        await changeRepo.save(change);
        console.log(
          `  [updated] Change "${change.title}" -> Company "${changeCompany.name}"`,
        );
        updated++;
      } else {
        console.log(
          `  [skip] Change "${change.title}" already linked to a company`,
        );
        skipped++;
      }
    } else {
      console.log('  [skip] No ITSM change found to link');
      skipped++;
    }
  }

  console.log(
    `[seed-company-itsm-links] Done. Updated: ${updated}, Skipped: ${skipped}`,
  );
  await app.close();
}

seedCompanyItsmLinks().catch((err) => {
  console.error('[seed-company-itsm-links] FATAL:', err);
  process.exit(1);
});
