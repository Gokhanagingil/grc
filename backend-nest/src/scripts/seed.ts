import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Policy } from '../modules/policy/policy.entity';
import { PolicyStatus } from '../modules/policy/policy-status.enum';
import { GovPolicy } from '../modules/governance/gov.entity';
import { RiskEntity } from '../modules/risk/risk.entity';
import { RequirementEntity } from '../modules/compliance/comp.entity';

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'gokhan',
    username: process.env.DB_USER || 'grc',
    password: process.env.DB_PASS || '123456',
    entities: [Policy, GovPolicy, RiskEntity, RequirementEntity],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  const repo = ds.getRepository(Policy);

  const samples: Array<Partial<Policy>> = [
    {
      name: 'Information Security Policy',
      code: 'ISP-001',
      status: PolicyStatus.DRAFT,
      owner: 'GRC',
      version: '1.0.0',
      tags: ['iso27001', 'infosec'],
    },
    {
      name: 'Business Continuity Policy',
      code: 'BCP-001',
      status: PolicyStatus.IN_REVIEW,
      owner: 'Operations',
      version: '1.2.0',
      tags: ['bcp', 'drp'],
    },
    {
      name: 'Acceptable Use Policy',
      code: 'AUP-001',
      status: PolicyStatus.APPROVED,
      owner: 'IT',
      version: '2.0.0',
      tags: ['security', 'end-user'],
    },
  ];

  for (const sample of samples) {
    const exists = await repo.findOne({ where: { code: sample.code as string } });
    if (!exists) {
      const entity = repo.create(sample);
      const saved = await repo.save(entity);
      console.log('Seeded policy:', saved.id, saved.code);
    } else {
      console.log('Skip existing policy:', exists.id, exists.code);
    }
  }

  // GovPolicy seeds (by title)
  const govRepo = ds.getRepository(GovPolicy);
  const govSamples = [
    { title: 'Data Classification Policy', status: 'active', version: '1.0' },
    { title: 'Access Control Policy', status: 'draft', version: '0.9' },
  ];
  for (const g of govSamples) {
    const ex = await govRepo.findOne({ where: { title: g.title } });
    if (!ex) {
      const saved = await govRepo.save(govRepo.create(g));
      console.log('Seeded gov policy:', saved.id, saved.title);
    }
  }

  // Risk seeds (by title)
  const riskRepo = ds.getRepository(RiskEntity);
  const riskSamples = [
    { title: 'Ransomware Attack', severity: 'High', status: 'open' },
    { title: 'DB Performance Degradation', severity: 'Medium', status: 'in_progress' },
  ];
  for (const r of riskSamples) {
    const ex = await riskRepo.findOne({ where: { title: r.title } });
    if (!ex) {
      const saved = await riskRepo.save(riskRepo.create(r as Partial<RiskEntity>));
      console.log('Seeded risk:', (saved as any).id, (saved as any).title);
    }
  }

  // Requirement seeds (by title)
  const reqRepo = ds.getRepository(RequirementEntity);
  const reqSamples = [
    { title: 'ISO 27001 A.12.4 Logging and Monitoring', regulation: 'ISO27001', status: 'pending' },
    { title: 'GDPR Article 32 Security of Processing', regulation: 'GDPR', status: 'in_progress' },
  ];
  for (const rq of reqSamples) {
    const ex = await reqRepo.findOne({ where: { title: rq.title } });
    if (!ex) {
      const saved = await reqRepo.save(reqRepo.create(rq as Partial<RequirementEntity>));
      console.log('Seeded requirement:', (saved as any).id, (saved as any).title);
    }
  }

  await ds.destroy();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});


