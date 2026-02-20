/**
 * Notification Demo Seed Script
 *
 * Creates an idempotent demo dataset for the Notification Engine:
 * - 1 Notification Template: "Incident Created" with title/body using incident number + short description
 * - 1 Notification Rule: "Incident created -> notify admins in-app" linked to the template
 *
 * Usage:
 *   Dev:  npm run seed:notification-demo:dev
 *   Prod: npm run seed:notification-demo
 *
 * This script is idempotent - running it multiple times produces the same result.
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { SysNotificationTemplate } from '../notification-engine/entities/sys-notification-template.entity';
import {
  SysNotificationRule,
  NotificationChannel,
  RecipientType,
} from '../notification-engine/entities/sys-notification-rule.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const DEMO_TEMPLATE_ID = '22222222-2222-2222-2222-222222220001';
const DEMO_RULE_ID = '22222222-2222-2222-2222-222222220002';

async function seedNotificationDemo() {
  console.log('='.repeat(60));
  console.log('Notification Demo Seed');
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
    console.log('2. Creating Notification Template: Incident Created...');
    const templateRepo = dataSource.getRepository(SysNotificationTemplate);
    let template = await templateRepo.findOne({
      where: { id: DEMO_TEMPLATE_ID },
    });

    if (!template) {
      template = templateRepo.create({
        id: DEMO_TEMPLATE_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Incident Created Alert',
        subject: 'New Incident: {{incident_number}} - {{short_description}}',
        body: 'A new incident has been created.\n\nIncident: {{incident_number}}\nDescription: {{short_description}}\nPriority: {{priority}}\nAssigned to: {{assigned_to}}\n\nPlease review and take appropriate action.',
        allowedVariables: [
          'incident_number',
          'short_description',
          'priority',
          'assigned_to',
          'created_by',
          'category',
        ],
        isActive: true,
      });
      await templateRepo.save(template);
      console.log('   Created template: Incident Created Alert');
    } else {
      console.log('   Template already exists: Incident Created Alert');
    }

    console.log('');
    console.log(
      '3. Creating Notification Rule: Incident Created -> Notify Admins...',
    );
    const ruleRepo = dataSource.getRepository(SysNotificationRule);
    let rule = await ruleRepo.findOne({
      where: { id: DEMO_RULE_ID },
    });

    if (!rule) {
      rule = ruleRepo.create({
        id: DEMO_RULE_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Notify admins on incident creation',
        eventName: 'incident.created',
        condition: {},
        channels: [NotificationChannel.IN_APP],
        recipients: [{ type: RecipientType.ROLE, value: 'admin' }],
        templateId: DEMO_TEMPLATE_ID,
        isActive: true,
        rateLimitPerHour: 100,
        tableName: 'itsm_incidents',
        description:
          'Sends an in-app notification to all admin users when a new incident is created.',
      });
      await ruleRepo.save(rule);
      console.log('   Created rule: Notify admins on incident creation');
    } else {
      console.log('   Rule already exists: Notify admins on incident creation');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Notification Demo Seed Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Created entities:');
    console.log(
      '  - Template: Incident Created Alert (ID: ' + DEMO_TEMPLATE_ID + ')',
    );
    console.log(
      '  - Rule: Notify admins on incident creation (ID: ' + DEMO_RULE_ID + ')',
    );
    console.log('');
    console.log(
      'Flow: incident.created event -> rule matches -> in-app notification to admins',
    );
    console.log('');
  } catch (error) {
    console.error('Error seeding notification demo:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedNotificationDemo();
