process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Tenant } from '../tenants/tenant.entity';
import { CmdbCiClass } from '../itsm/cmdb/ci-class/ci-class.entity';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';
import { CmdbCiRel } from '../itsm/cmdb/ci-rel/ci-rel.entity';
import { CmdbService } from '../itsm/cmdb/service/cmdb-service.entity';
import { CmdbServiceCi } from '../itsm/cmdb/service-ci/cmdb-service-ci.entity';

// ============================================================================
// Constants — deterministic IDs for idempotent upserts
// ============================================================================

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

// Topology-demo CIs (6 new CIs with unique prefix)
const TOPO_CI_PREFIX = 'bbbb0001-0000-0000-0000-';
const TOPO_CI_IDS = {
  API_GATEWAY: `${TOPO_CI_PREFIX}000000000001`,
  AUTH_SERVICE: `${TOPO_CI_PREFIX}000000000002`,
  USER_DB: `${TOPO_CI_PREFIX}000000000003`,
  CACHE_REDIS: `${TOPO_CI_PREFIX}000000000004`,
  MSG_QUEUE: `${TOPO_CI_PREFIX}000000000005`,
  MONITORING: `${TOPO_CI_PREFIX}000000000006`,
};

// Topology-demo Service (1)
const TOPO_SVC_PREFIX = 'bbbb0002-0000-0000-0000-';
const TOPO_SVC_ID = `${TOPO_SVC_PREFIX}000000000001`;

// ============================================================================
// Seed data
// ============================================================================

interface CiSeed {
  id: string;
  name: string;
  description: string;
  className: string;
  lifecycle: string;
  environment: string;
  ipAddress?: string;
  dnsName?: string;
}

const TOPOLOGY_CIS: CiSeed[] = [
  {
    id: TOPO_CI_IDS.API_GATEWAY,
    name: 'TOPO-API-GW',
    description: 'API Gateway — routes all external traffic',
    className: 'application',
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.10.0.1',
    dnsName: 'api-gw.prod.internal',
  },
  {
    id: TOPO_CI_IDS.AUTH_SERVICE,
    name: 'TOPO-AUTH-SVC',
    description: 'Authentication & authorization microservice',
    className: 'application',
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.10.0.2',
  },
  {
    id: TOPO_CI_IDS.USER_DB,
    name: 'TOPO-USER-DB',
    description: 'PostgreSQL user/account database (primary)',
    className: 'database',
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.10.1.10',
    dnsName: 'user-db.prod.internal',
  },
  {
    id: TOPO_CI_IDS.CACHE_REDIS,
    name: 'TOPO-CACHE',
    description: 'Redis cache for sessions & hot data',
    className: 'cloud_service',
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.10.2.10',
  },
  {
    id: TOPO_CI_IDS.MSG_QUEUE,
    name: 'TOPO-MQ',
    description: 'Message queue (RabbitMQ) for async processing',
    className: 'application',
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.10.3.10',
  },
  {
    id: TOPO_CI_IDS.MONITORING,
    name: 'TOPO-MON',
    description: 'Monitoring & alerting stack (Prometheus + Grafana)',
    className: 'cloud_service',
    lifecycle: 'active',
    environment: 'production',
    ipAddress: '10.10.4.10',
  },
];

interface RelSeed {
  sourceId: string;
  targetId: string;
  type: string;
}

const TOPOLOGY_RELS: RelSeed[] = [
  // API Gateway depends on Auth Service
  {
    sourceId: TOPO_CI_IDS.API_GATEWAY,
    targetId: TOPO_CI_IDS.AUTH_SERVICE,
    type: 'depends_on',
  },
  // Auth Service depends on User DB
  {
    sourceId: TOPO_CI_IDS.AUTH_SERVICE,
    targetId: TOPO_CI_IDS.USER_DB,
    type: 'depends_on',
  },
  // Auth Service depends on Cache
  {
    sourceId: TOPO_CI_IDS.AUTH_SERVICE,
    targetId: TOPO_CI_IDS.CACHE_REDIS,
    type: 'depends_on',
  },
  // API Gateway connects to Message Queue
  {
    sourceId: TOPO_CI_IDS.API_GATEWAY,
    targetId: TOPO_CI_IDS.MSG_QUEUE,
    type: 'connects_to',
  },
  // Monitoring monitors API Gateway
  {
    sourceId: TOPO_CI_IDS.MONITORING,
    targetId: TOPO_CI_IDS.API_GATEWAY,
    type: 'connects_to',
  },
  // Monitoring monitors Auth Service
  {
    sourceId: TOPO_CI_IDS.MONITORING,
    targetId: TOPO_CI_IDS.AUTH_SERVICE,
    type: 'connects_to',
  },
  // Monitoring monitors User DB
  {
    sourceId: TOPO_CI_IDS.MONITORING,
    targetId: TOPO_CI_IDS.USER_DB,
    type: 'connects_to',
  },
  // Message Queue connects to Auth Service
  {
    sourceId: TOPO_CI_IDS.MSG_QUEUE,
    targetId: TOPO_CI_IDS.AUTH_SERVICE,
    type: 'connects_to',
  },
];

// ============================================================================
// Main
// ============================================================================

async function seedTopologyDemo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('CMDB Topology Demo Seed');
  console.log('='.repeat(60));
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    // 1. Verify tenant
    console.log('1. Verifying demo tenant...');
    const tenant = await ds
      .getRepository(Tenant)
      .findOne({ where: { id: DEMO_TENANT_ID } });
    if (!tenant) {
      console.error('   ERROR: Demo tenant not found. Run seed:grc first.');
      process.exit(1);
    }
    console.log(`   Demo tenant: ${tenant.name}`);

    // 2. Resolve CI class IDs
    console.log('');
    console.log('2. Resolving CI classes...');
    const classRepo = ds.getRepository(CmdbCiClass);
    const classMap: Record<string, string> = {};

    const classes = await classRepo.find({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
    });
    for (const cls of classes) {
      classMap[cls.name] = cls.id;
    }

    const requiredClasses = [...new Set(TOPOLOGY_CIS.map((c) => c.className))];
    const missingClasses = requiredClasses.filter((c) => !classMap[c]);
    if (missingClasses.length > 0) {
      console.error(
        `   ERROR: Missing CI classes: ${missingClasses.join(', ')}. Run seed:cmdb:baseline first.`,
      );
      process.exit(1);
    }
    console.log(`   Resolved ${Object.keys(classMap).length} CI classes`);

    // 3. Seed topology CIs
    console.log('');
    console.log('3. Seeding topology demo CIs (6)...');
    const ciRepo = ds.getRepository(CmdbCi);
    let ciCreated = 0;
    let ciSkipped = 0;

    for (const ci of TOPOLOGY_CIS) {
      const classId = classMap[ci.className];

      const existing = await ciRepo.findOne({
        where: { id: ci.id, tenantId: DEMO_TENANT_ID },
      });
      if (existing) {
        ciSkipped++;
        continue;
      }
      const entity = ciRepo.create({
        id: ci.id,
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
      await ciRepo.save(entity);
      ciCreated++;
      console.log(`   + Created CI: ${ci.name}`);
    }
    console.log(`   CIs: ${ciCreated} created, ${ciSkipped} skipped`);

    // 4. Seed topology CI relationships
    console.log('');
    console.log('4. Seeding topology CI relationships (8)...');
    const relRepo = ds.getRepository(CmdbCiRel);
    let relCreated = 0;
    let relSkipped = 0;

    for (const rel of TOPOLOGY_RELS) {
      const existing = await relRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          sourceCiId: rel.sourceId,
          targetCiId: rel.targetId,
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
        sourceCiId: rel.sourceId,
        targetCiId: rel.targetId,
        type: rel.type,
        isActive: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await relRepo.save(entity);
      relCreated++;
    }
    console.log(
      `   Relationships: ${relCreated} created, ${relSkipped} skipped`,
    );

    // 5. Seed a CMDB Service linked to topology CIs
    console.log('');
    console.log('5. Seeding topology demo Service (1)...');
    const svcRepo = ds.getRepository(CmdbService);

    let svc = await svcRepo.findOne({
      where: { id: TOPO_SVC_ID, tenantId: DEMO_TENANT_ID },
    });
    if (!svc) {
      svc = svcRepo.create({
        id: TOPO_SVC_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'TOPO-Auth-Platform',
        description:
          'Authentication Platform Service — topology demo service wrapping auth stack',
        status: 'active',
        tier: 'tier_1',
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await svcRepo.save(svc);
      console.log('   + Created Service: TOPO-Auth-Platform');
    } else {
      console.log('   = Service already exists: TOPO-Auth-Platform');
    }

    // 6. Link service to CIs
    console.log('');
    console.log('6. Linking service to CIs...');
    const scRepo = ds.getRepository(CmdbServiceCi);
    let linkCreated = 0;
    let linkSkipped = 0;

    const serviceLinks = [
      {
        ciId: TOPO_CI_IDS.API_GATEWAY,
        relType: 'depends_on',
        isPrimary: true,
      },
      {
        ciId: TOPO_CI_IDS.AUTH_SERVICE,
        relType: 'depends_on',
        isPrimary: true,
      },
      {
        ciId: TOPO_CI_IDS.USER_DB,
        relType: 'hosted_on',
        isPrimary: false,
      },
      {
        ciId: TOPO_CI_IDS.CACHE_REDIS,
        relType: 'depends_on',
        isPrimary: false,
      },
    ];

    for (const link of serviceLinks) {
      const existing = await scRepo.findOne({
        where: {
          tenantId: DEMO_TENANT_ID,
          serviceId: TOPO_SVC_ID,
          ciId: link.ciId,
          relationshipType: link.relType,
          isDeleted: false,
        },
      });
      if (existing) {
        linkSkipped++;
        continue;
      }
      const entity = scRepo.create({
        tenantId: DEMO_TENANT_ID,
        serviceId: TOPO_SVC_ID,
        ciId: link.ciId,
        relationshipType: link.relType,
        isPrimary: link.isPrimary,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await scRepo.save(entity);
      linkCreated++;
    }
    console.log(
      `   Service-CI links: ${linkCreated} created, ${linkSkipped} skipped`,
    );

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Topology Demo Seed Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('Graph summary:');
    console.log(
      '  - 6 CIs (API Gateway, Auth Service, User DB, Cache, MQ, Monitoring)',
    );
    console.log('  - 8 CI-CI relationships (depends_on, connects_to)');
    console.log('  - 1 Service (TOPO-Auth-Platform)');
    console.log('  - 4 Service-CI links');
    console.log('');
    console.log('Test topology via:');
    console.log(
      `  GET /grc/cmdb/topology/ci/${TOPO_CI_IDS.API_GATEWAY}?depth=2`,
    );
    console.log(`  GET /grc/cmdb/topology/service/${TOPO_SVC_ID}?depth=2`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedTopologyDemo();
