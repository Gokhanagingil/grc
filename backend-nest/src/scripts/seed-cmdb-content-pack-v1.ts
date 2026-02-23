/**
 * CMDB Baseline Content Pack v1 — Seed Script
 *
 * Applies the versioned, idempotent CMDB baseline content pack to the demo tenant.
 * Seeds system CI class hierarchy, field definitions, and relationship type catalog.
 *
 * Usage:
 *   DEV:  npx ts-node -r tsconfig-paths/register src/scripts/seed-cmdb-content-pack-v1.ts
 *   PROD: node dist/scripts/seed-cmdb-content-pack-v1.js
 *
 * Options (via env):
 *   CMDB_CONTENT_PACK_DRY_RUN=true   — report-only mode (no writes)
 *   CMDB_CONTENT_PACK_TENANT_ID=...  — override tenant ID (default: demo tenant)
 *
 * Prerequisites:
 *   - seed:grc (tenant must exist)
 *   - Migration 1741900000000 (is_system column)
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import {
  applyBaselineContentPack,
  CMDB_BASELINE_CONTENT_PACK_VERSION,
} from '../itsm/cmdb/content-pack';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(70));
  console.log('  CMDB Baseline Content Pack — Seed Script');
  console.log(`  Version: ${CMDB_BASELINE_CONTENT_PACK_VERSION}`);
  console.log('='.repeat(70));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  const tenantId = process.env.CMDB_CONTENT_PACK_TENANT_ID || DEFAULT_TENANT_ID;
  const dryRun = process.env.CMDB_CONTENT_PACK_DRY_RUN === 'true';

  try {
    // Verify tenant exists
    const tenant = await ds
      .getRepository(Tenant)
      .findOne({ where: { id: tenantId } });
    if (!tenant) {
      console.error(`ERROR: Tenant ${tenantId} not found. Run seed:grc first.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Tenant: ${tenant.name} (${tenantId})`);
    console.log('');

    // Apply content pack
    const result = await applyBaselineContentPack(ds, {
      tenantId,
      adminUserId: DEFAULT_ADMIN_ID,
      dryRun,
    });

    if (result.errors.length > 0) {
      console.error('\nErrors encountered during apply:');
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Content pack apply failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
