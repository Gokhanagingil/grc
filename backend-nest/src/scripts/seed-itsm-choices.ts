process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SysChoice } from '../itsm/choice/sys-choice.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ChoiceSeed {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
  parentValue?: string;
}

const ITSM_CHOICES: ChoiceSeed[] = [
  // ---- itsm_incidents.category ----
  {
    tableName: 'itsm_incidents',
    fieldName: 'category',
    value: 'hardware',
    label: 'Hardware',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'category',
    value: 'software',
    label: 'Software',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'category',
    value: 'network',
    label: 'Network',
    sortOrder: 30,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'category',
    value: 'access',
    label: 'Access',
    sortOrder: 40,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'category',
    value: 'other',
    label: 'Other',
    sortOrder: 50,
  },

  // ---- itsm_incidents.impact ----
  {
    tableName: 'itsm_incidents',
    fieldName: 'impact',
    value: 'low',
    label: 'Low',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'impact',
    value: 'medium',
    label: 'Medium',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'impact',
    value: 'high',
    label: 'High',
    sortOrder: 30,
  },

  // ---- itsm_incidents.urgency ----
  {
    tableName: 'itsm_incidents',
    fieldName: 'urgency',
    value: 'low',
    label: 'Low',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'urgency',
    value: 'medium',
    label: 'Medium',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'urgency',
    value: 'high',
    label: 'High',
    sortOrder: 30,
  },

  // ---- itsm_incidents.priority ----
  {
    tableName: 'itsm_incidents',
    fieldName: 'priority',
    value: 'p1',
    label: 'P1 - Critical',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'priority',
    value: 'p2',
    label: 'P2 - High',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'priority',
    value: 'p3',
    label: 'P3 - Medium',
    sortOrder: 30,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'priority',
    value: 'p4',
    label: 'P4 - Low',
    sortOrder: 40,
  },

  // ---- itsm_incidents.status ----
  {
    tableName: 'itsm_incidents',
    fieldName: 'status',
    value: 'open',
    label: 'Open',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'status',
    value: 'in_progress',
    label: 'In Progress',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'status',
    value: 'resolved',
    label: 'Resolved',
    sortOrder: 30,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'status',
    value: 'closed',
    label: 'Closed',
    sortOrder: 40,
  },

  // ---- itsm_incidents.source ----
  {
    tableName: 'itsm_incidents',
    fieldName: 'source',
    value: 'user',
    label: 'User',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'source',
    value: 'monitoring',
    label: 'Monitoring',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'source',
    value: 'email',
    label: 'Email',
    sortOrder: 30,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'source',
    value: 'phone',
    label: 'Phone',
    sortOrder: 40,
  },
  {
    tableName: 'itsm_incidents',
    fieldName: 'source',
    value: 'self_service',
    label: 'Self-Service',
    sortOrder: 50,
  },

  // ---- itsm_changes.type ----
  {
    tableName: 'itsm_changes',
    fieldName: 'type',
    value: 'STANDARD',
    label: 'Standard',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'type',
    value: 'NORMAL',
    label: 'Normal',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'type',
    value: 'EMERGENCY',
    label: 'Emergency',
    sortOrder: 30,
  },

  // ---- itsm_changes.state ----
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    value: 'DRAFT',
    label: 'Draft',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    value: 'ASSESS',
    label: 'Assess',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    value: 'AUTHORIZE',
    label: 'Authorize',
    sortOrder: 30,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    value: 'IMPLEMENT',
    label: 'Implement',
    sortOrder: 40,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    value: 'REVIEW',
    label: 'Review',
    sortOrder: 50,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'state',
    value: 'CLOSED',
    label: 'Closed',
    sortOrder: 60,
  },

  // ---- itsm_changes.risk ----
  {
    tableName: 'itsm_changes',
    fieldName: 'risk',
    value: 'LOW',
    label: 'Low',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'risk',
    value: 'MEDIUM',
    label: 'Medium',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_changes',
    fieldName: 'risk',
    value: 'HIGH',
    label: 'High',
    sortOrder: 30,
  },

  // ---- itsm_services.criticality ----
  {
    tableName: 'itsm_services',
    fieldName: 'criticality',
    value: 'CRITICAL',
    label: 'Critical',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'criticality',
    value: 'HIGH',
    label: 'High',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'criticality',
    value: 'MEDIUM',
    label: 'Medium',
    sortOrder: 30,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'criticality',
    value: 'LOW',
    label: 'Low',
    sortOrder: 40,
  },

  // ---- itsm_services.status ----
  {
    tableName: 'itsm_services',
    fieldName: 'status',
    value: 'ACTIVE',
    label: 'Active',
    sortOrder: 10,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'status',
    value: 'INACTIVE',
    label: 'Inactive',
    sortOrder: 20,
  },
  {
    tableName: 'itsm_services',
    fieldName: 'status',
    value: 'DEPRECATED',
    label: 'Deprecated',
    sortOrder: 30,
  },
];

async function seedItsmChoices() {
  console.log('Starting ITSM choice seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    const repo = dataSource.getRepository(SysChoice);

    let created = 0;
    let skipped = 0;

    for (const choice of ITSM_CHOICES) {
      const existing = await repo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          tableName: choice.tableName,
          fieldName: choice.fieldName,
          value: choice.value,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const entity = repo.create({
        tenantId: DEMO_TENANT_ID,
        tableName: choice.tableName,
        fieldName: choice.fieldName,
        value: choice.value,
        label: choice.label,
        sortOrder: choice.sortOrder,
        isActive: true,
        parentValue: choice.parentValue || null,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await repo.save(entity);
      created++;
    }

    console.log(
      `\nSeed complete: ${created} created, ${skipped} skipped (already exist)`,
    );
    console.log(`Total choices in seed: ${ITSM_CHOICES.length}`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedItsmChoices();
