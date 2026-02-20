process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SysChoice } from '../itsm/choice/sys-choice.entity';
import { CmdbService } from '../itsm/cmdb/service/cmdb-service.entity';
import { CmdbServiceOffering } from '../itsm/cmdb/service-offering/cmdb-service-offering.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ChoiceSeed {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
}

const SERVICE_CHOICES: ChoiceSeed[] = [
  { tableName: 'cmdb_service', fieldName: 'type', value: 'business_service', label: 'Business Service', sortOrder: 1 },
  { tableName: 'cmdb_service', fieldName: 'type', value: 'technical_service', label: 'Technical Service', sortOrder: 2 },

  { tableName: 'cmdb_service', fieldName: 'status', value: 'planned', label: 'Planned', sortOrder: 1 },
  { tableName: 'cmdb_service', fieldName: 'status', value: 'design', label: 'Design', sortOrder: 2 },
  { tableName: 'cmdb_service', fieldName: 'status', value: 'live', label: 'Live', sortOrder: 3 },
  { tableName: 'cmdb_service', fieldName: 'status', value: 'retired', label: 'Retired', sortOrder: 4 },

  { tableName: 'cmdb_service', fieldName: 'tier', value: 'tier_0', label: 'Tier 0 - Mission Critical', sortOrder: 1 },
  { tableName: 'cmdb_service', fieldName: 'tier', value: 'tier_1', label: 'Tier 1 - Business Critical', sortOrder: 2 },
  { tableName: 'cmdb_service', fieldName: 'tier', value: 'tier_2', label: 'Tier 2 - Business Operational', sortOrder: 3 },
  { tableName: 'cmdb_service', fieldName: 'tier', value: 'tier_3', label: 'Tier 3 - Administrative', sortOrder: 4 },

  { tableName: 'cmdb_service', fieldName: 'criticality', value: 'critical', label: 'Critical', sortOrder: 1 },
  { tableName: 'cmdb_service', fieldName: 'criticality', value: 'high', label: 'High', sortOrder: 2 },
  { tableName: 'cmdb_service', fieldName: 'criticality', value: 'medium', label: 'Medium', sortOrder: 3 },
  { tableName: 'cmdb_service', fieldName: 'criticality', value: 'low', label: 'Low', sortOrder: 4 },

  { tableName: 'cmdb_service_offering', fieldName: 'status', value: 'planned', label: 'Planned', sortOrder: 1 },
  { tableName: 'cmdb_service_offering', fieldName: 'status', value: 'live', label: 'Live', sortOrder: 2 },
  { tableName: 'cmdb_service_offering', fieldName: 'status', value: 'retired', label: 'Retired', sortOrder: 3 },
];

interface ServiceSeed {
  name: string;
  description: string;
  type: string;
  status: string;
  tier: string;
  criticality: string;
}

const SAMPLE_SERVICES: ServiceSeed[] = [
  {
    name: 'Email & Collaboration',
    description: 'Corporate email, calendar, and collaboration tools (Exchange/M365)',
    type: 'business_service',
    status: 'live',
    tier: 'tier_1',
    criticality: 'high',
  },
  {
    name: 'ERP Finance',
    description: 'Enterprise resource planning – finance module',
    type: 'business_service',
    status: 'live',
    tier: 'tier_0',
    criticality: 'critical',
  },
  {
    name: 'GRC Platform',
    description: 'Governance, Risk & Compliance platform',
    type: 'business_service',
    status: 'live',
    tier: 'tier_1',
    criticality: 'high',
  },
  {
    name: 'Kubernetes Platform',
    description: 'Shared Kubernetes hosting platform for containerized workloads',
    type: 'technical_service',
    status: 'live',
    tier: 'tier_0',
    criticality: 'critical',
  },
  {
    name: 'CI/CD Pipeline',
    description: 'Continuous integration and deployment pipeline service',
    type: 'technical_service',
    status: 'live',
    tier: 'tier_2',
    criticality: 'medium',
  },
];

interface OfferingSeed {
  serviceName: string;
  name: string;
  status: string;
  supportHours: string;
}

const SAMPLE_OFFERINGS: OfferingSeed[] = [
  { serviceName: 'Email & Collaboration', name: 'Standard Mailbox (50 GB)', status: 'live', supportHours: '8x5' },
  { serviceName: 'Email & Collaboration', name: 'Premium Mailbox (100 GB + Archiving)', status: 'live', supportHours: '24x7' },
  { serviceName: 'ERP Finance', name: 'Finance Module – Full Access', status: 'live', supportHours: '24x7' },
  { serviceName: 'ERP Finance', name: 'Finance Module – Read Only', status: 'live', supportHours: '8x5' },
  { serviceName: 'GRC Platform', name: 'GRC Standard License', status: 'live', supportHours: '8x5' },
  { serviceName: 'Kubernetes Platform', name: 'Shared Namespace', status: 'live', supportHours: '24x7' },
  { serviceName: 'Kubernetes Platform', name: 'Dedicated Namespace', status: 'planned', supportHours: '24x7' },
  { serviceName: 'CI/CD Pipeline', name: 'Standard Pipeline Runner', status: 'live', supportHours: '8x5' },
];

async function seedServicePortfolio() {
  console.log('=== Service Portfolio Seed ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    console.log('1) Seeding service portfolio sys_choice entries...');
    const choiceRepo = ds.getRepository(SysChoice);
    let choiceCreated = 0;
    let choiceSkipped = 0;

    for (const c of SERVICE_CHOICES) {
      const exists = await choiceRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          tableName: c.tableName,
          fieldName: c.fieldName,
          value: c.value,
        },
      });
      if (exists) {
        choiceSkipped++;
        continue;
      }
      const entity = choiceRepo.create({
        tenantId: DEMO_TENANT_ID,
        tableName: c.tableName,
        fieldName: c.fieldName,
        value: c.value,
        label: c.label,
        sortOrder: c.sortOrder,
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await choiceRepo.save(entity);
      choiceCreated++;
    }
    console.log(`   Choices: ${choiceCreated} created, ${choiceSkipped} skipped`);

    console.log('2) Seeding sample services...');
    const svcRepo = ds.getRepository(CmdbService);
    let svcCreated = 0;
    let svcSkipped = 0;
    const svcMap: Record<string, string> = {};

    for (const svc of SAMPLE_SERVICES) {
      let existing = await svcRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: svc.name, isDeleted: false },
      });
      if (existing) {
        svcMap[svc.name] = existing.id;
        svcSkipped++;
        continue;
      }
      existing = svcRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: svc.name,
        description: svc.description,
        type: svc.type,
        status: svc.status,
        tier: svc.tier,
        criticality: svc.criticality,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      const saved = await svcRepo.save(existing);
      svcMap[svc.name] = saved.id;
      svcCreated++;
    }
    console.log(`   Services: ${svcCreated} created, ${svcSkipped} skipped`);

    console.log('3) Seeding sample service offerings...');
    const offRepo = ds.getRepository(CmdbServiceOffering);
    let offCreated = 0;
    let offSkipped = 0;

    for (const off of SAMPLE_OFFERINGS) {
      const serviceId = svcMap[off.serviceName];
      if (!serviceId) {
        console.warn(`   WARN: service '${off.serviceName}' not found, skipping offering '${off.name}'`);
        continue;
      }
      const existing = await offRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, serviceId, name: off.name, isDeleted: false },
      });
      if (existing) {
        offSkipped++;
        continue;
      }
      const entity = offRepo.create({
        tenantId: DEMO_TENANT_ID,
        serviceId,
        name: off.name,
        status: off.status,
        supportHours: off.supportHours,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await offRepo.save(entity);
      offCreated++;
    }
    console.log(`   Offerings: ${offCreated} created, ${offSkipped} skipped`);

    console.log('\n=== Service Portfolio Seed Complete ===');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedServicePortfolio();
