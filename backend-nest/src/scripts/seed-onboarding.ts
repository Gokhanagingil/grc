/**
 * Onboarding Seed Script
 *
 * Seeds onboarding data for the demo tenant (000...001) to enable GRC modules.
 * This ensures the Audit Management module and other GRC features are available.
 *
 * Usage: npm run seed:onboarding
 *
 * This script is idempotent - it checks for existing data before creating.
 */

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import {
  TenantInitializationProfile,
  TenantActiveSuite,
  TenantEnabledModule,
  SuiteType,
  ModuleType,
} from '../onboarding/entities';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function seedOnboarding() {
  console.log('Starting Onboarding seed for demo tenant...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('1. Checking demo tenant...');
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });

    if (!tenant) {
      console.error(
        '   ERROR: Demo tenant not found. Please run seed:grc first.',
      );
      process.exit(1);
    }
    console.log('   Demo tenant found');

    console.log('2. Seeding initialization profile...');
    const initProfileRepo = dataSource.getRepository(
      TenantInitializationProfile,
    );
    let initProfile = await initProfileRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID },
    });

    if (!initProfile) {
      initProfile = initProfileRepo.create({
        tenantId: DEMO_TENANT_ID,
        schemaVersion: 1,
        policySetVersion: 'v1.0.0',
        initializedAt: new Date(),
        metadata: {
          seedVersion: '1.0.0',
          seededAt: new Date().toISOString(),
        },
      });
      await initProfileRepo.save(initProfile);
      console.log('   Created initialization profile');
    } else {
      console.log('   Initialization profile already exists');
    }

    console.log('3. Seeding active suites...');
    const activeSuiteRepo = dataSource.getRepository(TenantActiveSuite);

    const suitesToSeed = [
      {
        suiteType: SuiteType.GRC_SUITE,
        isActive: true,
        activatedAt: new Date(),
        metadata: { seedVersion: '1.0.0' },
      },
    ];

    for (const suiteData of suitesToSeed) {
      const existing = await activeSuiteRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          suiteType: suiteData.suiteType,
        },
      });

      if (!existing) {
        const suite = activeSuiteRepo.create({
          tenantId: DEMO_TENANT_ID,
          ...suiteData,
        });
        await activeSuiteRepo.save(suite);
        console.log(`   Created active suite: ${suiteData.suiteType}`);
      } else {
        if (!existing.isActive) {
          existing.isActive = true;
          existing.activatedAt = new Date();
          await activeSuiteRepo.save(existing);
          console.log(`   Activated existing suite: ${suiteData.suiteType}`);
        } else {
          console.log(`   Suite already active: ${suiteData.suiteType}`);
        }
      }
    }

    console.log('4. Seeding enabled modules...');
    const enabledModuleRepo = dataSource.getRepository(TenantEnabledModule);

    const modulesToSeed = [
      { suiteType: SuiteType.GRC_SUITE, moduleType: ModuleType.RISK },
      { suiteType: SuiteType.GRC_SUITE, moduleType: ModuleType.POLICY },
      { suiteType: SuiteType.GRC_SUITE, moduleType: ModuleType.CONTROL },
      { suiteType: SuiteType.GRC_SUITE, moduleType: ModuleType.AUDIT },
    ];

    for (const moduleData of modulesToSeed) {
      const existing = await enabledModuleRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          moduleType: moduleData.moduleType,
        },
      });

      if (!existing) {
        const module = enabledModuleRepo.create({
          tenantId: DEMO_TENANT_ID,
          suiteType: moduleData.suiteType,
          moduleType: moduleData.moduleType,
          isEnabled: true,
          enabledAt: new Date(),
          metadata: { seedVersion: '1.0.0' },
        });
        await enabledModuleRepo.save(module);
        console.log(`   Created enabled module: ${moduleData.moduleType}`);
      } else {
        if (!existing.isEnabled) {
          existing.isEnabled = true;
          existing.enabledAt = new Date();
          await enabledModuleRepo.save(existing);
          console.log(`   Enabled existing module: ${moduleData.moduleType}`);
        } else {
          console.log(`   Module already enabled: ${moduleData.moduleType}`);
        }
      }
    }

    console.log('\n========================================');
    console.log('Onboarding Seed Complete!');
    console.log('========================================');
    console.log(`Tenant ID: ${DEMO_TENANT_ID}`);
    console.log('Active Suites: GRC_SUITE');
    console.log('Enabled Modules: risk, policy, control, audit');
    console.log('');
    console.log('The demo tenant now has:');
    console.log('  - GRC Suite activated');
    console.log('  - Risk Management module enabled');
    console.log('  - Policy Management module enabled');
    console.log('  - Control Management module enabled');
    console.log('  - Audit Management module enabled');
    console.log('========================================\n');
  } catch (error) {
    console.error('Error seeding onboarding:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedOnboarding()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
