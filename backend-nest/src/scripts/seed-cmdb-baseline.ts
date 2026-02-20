process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SysChoice } from '../itsm/choice/sys-choice.entity';
import { CmdbCiClass } from '../itsm/cmdb/ci-class/ci-class.entity';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';
import { CmdbCiRel } from '../itsm/cmdb/ci-rel/ci-rel.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ChoiceSeed {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
}

const CMDB_CHOICES: ChoiceSeed[] = [
  // ---- cmdb_ci.lifecycle ----
  { tableName: 'cmdb_ci', fieldName: 'lifecycle', value: 'installed', label: 'Installed', sortOrder: 10 },
  { tableName: 'cmdb_ci', fieldName: 'lifecycle', value: 'active', label: 'Active', sortOrder: 20 },
  { tableName: 'cmdb_ci', fieldName: 'lifecycle', value: 'maintenance', label: 'Maintenance', sortOrder: 30 },
  { tableName: 'cmdb_ci', fieldName: 'lifecycle', value: 'retired', label: 'Retired', sortOrder: 40 },

  // ---- cmdb_ci.environment ----
  { tableName: 'cmdb_ci', fieldName: 'environment', value: 'production', label: 'Production', sortOrder: 10 },
  { tableName: 'cmdb_ci', fieldName: 'environment', value: 'staging', label: 'Staging', sortOrder: 20 },
  { tableName: 'cmdb_ci', fieldName: 'environment', value: 'development', label: 'Development', sortOrder: 30 },
  { tableName: 'cmdb_ci', fieldName: 'environment', value: 'test', label: 'Test', sortOrder: 40 },
  { tableName: 'cmdb_ci', fieldName: 'environment', value: 'dr', label: 'Disaster Recovery', sortOrder: 50 },

  // ---- cmdb_ci_rel.type ----
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'depends_on', label: 'Depends On', sortOrder: 10 },
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'runs_on', label: 'Runs On', sortOrder: 20 },
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'hosted_on', label: 'Hosted On', sortOrder: 30 },
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'connects_to', label: 'Connects To', sortOrder: 40 },
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'used_by', label: 'Used By', sortOrder: 50 },
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'contains', label: 'Contains', sortOrder: 60 },
  { tableName: 'cmdb_ci_rel', fieldName: 'type', value: 'member_of', label: 'Member Of', sortOrder: 70 },
];

interface CiClassSeed {
  name: string;
  label: string;
  description: string;
  icon: string;
  sortOrder: number;
}

const CI_CLASSES: CiClassSeed[] = [
  { name: 'server', label: 'Server', description: 'Physical or virtual server', icon: 'dns', sortOrder: 10 },
  { name: 'virtual_machine', label: 'Virtual Machine', description: 'Virtual machine instance', icon: 'computer', sortOrder: 20 },
  { name: 'database', label: 'Database', description: 'Database instance', icon: 'storage', sortOrder: 30 },
  { name: 'application', label: 'Application', description: 'Software application or service', icon: 'apps', sortOrder: 40 },
  { name: 'network_device', label: 'Network Device', description: 'Router, switch, firewall, or load balancer', icon: 'router', sortOrder: 50 },
  { name: 'storage', label: 'Storage', description: 'SAN, NAS, or storage array', icon: 'sd_storage', sortOrder: 60 },
  { name: 'container', label: 'Container', description: 'Docker container or Kubernetes pod', icon: 'view_in_ar', sortOrder: 70 },
  { name: 'cloud_service', label: 'Cloud Service', description: 'Cloud-hosted service (AWS, Azure, GCP)', icon: 'cloud', sortOrder: 80 },
  { name: 'endpoint', label: 'Endpoint', description: 'Workstation, laptop, or mobile device', icon: 'laptop', sortOrder: 90 },
  { name: 'cluster', label: 'Cluster', description: 'Server or database cluster', icon: 'hub', sortOrder: 100 },
];

interface CiSeed {
  name: string;
  description: string;
  className: string;
  lifecycle: string;
  environment: string;
  ipAddress?: string;
  dnsName?: string;
}

const SAMPLE_CIS: CiSeed[] = [
  { name: 'PROD-WEB-01', description: 'Primary web application server', className: 'server', lifecycle: 'active', environment: 'production', ipAddress: '10.0.1.10', dnsName: 'prod-web-01.internal' },
  { name: 'PROD-WEB-02', description: 'Secondary web application server', className: 'server', lifecycle: 'active', environment: 'production', ipAddress: '10.0.1.11', dnsName: 'prod-web-02.internal' },
  { name: 'PROD-DB-PRIMARY', description: 'Primary PostgreSQL database', className: 'database', lifecycle: 'active', environment: 'production', ipAddress: '10.0.2.10', dnsName: 'prod-db-primary.internal' },
  { name: 'PROD-DB-REPLICA', description: 'PostgreSQL read replica', className: 'database', lifecycle: 'active', environment: 'production', ipAddress: '10.0.2.11', dnsName: 'prod-db-replica.internal' },
  { name: 'GRC-Platform', description: 'GRC Platform application', className: 'application', lifecycle: 'active', environment: 'production' },
  { name: 'PROD-LB-01', description: 'Production load balancer (nginx)', className: 'network_device', lifecycle: 'active', environment: 'production', ipAddress: '10.0.0.10' },
  { name: 'STG-WEB-01', description: 'Staging web server', className: 'server', lifecycle: 'active', environment: 'staging', ipAddress: '10.1.1.10' },
  { name: 'STG-DB-01', description: 'Staging database', className: 'database', lifecycle: 'active', environment: 'staging', ipAddress: '10.1.2.10' },
  { name: 'DEV-K8S-CLUSTER', description: 'Development Kubernetes cluster', className: 'cluster', lifecycle: 'active', environment: 'development' },
  { name: 'PROD-REDIS-01', description: 'Production Redis cache', className: 'cloud_service', lifecycle: 'active', environment: 'production', ipAddress: '10.0.3.10' },
];

interface RelSeed {
  sourceName: string;
  targetName: string;
  type: string;
}

const SAMPLE_RELS: RelSeed[] = [
  { sourceName: 'GRC-Platform', targetName: 'PROD-WEB-01', type: 'runs_on' },
  { sourceName: 'GRC-Platform', targetName: 'PROD-WEB-02', type: 'runs_on' },
  { sourceName: 'GRC-Platform', targetName: 'PROD-DB-PRIMARY', type: 'depends_on' },
  { sourceName: 'PROD-WEB-01', targetName: 'PROD-LB-01', type: 'connects_to' },
  { sourceName: 'PROD-WEB-02', targetName: 'PROD-LB-01', type: 'connects_to' },
  { sourceName: 'PROD-DB-REPLICA', targetName: 'PROD-DB-PRIMARY', type: 'depends_on' },
  { sourceName: 'GRC-Platform', targetName: 'PROD-REDIS-01', type: 'depends_on' },
  { sourceName: 'STG-WEB-01', targetName: 'STG-DB-01', type: 'depends_on' },
];

async function seedCmdbBaseline() {
  console.log('=== CMDB Baseline Seed ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    // ── 1. Seed CMDB choices ──
    console.log('1) Seeding CMDB sys_choice entries...');
    const choiceRepo = ds.getRepository(SysChoice);
    let choiceCreated = 0;
    let choiceSkipped = 0;

    for (const c of CMDB_CHOICES) {
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

    // ── 2. Seed CI Classes ──
    console.log('2) Seeding CI classes...');
    const classRepo = ds.getRepository(CmdbCiClass);
    let classCreated = 0;
    let classSkipped = 0;
    const classMap: Record<string, string> = {};

    for (const cls of CI_CLASSES) {
      let existing = await classRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: cls.name, isDeleted: false },
      });
      if (existing) {
        classMap[cls.name] = existing.id;
        classSkipped++;
        continue;
      }
      existing = classRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: cls.name,
        label: cls.label,
        description: cls.description,
        icon: cls.icon,
        sortOrder: cls.sortOrder,
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      const saved = await classRepo.save(existing);
      classMap[cls.name] = saved.id;
      classCreated++;
    }
    console.log(`   CI Classes: ${classCreated} created, ${classSkipped} skipped`);

    // ── 3. Seed sample CIs ──
    console.log('3) Seeding sample CIs...');
    const ciRepo = ds.getRepository(CmdbCi);
    let ciCreated = 0;
    let ciSkipped = 0;
    const ciMap: Record<string, string> = {};

    for (const ci of SAMPLE_CIS) {
      const classId = classMap[ci.className];
      if (!classId) {
        console.warn(`   WARN: class '${ci.className}' not found, skipping CI '${ci.name}'`);
        continue;
      }
      let existing = await ciRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: ci.name, isDeleted: false },
      });
      if (existing) {
        ciMap[ci.name] = existing.id;
        ciSkipped++;
        continue;
      }
      existing = ciRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: ci.name,
        description: ci.description,
        classId,
        lifecycle: ci.lifecycle,
        environment: ci.environment,
        ipAddress: ci.ipAddress || null,
        dnsName: ci.dnsName || null,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      const saved = await ciRepo.save(existing);
      ciMap[ci.name] = saved.id;
      ciCreated++;
    }
    console.log(`   CIs: ${ciCreated} created, ${ciSkipped} skipped`);

    // ── 4. Seed sample relationships ──
    console.log('4) Seeding CI relationships...');
    const relRepo = ds.getRepository(CmdbCiRel);
    let relCreated = 0;
    let relSkipped = 0;

    for (const rel of SAMPLE_RELS) {
      const sourceId = ciMap[rel.sourceName];
      const targetId = ciMap[rel.targetName];
      if (!sourceId || !targetId) {
        console.warn(`   WARN: CI not found for rel ${rel.sourceName} -> ${rel.targetName}, skipping`);
        continue;
      }
      const existing = await relRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          sourceCiId: sourceId,
          targetCiId: targetId,
          type: rel.type,
          isDeleted: false,
        },
      });
      if (existing) {
        relSkipped++;
        continue;
      }
      const entity = relRepo.create({
        tenantId: DEMO_TENANT_ID,
        sourceCiId: sourceId,
        targetCiId: targetId,
        type: rel.type,
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await relRepo.save(entity);
      relCreated++;
    }
    console.log(`   Relationships: ${relCreated} created, ${relSkipped} skipped`);

    console.log('\n=== CMDB Baseline Seed Complete ===');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedCmdbBaseline();
