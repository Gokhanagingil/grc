process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { SysChoice } from '../itsm/choice/sys-choice.entity';
import { CmdbServiceCi } from '../itsm/cmdb/service-ci/cmdb-service-ci.entity';
import { CmdbService } from '../itsm/cmdb/service/cmdb-service.entity';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ChoiceSeed {
  tableName: string;
  fieldName: string;
  value: string;
  label: string;
  sortOrder: number;
}

const RELATIONSHIP_TYPE_CHOICES: ChoiceSeed[] = [
  {
    tableName: 'cmdb_service_ci',
    fieldName: 'relationship_type',
    value: 'depends_on',
    label: 'Depends On',
    sortOrder: 1,
  },
  {
    tableName: 'cmdb_service_ci',
    fieldName: 'relationship_type',
    value: 'hosted_on',
    label: 'Hosted On',
    sortOrder: 2,
  },
  {
    tableName: 'cmdb_service_ci',
    fieldName: 'relationship_type',
    value: 'consumed_by',
    label: 'Consumed By',
    sortOrder: 3,
  },
  {
    tableName: 'cmdb_service_ci',
    fieldName: 'relationship_type',
    value: 'supports',
    label: 'Supports',
    sortOrder: 4,
  },
  {
    tableName: 'cmdb_service_ci',
    fieldName: 'relationship_type',
    value: 'managed_by',
    label: 'Managed By',
    sortOrder: 5,
  },
  {
    tableName: 'cmdb_service_ci',
    fieldName: 'relationship_type',
    value: 'monitored_by',
    label: 'Monitored By',
    sortOrder: 6,
  },
];

async function seedServiceCiMapping() {
  console.log('=== Service-CI Mapping Seed ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    console.log('1) Seeding cmdb_service_ci relationship_type choices...');
    const choiceRepo = ds.getRepository(SysChoice);
    let choiceCreated = 0;
    let choiceSkipped = 0;

    for (const c of RELATIONSHIP_TYPE_CHOICES) {
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
    console.log(
      `   Choices: ${choiceCreated} created, ${choiceSkipped} skipped`,
    );

    console.log('2) Seeding sample service-CI mappings...');
    const svcRepo = ds.getRepository(CmdbService);
    const ciRepo = ds.getRepository(CmdbCi);
    const scRepo = ds.getRepository(CmdbServiceCi);

    const services = await svcRepo.find({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      take: 5,
    });
    const cis = await ciRepo.find({
      where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      take: 5,
    });

    let linkCreated = 0;
    let linkSkipped = 0;

    if (services.length > 0 && cis.length > 0) {
      const mappings = [
        {
          serviceIdx: 0,
          ciIdx: 0,
          relType: 'depends_on',
          isPrimary: true,
        },
        {
          serviceIdx: 0,
          ciIdx: 1 % cis.length,
          relType: 'hosted_on',
          isPrimary: false,
        },
        {
          serviceIdx: 1 % services.length,
          ciIdx: 0,
          relType: 'supports',
          isPrimary: true,
        },
      ];

      for (const m of mappings) {
        const svc = services[m.serviceIdx];
        const ci = cis[m.ciIdx];

        const exists = await scRepo.findOne({
          where: {
            tenantId: DEMO_TENANT_ID,
            serviceId: svc.id,
            ciId: ci.id,
            relationshipType: m.relType,
            isDeleted: false,
          },
        });
        if (exists) {
          linkSkipped++;
          continue;
        }

        const entity = scRepo.create({
          tenantId: DEMO_TENANT_ID,
          serviceId: svc.id,
          ciId: ci.id,
          relationshipType: m.relType,
          isPrimary: m.isPrimary,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await scRepo.save(entity);
        linkCreated++;
        console.log(`   Linked "${svc.name}" -> "${ci.name}" (${m.relType})`);
      }
    } else {
      console.log('   Skipping sample mappings: no services or CIs found.');
    }
    console.log(`   Links: ${linkCreated} created, ${linkSkipped} skipped`);

    console.log('\n=== Service-CI Mapping Seed Complete ===');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedServiceCiMapping();
