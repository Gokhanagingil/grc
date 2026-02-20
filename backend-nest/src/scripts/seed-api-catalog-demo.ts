/**
 * API Catalog Demo Seed Script
 *
 * Creates an idempotent demo dataset for the API Catalog:
 * - 1 Published API: "incidents" read-only with limited fields
 * - 1 API Key: created and printed to console (not committed)
 *
 * Usage:
 *   Dev:  npm run seed:api-catalog-demo:dev
 *   Prod: npm run seed:api-catalog-demo
 *
 * This script is idempotent - running it multiple times produces the same result.
 * The API key raw value is printed ONCE on first creation; it cannot be recovered afterward.
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { SysPublishedApi } from '../api-catalog/entities/sys-published-api.entity';
import { SysApiKey } from '../api-catalog/entities/sys-api-key.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_PUBLISHED_API_ID = '22222222-2222-2222-2222-222222220020';
const DEMO_API_KEY_ID = '22222222-2222-2222-2222-222222220021';

const API_KEY_PREFIX_LENGTH = 8;
const API_KEY_BYTES = 32;
const BCRYPT_COST = 10;

async function seedApiCatalogDemo() {
  console.log('='.repeat(60));
  console.log('API Catalog Demo Seed');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('1. Verifying demo tenant exists...');
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log('   Demo tenant found: ' + tenant.name);

    console.log('');
    console.log('2. Creating Published API: incidents (read-only)...');
    const apiRepo = dataSource.getRepository(SysPublishedApi);
    let publishedApi = await apiRepo.findOne({
      where: { id: DEMO_PUBLISHED_API_ID },
    });

    if (!publishedApi) {
      publishedApi = apiRepo.create({
        id: DEMO_PUBLISHED_API_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'incidents',
        version: 'v1',
        tableName: 'itsm_incidents',
        allowedFields: {
          read: [
            'id',
            'number',
            'short_description',
            'state',
            'priority',
            'category',
            'created_at',
            'updated_at',
          ],
          write: [],
        },
        filterPolicy: [],
        allowList: true,
        allowCreate: false,
        allowUpdate: false,
        rateLimitPerMinute: 60,
        isActive: true,
        description:
          'Read-only API for ITSM incidents. Lists incidents with limited fields (no PII). Created by demo seed.',
      });
      await apiRepo.save(publishedApi);
      console.log('   Created published API: incidents (read-only, v1)');
    } else {
      console.log('   Published API already exists: incidents');
    }

    console.log('');
    console.log('3. Creating API Key for incidents API...');
    const keyRepo = dataSource.getRepository(SysApiKey);
    let apiKey = await keyRepo.findOne({
      where: { id: DEMO_API_KEY_ID },
    });

    if (!apiKey) {
      const rawKey = `grc_${crypto.randomBytes(API_KEY_BYTES).toString('hex')}`;
      const keyHash = await bcrypt.hash(rawKey, BCRYPT_COST);
      const keyPrefix = rawKey.substring(0, API_KEY_PREFIX_LENGTH);

      apiKey = keyRepo.create({
        id: DEMO_API_KEY_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Demo Incidents API Key',
        keyHash,
        keyPrefix,
        scopes: ['incidents:read'],
        isActive: true,
        expiresAt: null,
      });
      await keyRepo.save(apiKey);

      console.log('   Created API key: Demo Incidents API Key');
      console.log('');
      console.log('   ' + '!'.repeat(50));
      console.log('   SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN:');
      console.log('   ' + rawKey);
      console.log('   ' + '!'.repeat(50));
    } else {
      console.log('   API key already exists: Demo Incidents API Key');
      console.log('   (Raw key was shown only on first creation)');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('API Catalog Demo Seed Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Created entities:');
    console.log(
      '  - Published API: incidents v1 (ID: ' + DEMO_PUBLISHED_API_ID + ')',
    );
    console.log(
      '  - API Key: Demo Incidents API Key (ID: ' + DEMO_API_KEY_ID + ')',
    );
    console.log('');
    console.log('Test with:');
    console.log(
      '  curl -H "X-API-Key: grc_..." http://localhost/api/grc/public/v1/incidents/records',
    );
    console.log('');
  } catch (error) {
    console.error('Error seeding API catalog demo:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedApiCatalogDemo();
