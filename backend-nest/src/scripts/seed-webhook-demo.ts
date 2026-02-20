/**
 * Webhook Demo Seed Script
 *
 * Creates an idempotent demo webhook endpoint (disabled by default to avoid external calls).
 *
 * Usage:
 *   Dev:  npm run seed:webhook-demo:dev
 *   Prod: npm run seed:webhook-demo
 *
 * This script is idempotent - running it multiple times produces the same result.
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { SysWebhookEndpoint } from '../notification-engine/entities/sys-webhook-endpoint.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_WEBHOOK_ID = '22222222-2222-2222-2222-222222220010';

async function seedWebhookDemo() {
  console.log('='.repeat(60));
  console.log('Webhook Demo Seed');
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
    console.log('2. Creating Webhook Endpoint (disabled)...');
    const webhookRepo = dataSource.getRepository(SysWebhookEndpoint);
    let webhook = await webhookRepo.findOne({
      where: { id: DEMO_WEBHOOK_ID },
    });

    if (!webhook) {
      webhook = webhookRepo.create({
        id: DEMO_WEBHOOK_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Demo Webhook - Example Integration',
        baseUrl: 'https://example.com/webhook/grc-events',
        secret: null,
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'grc-platform',
        },
        isActive: false,
        maxRetries: 3,
        timeoutMs: 10000,
        description:
          'Example webhook endpoint for demo purposes. Disabled by default to avoid external calls. Enable and update the URL to test webhook delivery.',
        allowInsecure: false,
      });
      await webhookRepo.save(webhook);
      console.log(
        '   Created webhook: Demo Webhook - Example Integration (DISABLED)',
      );
    } else {
      console.log(
        '   Webhook already exists: Demo Webhook - Example Integration',
      );
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Webhook Demo Seed Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Created entities:');
    console.log(
      '  - Webhook: Demo Webhook - Example Integration (ID: ' +
        DEMO_WEBHOOK_ID +
        ')',
    );
    console.log(
      '  - Status: DISABLED (set isActive=true and update baseUrl to use)',
    );
    console.log('');
  } catch (error) {
    console.error('Error seeding webhook demo:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedWebhookDemo();
