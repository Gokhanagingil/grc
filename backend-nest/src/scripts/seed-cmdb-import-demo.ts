process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { CmdbCi } from '../itsm/cmdb/ci/ci.entity';
import {
  CmdbImportSource,
  ImportSourceType,
} from '../itsm/cmdb/import/cmdb-import-source.entity';
import {
  CmdbImportJob,
  ImportJobStatus,
} from '../itsm/cmdb/import/cmdb-import-job.entity';
import {
  CmdbImportRow,
  ImportRowStatus,
} from '../itsm/cmdb/import/cmdb-import-row.entity';
import { CmdbReconcileRule } from '../itsm/cmdb/import/cmdb-reconcile-rule.entity';
import {
  CmdbReconcileResult,
  ReconcileAction,
  ReconcileDiffField,
} from '../itsm/cmdb/import/cmdb-reconcile-result.entity';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ADMIN_ID = '00000000-0000-0000-0000-000000000002';

interface ImportRowSeed {
  rowNo: number;
  raw: Record<string, unknown>;
  parsed: Record<string, unknown>;
  status: ImportRowStatus;
  errorMessage: string | null;
}

const DEMO_IMPORT_ROWS: ImportRowSeed[] = [
  {
    rowNo: 1,
    raw: {
      hostname: 'PROD-WEB-01',
      description: 'Primary web server (updated)',
      environment: 'production',
    },
    parsed: {
      hostname: 'PROD-WEB-01',
      description: 'Primary web server (updated)',
      environment: 'production',
    },
    status: ImportRowStatus.MATCHED,
    errorMessage: null,
  },
  {
    rowNo: 2,
    raw: {
      hostname: 'PROD-WEB-02',
      description: 'Secondary web application server',
      environment: 'production',
    },
    parsed: {
      hostname: 'PROD-WEB-02',
      description: 'Secondary web application server',
      environment: 'production',
    },
    status: ImportRowStatus.MATCHED,
    errorMessage: null,
  },
  {
    rowNo: 3,
    raw: {
      hostname: 'PROD-DB-PRIMARY',
      description: 'Primary PostgreSQL - migrated to v16',
      environment: 'production',
    },
    parsed: {
      hostname: 'PROD-DB-PRIMARY',
      description: 'Primary PostgreSQL - migrated to v16',
      environment: 'production',
    },
    status: ImportRowStatus.MATCHED,
    errorMessage: null,
  },
  {
    rowNo: 4,
    raw: {
      hostname: 'NEW-API-GW-01',
      description: 'New API gateway',
      environment: 'production',
      ip_address: '10.0.4.10',
    },
    parsed: {
      hostname: 'NEW-API-GW-01',
      description: 'New API gateway',
      environment: 'production',
      ip_address: '10.0.4.10',
    },
    status: ImportRowStatus.PARSED,
    errorMessage: null,
  },
  {
    rowNo: 5,
    raw: {
      hostname: 'NEW-CACHE-01',
      description: 'New Redis cluster node',
      environment: 'production',
      ip_address: '10.0.5.10',
    },
    parsed: {
      hostname: 'NEW-CACHE-01',
      description: 'New Redis cluster node',
      environment: 'production',
      ip_address: '10.0.5.10',
    },
    status: ImportRowStatus.PARSED,
    errorMessage: null,
  },
  {
    rowNo: 6,
    raw: {
      hostname: 'NEW-QUEUE-01',
      description: 'Message queue broker',
      environment: 'production',
      ip_address: '10.0.6.10',
    },
    parsed: {
      hostname: 'NEW-QUEUE-01',
      description: 'Message queue broker',
      environment: 'production',
      ip_address: '10.0.6.10',
    },
    status: ImportRowStatus.PARSED,
    errorMessage: null,
  },
  {
    rowNo: 7,
    raw: {
      hostname: 'PROD-WEB-01',
      description: 'Web server - different serial',
      ip_address: '192.168.99.1',
    },
    parsed: {
      hostname: 'PROD-WEB-01',
      description: 'Web server - different serial',
      ip_address: '192.168.99.1',
    },
    status: ImportRowStatus.CONFLICT,
    errorMessage: null,
  },
  {
    rowNo: 8,
    raw: {
      hostname: 'PROD-LB-01',
      description: 'Load balancer updated',
      ip_address: '10.0.0.99',
    },
    parsed: {
      hostname: 'PROD-LB-01',
      description: 'Load balancer updated',
      ip_address: '10.0.0.99',
    },
    status: ImportRowStatus.CONFLICT,
    errorMessage: null,
  },
  {
    rowNo: 9,
    raw: {
      hostname: 'STG-WEB-01',
      description: 'Staging web - updated',
      environment: 'staging',
    },
    parsed: {
      hostname: 'STG-WEB-01',
      description: 'Staging web - updated',
      environment: 'staging',
    },
    status: ImportRowStatus.MATCHED,
    errorMessage: null,
  },
  {
    rowNo: 10,
    raw: {
      hostname: 'NEW-MONITOR-01',
      description: 'Monitoring server',
      environment: 'production',
      ip_address: '10.0.7.10',
    },
    parsed: {
      hostname: 'NEW-MONITOR-01',
      description: 'Monitoring server',
      environment: 'production',
      ip_address: '10.0.7.10',
    },
    status: ImportRowStatus.PARSED,
    errorMessage: null,
  },
  {
    rowNo: 11,
    raw: {
      hostname: '',
      description: 'Missing hostname row',
      environment: 'production',
    },
    parsed: {
      hostname: '',
      description: 'Missing hostname row',
      environment: 'production',
    },
    status: ImportRowStatus.ERROR,
    errorMessage: 'Required field "hostname" is empty',
  },
  {
    rowNo: 12,
    raw: {
      hostname: 'PROD-DB-REPLICA',
      description: 'Read replica - unchanged',
      environment: 'production',
    },
    parsed: {
      hostname: 'PROD-DB-REPLICA',
      description: 'Read replica - unchanged',
      environment: 'production',
    },
    status: ImportRowStatus.MATCHED,
    errorMessage: null,
  },
  {
    rowNo: 13,
    raw: {
      hostname: 'DEV-K8S-CLUSTER',
      description: 'K8s cluster - new version',
      environment: 'development',
    },
    parsed: {
      hostname: 'DEV-K8S-CLUSTER',
      description: 'K8s cluster - new version',
      environment: 'development',
    },
    status: ImportRowStatus.MATCHED,
    errorMessage: null,
  },
  {
    rowNo: 14,
    raw: {
      hostname: 'NEW-BACKUP-01',
      description: 'Backup server',
      environment: 'production',
      ip_address: '10.0.8.10',
    },
    parsed: {
      hostname: 'NEW-BACKUP-01',
      description: 'Backup server',
      environment: 'production',
      ip_address: '10.0.8.10',
    },
    status: ImportRowStatus.PARSED,
    errorMessage: null,
  },
  {
    rowNo: 15,
    raw: {
      hostname: 'PROD-REDIS-01',
      description: 'Redis cache - config change',
      environment: 'production',
      ip_address: '10.0.3.99',
    },
    parsed: {
      hostname: 'PROD-REDIS-01',
      description: 'Redis cache - config change',
      environment: 'production',
      ip_address: '10.0.3.99',
    },
    status: ImportRowStatus.CONFLICT,
    errorMessage: null,
  },
];

async function seedCmdbImportDemo() {
  console.log('=== CMDB Import & Reconcile Demo Seed ===\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  try {
    const sourceRepo = ds.getRepository(CmdbImportSource);
    const jobRepo = ds.getRepository(CmdbImportJob);
    const rowRepo = ds.getRepository(CmdbImportRow);
    const ruleRepo = ds.getRepository(CmdbReconcileRule);
    const resultRepo = ds.getRepository(CmdbReconcileResult);
    const ciRepo = ds.getRepository(CmdbCi);

    console.log('1) Seeding import source...');
    let source = await sourceRepo.findOne({
      where: { tenantId: DEMO_TENANT_ID, name: 'Demo CSV Import' },
    });
    if (!source) {
      source = sourceRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: 'Demo CSV Import',
        type: ImportSourceType.CSV,
        config: { delimiter: ',', encoding: 'utf-8' },
        enabled: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      source = await sourceRepo.save(source);
      console.log('   Source created: ' + source.id);
    } else {
      console.log('   Source already exists, skipped');
    }

    console.log('2) Seeding reconcile rules...');
    const rulesDef = [
      {
        name: 'Hostname Exact Match',
        matchStrategy: {
          type: 'exact' as const,
          fields: [
            {
              field: 'hostname',
              ciField: 'name',
              weight: 1,
              uniqueRequired: true,
            },
          ],
        },
        precedence: 0,
      },
      {
        name: 'IP Address Match',
        matchStrategy: {
          type: 'exact' as const,
          fields: [
            {
              field: 'ip_address',
              ciField: 'ipAddress',
              weight: 1,
              uniqueRequired: true,
            },
          ],
        },
        precedence: 1,
      },
      {
        name: 'Hostname + Environment Composite',
        matchStrategy: {
          type: 'composite' as const,
          fields: [
            {
              field: 'hostname',
              ciField: 'name',
              weight: 2,
              uniqueRequired: true,
            },
            {
              field: 'environment',
              ciField: 'environment',
              weight: 1,
              uniqueRequired: false,
            },
          ],
        },
        precedence: 2,
      },
    ];

    let rulesCreated = 0;
    let rulesSkipped = 0;
    for (const rd of rulesDef) {
      const exists = await ruleRepo.findOne({
        where: { tenantId: DEMO_TENANT_ID, name: rd.name },
      });
      if (exists) {
        rulesSkipped++;
        continue;
      }
      const rule = ruleRepo.create({
        tenantId: DEMO_TENANT_ID,
        name: rd.name,
        matchStrategy: rd.matchStrategy,
        precedence: rd.precedence,
        enabled: true,
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      await ruleRepo.save(rule);
      rulesCreated++;
    }
    console.log(`   Rules: ${rulesCreated} created, ${rulesSkipped} skipped`);

    console.log('3) Seeding demo import job...');
    let job = await jobRepo.findOne({
      where: {
        tenantId: DEMO_TENANT_ID,
        sourceId: source.id,
        status: ImportJobStatus.COMPLETED,
      },
    });
    if (!job) {
      job = jobRepo.create({
        tenantId: DEMO_TENANT_ID,
        sourceId: source.id,
        status: ImportJobStatus.COMPLETED,
        dryRun: true,
        totalRows: DEMO_IMPORT_ROWS.length,
        parsedCount: DEMO_IMPORT_ROWS.length,
        matchedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        conflictCount: 0,
        errorCount: 0,
        startedAt: new Date('2026-02-20T10:00:00Z'),
        finishedAt: new Date('2026-02-20T10:00:05Z'),
        createdBy: DEMO_ADMIN_ID,
        isDeleted: false,
      });
      job = await jobRepo.save(job);
      console.log('   Job created: ' + job.id);
    } else {
      console.log('   Job already exists, skipped');
    }

    console.log('4) Seeding import rows...');
    const existingRows = await rowRepo.count({ where: { jobId: job.id } });
    if (existingRows > 0) {
      console.log(`   Rows already exist (${existingRows}), skipped`);
    } else {
      let rowsCreated = 0;
      for (const r of DEMO_IMPORT_ROWS) {
        const row = rowRepo.create({
          tenantId: DEMO_TENANT_ID,
          jobId: job.id,
          rowNo: r.rowNo,
          raw: r.raw,
          parsed: r.parsed,
          status: r.status,
          errorMessage: r.errorMessage,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await rowRepo.save(row);
        rowsCreated++;
      }
      console.log(`   Rows: ${rowsCreated} created`);
    }

    console.log('5) Generating reconcile results...');
    const existingResults = await resultRepo.count({
      where: { jobId: job.id },
    });
    if (existingResults > 0) {
      console.log(`   Results already exist (${existingResults}), skipped`);
    } else {
      const allCis = await ciRepo.find({
        where: { tenantId: DEMO_TENANT_ID, isDeleted: false },
      });
      const ciByName: Record<string, CmdbCi> = {};
      for (const ci of allCis) {
        ciByName[ci.name.toLowerCase()] = ci;
      }

      let createCount = 0;
      let updateCount = 0;
      let conflictCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      const rows = await rowRepo.find({
        where: { jobId: job.id },
        order: { rowNo: 'ASC' },
      });
      for (const row of rows) {
        if (row.status === ImportRowStatus.ERROR) {
          errorCount++;
          continue;
        }

        const parsed = row.parsed || {};
        const hostname = (
          typeof parsed.hostname === 'string' ? parsed.hostname : ''
        ).toLowerCase();
        const matchedCi = hostname ? ciByName[hostname] : undefined;

        let action: ReconcileAction;
        let ciId: string | null = null;
        let matchedBy: string | null = null;
        let diff: ReconcileDiffField[] | null = null;

        if (!matchedCi) {
          action = ReconcileAction.CREATE;
          createCount++;
        } else {
          ciId = matchedCi.id;
          matchedBy = 'Hostname Exact Match';

          const ipOld = matchedCi.ipAddress || '';
          const ipNew =
            typeof parsed.ip_address === 'string' ? parsed.ip_address : '';
          if (ipNew && ipOld && ipNew !== ipOld) {
            action = ReconcileAction.CONFLICT;
            conflictCount++;
            diff = [
              {
                field: 'ipAddress',
                oldValue: ipOld,
                newValue: ipNew,
                classification: 'conflict',
              },
            ];
            if (
              typeof parsed.description === 'string' &&
              parsed.description !== matchedCi.description
            ) {
              diff.push({
                field: 'description',
                oldValue: matchedCi.description,
                newValue: parsed.description,
                classification: 'safe_update',
              });
            }
          } else {
            const descDiff =
              typeof parsed.description === 'string' &&
              parsed.description !== matchedCi.description;
            if (descDiff) {
              action = ReconcileAction.UPDATE;
              updateCount++;
              diff = [
                {
                  field: 'description',
                  oldValue: matchedCi.description,
                  newValue: parsed.description,
                  classification: 'safe_update',
                },
              ];
            } else {
              action = ReconcileAction.SKIP;
              skipCount++;
            }
          }
        }

        const result = resultRepo.create({
          tenantId: DEMO_TENANT_ID,
          jobId: job.id,
          rowId: row.id,
          ciId,
          action,
          matchedBy,
          diff,
          explain: matchedCi
            ? {
                ruleId: 'demo-rule',
                ruleName: 'Hostname Exact Match',
                fieldsUsed: ['hostname'],
                confidence: 1.0,
                matchedCiId: matchedCi.id,
                matchedCiName: matchedCi.name,
              }
            : null,
          createdBy: DEMO_ADMIN_ID,
          isDeleted: false,
        });
        await resultRepo.save(result);
      }

      await jobRepo.update(job.id, {
        createdCount: createCount,
        updatedCount: updateCount,
        conflictCount: conflictCount,
        matchedCount: updateCount + skipCount,
        errorCount: errorCount,
      });

      console.log(
        `   Results: create=${createCount}, update=${updateCount}, conflict=${conflictCount}, skip=${skipCount}, error=${errorCount}`,
      );
    }

    console.log('\n=== CMDB Import Demo Seed Complete ===');
    console.log('Summary:');
    console.log(`  - Import source: "${source.name}" (${source.id})`);
    console.log(
      `  - Import job: ${job.id} (status=${job.status}, dryRun=${job.dryRun})`,
    );
    console.log(`  - ${DEMO_IMPORT_ROWS.length} import rows seeded`);
    console.log('  - Reconcile results generated from baseline CIs');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seedCmdbImportDemo();
