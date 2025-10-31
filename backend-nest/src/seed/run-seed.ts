import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { RiskEntity } from '../modules/risk/risk.entity';
import { AuditEntity } from '../modules/audit/audit.entity';
import { IssueEntity } from '../modules/issue/issue.entity';
import * as uuid from 'uuid';

config();

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'grc',
    username: process.env.DB_USER || 'grc',
    password: process.env.DB_PASS || '123456',
    entities: [RiskEntity, AuditEntity, IssueEntity],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('✅ DataSource initialized');

  const riskRepo = ds.getRepository(RiskEntity);
  const auditRepo = ds.getRepository(AuditEntity);
  const issueRepo = ds.getRepository(IssueEntity);

  // Risks: 2 örnek
  const risk1 = riskRepo.create({
    id: uuid.v4(),
    title: 'Data Breach Risk',
    description: 'Potential unauthorized access to sensitive customer data',
    category: 'Security',
    severity: 'High',
    likelihood: 'Medium',
    impact: 'High',
    risk_score: 75,
    status: 'open',
    mitigation_plan: 'Implement encryption and access controls',
  });
  await riskRepo.save(risk1).catch(() => {});

  const risk2 = riskRepo.create({
    id: uuid.v4(),
    title: 'Compliance Violation',
    description: 'Risk of non-compliance with GDPR regulations',
    category: 'Compliance',
    severity: 'Medium',
    likelihood: 'Low',
    impact: 'Medium',
    risk_score: 40,
    status: 'open',
  });
  await riskRepo.save(risk2).catch(() => {});

  // Audit: 1 örnek
  const audit1 = auditRepo.create({
    id: uuid.v4(),
    name: 'Q4 2025 Security Audit',
    description: 'Annual security audit for Q4 2025',
    status: 'planned',
  });
  await auditRepo.save(audit1).catch(() => {});

  // Issue: 1 örnek
  const issue1 = issueRepo.create({
    id: uuid.v4(),
    name: 'Missing SSL Certificate',
    description: 'SSL certificate expired on production server',
    status: 'open',
  });
  await issueRepo.save(issue1).catch(() => {});

  console.log('✅ Seed completed');
  await ds.destroy();
}

run().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

