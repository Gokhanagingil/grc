/**
 * SOA (Statement of Applicability) Demo Data Seed Script
 *
 * Seeds a demo SOA profile with items for the demo tenant.
 * Creates an SOA profile linked to an existing standard (ISO 27001 if available),
 * initializes items, and sets various applicability/implementation statuses.
 *
 * Usage: npm run seed:soa
 *
 * This script is idempotent - it checks for existing data before creating.
 */

// Disable job scheduling for seed scripts to ensure deterministic exit
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { GrcSoaProfile } from '../grc/entities/grc-soa-profile.entity';
import { GrcSoaItem } from '../grc/entities/grc-soa-item.entity';
import { Standard } from '../grc/entities/standard.entity';
import { StandardClause } from '../grc/entities/standard-clause.entity';
import {
  SoaProfileStatus,
  SoaApplicability,
  SoaImplementationStatus,
} from '../grc/enums';

// Demo tenant and user IDs (consistent with seed-grc.ts)
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Demo SOA Profile ID (for idempotency)
const DEMO_SOA_PROFILE_ID = '00000000-0000-0000-0000-000000000100';

async function seedSoaData() {
  console.log('Starting SOA demo data seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // 1. Find an existing standard to use for the SOA profile
    console.log('1. Finding existing standard for SOA profile...');
    const standardRepo = dataSource.getRepository(Standard);

    // Try to find ISO 27001 first, then any standard
    let standard = await standardRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      order: { name: 'ASC' },
    });

    if (!standard) {
      // Try to find any standard without tenant filter (some standards might be global)
      standard = await standardRepo.findOne({
        where: { isDeleted: false },
        order: { name: 'ASC' },
      });
    }

    if (!standard) {
      console.log('   No standards found. Please run seed:standards first.');
      console.log('   Skipping SOA seed.');
      await app.close();
      return;
    }

    console.log(`   Found standard: ${standard.name} (${standard.id})`);

    // 2. Check/create demo SOA profile
    console.log('2. Checking/creating demo SOA profile...');
    const profileRepo = dataSource.getRepository(GrcSoaProfile);
    let profile = await profileRepo.findOne({
      where: { id: DEMO_SOA_PROFILE_ID, tenantId: DEMO_TENANT_ID },
    });

    if (!profile) {
      profile = profileRepo.create({
        id: DEMO_SOA_PROFILE_ID,
        tenantId: DEMO_TENANT_ID,
        standardId: standard.id,
        name: `${standard.name} - Demo SOA`,
        description:
          'Demo Statement of Applicability for testing and demonstration purposes',
        scopeText:
          'This SOA covers all information systems and processes within the Demo Organization scope.',
        status: SoaProfileStatus.DRAFT,
        version: 1,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await profileRepo.save(profile);
      console.log(`   Created SOA profile: ${profile.name}`);
    } else {
      console.log(`   SOA profile already exists: ${profile.name}`);
    }

    // 3. Initialize SOA items from standard clauses
    console.log('3. Initializing SOA items from standard clauses...');
    const clauseRepo = dataSource.getRepository(StandardClause);
    const itemRepo = dataSource.getRepository(GrcSoaItem);

    // Get all clauses for the standard
    const clauses = await clauseRepo.find({
      where: { standardId: standard.id, isDeleted: false },
      order: { code: 'ASC' },
    });

    console.log(`   Found ${clauses.length} clauses for standard`);

    if (clauses.length === 0) {
      console.log(
        '   No clauses found for standard. Skipping item initialization.',
      );
      await app.close();
      return;
    }

    // Get existing items
    const existingItems = await itemRepo.find({
      where: {
        profileId: profile.id,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      },
    });
    const existingClauseIds = new Set(
      existingItems.map((item) => item.clauseId),
    );

    // Create missing items
    let createdCount = 0;
    const BATCH_SIZE = 50;
    const newClauses = clauses.filter((c) => !existingClauseIds.has(c.id));

    for (let i = 0; i < newClauses.length; i += BATCH_SIZE) {
      const batch = newClauses.slice(i, i + BATCH_SIZE);
      const items = batch.map((clause) =>
        itemRepo.create({
          tenantId: DEMO_TENANT_ID,
          profileId: profile.id,
          clauseId: clause.id,
          applicability: SoaApplicability.UNDECIDED,
          implementationStatus: SoaImplementationStatus.NOT_IMPLEMENTED,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        }),
      );
      await itemRepo.save(items);
      createdCount += items.length;
    }

    console.log(
      `   Created ${createdCount} new SOA items (${existingItems.length} already existed)`,
    );

    // 4. Set demo statuses on some items
    console.log('4. Setting demo statuses on SOA items...');
    const allItems = await itemRepo.find({
      where: {
        profileId: profile.id,
        tenantId: DEMO_TENANT_ID,
        isDeleted: false,
      },
      order: { createdAt: 'ASC' },
    });

    if (allItems.length > 0) {
      // Set 10 items as IMPLEMENTED
      const implementedItems = allItems.slice(0, Math.min(10, allItems.length));
      for (const item of implementedItems) {
        if (item.implementationStatus !== SoaImplementationStatus.IMPLEMENTED) {
          item.applicability = SoaApplicability.APPLICABLE;
          item.implementationStatus = SoaImplementationStatus.IMPLEMENTED;
          item.justification = 'Control is fully implemented and operational.';
          item.updatedBy = DEMO_ADMIN_ID;
          await itemRepo.save(item);
        }
      }
      console.log(`   Set ${implementedItems.length} items as IMPLEMENTED`);

      // Set 10 items as PLANNED
      const plannedItems = allItems.slice(10, Math.min(20, allItems.length));
      for (const item of plannedItems) {
        if (item.implementationStatus !== SoaImplementationStatus.PLANNED) {
          item.applicability = SoaApplicability.APPLICABLE;
          item.implementationStatus = SoaImplementationStatus.PLANNED;
          item.justification =
            'Control implementation is planned for next quarter.';
          item.targetDate = new Date('2026-06-30');
          item.updatedBy = DEMO_ADMIN_ID;
          await itemRepo.save(item);
        }
      }
      console.log(`   Set ${plannedItems.length} items as PLANNED`);

      // Set 5 items as NOT_APPLICABLE
      const notApplicableItems = allItems.slice(
        20,
        Math.min(25, allItems.length),
      );
      for (const item of notApplicableItems) {
        if (item.applicability !== SoaApplicability.NOT_APPLICABLE) {
          item.applicability = SoaApplicability.NOT_APPLICABLE;
          item.implementationStatus = SoaImplementationStatus.NOT_IMPLEMENTED;
          item.justification =
            'This control is not applicable to our organization due to scope limitations.';
          item.updatedBy = DEMO_ADMIN_ID;
          await itemRepo.save(item);
        }
      }
      console.log(
        `   Set ${notApplicableItems.length} items as NOT_APPLICABLE`,
      );

      // Set 5 items as PARTIALLY_IMPLEMENTED
      const partialItems = allItems.slice(25, Math.min(30, allItems.length));
      for (const item of partialItems) {
        if (
          item.implementationStatus !==
          SoaImplementationStatus.PARTIALLY_IMPLEMENTED
        ) {
          item.applicability = SoaApplicability.APPLICABLE;
          item.implementationStatus =
            SoaImplementationStatus.PARTIALLY_IMPLEMENTED;
          item.justification =
            'Control is partially implemented. Full implementation in progress.';
          item.targetDate = new Date('2026-03-31');
          item.updatedBy = DEMO_ADMIN_ID;
          await itemRepo.save(item);
        }
      }
      console.log(
        `   Set ${partialItems.length} items as PARTIALLY_IMPLEMENTED`,
      );
    }

    // 5. Summary
    console.log('\n========================================');
    console.log('SOA Demo Data Seed Complete!');
    console.log('========================================');
    console.log(`Profile: ${profile.name}`);
    console.log(`Standard: ${standard.name}`);
    console.log(`Total Items: ${allItems.length}`);
    console.log(`Profile ID: ${profile.id}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Error seeding SOA data:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the seed
seedSoaData()
  .then(() => {
    console.log('SOA seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('SOA seed failed:', error);
    process.exit(1);
  });
