/**
 * GRC Frameworks Seed Script
 *
 * Seeds default compliance frameworks (ISO27001, SOC2, NIST, GDPR) into the
 * grc_frameworks table. This script is idempotent - it uses upsert-by-key
 * semantics to avoid duplicates.
 *
 * Optional: If DEMO_TENANT_AUTOFRAMEWORKS=true, auto-attaches ISO27001 to
 * the demo tenant for staging/demo convenience.
 *
 * Usage: npm run seed:frameworks
 */

// Disable job scheduling for seed scripts to ensure deterministic exit
process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { GrcFramework } from '../grc/entities/grc-framework.entity';
import { GrcTenantFramework } from '../grc/entities/grc-tenant-framework.entity';

// Demo tenant ID (consistent with other seed scripts)
const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Default frameworks to seed
const DEFAULT_FRAMEWORKS = [
  {
    key: 'ISO27001',
    name: 'ISO/IEC 27001',
    description:
      'Information security management systems - Requirements. International standard for managing information security.',
  },
  {
    key: 'SOC2',
    name: 'SOC 2',
    description:
      'Service Organization Control 2 - Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy.',
  },
  {
    key: 'NIST',
    name: 'NIST Cybersecurity Framework',
    description:
      'National Institute of Standards and Technology Cybersecurity Framework - Guidelines for managing cybersecurity risk.',
  },
  {
    key: 'GDPR',
    name: 'General Data Protection Regulation',
    description:
      'European Union regulation on data protection and privacy for individuals within the EU and EEA.',
  },
];

async function seedFrameworks() {
  console.log('Starting GRC Frameworks seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    const frameworkRepo = dataSource.getRepository(GrcFramework);
    const tenantFrameworkRepo = dataSource.getRepository(GrcTenantFramework);
    const tenantRepo = dataSource.getRepository(Tenant);

    // 1. Seed default frameworks (upsert by key)
    console.log('1. Seeding default frameworks...');
    const seededFrameworks: GrcFramework[] = [];

    for (const frameworkData of DEFAULT_FRAMEWORKS) {
      let framework = await frameworkRepo.findOne({
        where: { key: frameworkData.key },
      });

      if (!framework) {
        framework = frameworkRepo.create({
          key: frameworkData.key,
          name: frameworkData.name,
          description: frameworkData.description,
          isActive: true,
        });
        await frameworkRepo.save(framework);
        console.log(`   Created framework: ${frameworkData.key}`);
      } else {
        console.log(`   Framework already exists: ${frameworkData.key}`);
      }

      seededFrameworks.push(framework);
    }

    // 2. Optional: Auto-attach ISO27001 to demo tenant if DEMO_TENANT_AUTOFRAMEWORKS=true
    const autoFrameworks = process.env.DEMO_TENANT_AUTOFRAMEWORKS === 'true';
    if (autoFrameworks) {
      console.log('\n2. Auto-attaching ISO27001 to demo tenant...');

      const tenant = await tenantRepo.findOne({
        where: { id: DEMO_TENANT_ID },
      });
      if (!tenant) {
        console.log('   WARNING: Demo tenant not found. Skipping auto-attach.');
      } else {
        const iso27001 = seededFrameworks.find((f) => f.key === 'ISO27001');
        if (iso27001) {
          const existing = await tenantFrameworkRepo.findOne({
            where: {
              tenantId: DEMO_TENANT_ID,
              frameworkId: iso27001.id,
            },
          });

          if (!existing) {
            const tenantFramework = tenantFrameworkRepo.create({
              tenantId: DEMO_TENANT_ID,
              frameworkId: iso27001.id,
            });
            await tenantFrameworkRepo.save(tenantFramework);
            console.log('   Attached ISO27001 to demo tenant');
          } else {
            console.log('   ISO27001 already attached to demo tenant');
          }
        }
      }
    } else {
      console.log(
        '\n2. Skipping demo tenant auto-attach (DEMO_TENANT_AUTOFRAMEWORKS not set)',
      );
    }

    console.log('\n========================================');
    console.log('GRC Frameworks Seed Complete!');
    console.log('========================================');
    console.log(`Frameworks seeded: ${seededFrameworks.length}`);
    for (const f of seededFrameworks) {
      console.log(`  - ${f.key}: ${f.name}`);
    }
    console.log('========================================\n');
  } catch (error) {
    console.error('Error seeding frameworks:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the seed
seedFrameworks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
