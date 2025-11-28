import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { RiskEntity } from '../modules/risk/risk.entity';
import { AuditEntity } from '../modules/audit/audit.entity';
import { IssueEntity } from '../modules/issue/issue.entity';
import { UserEntity } from '../entities/auth/user.entity';
import { TenantEntity } from '../entities/tenant/tenant.entity';
import * as uuid from 'uuid';
import * as bcrypt from 'bcrypt';

config();

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'grc',
    username: process.env.DB_USER || 'grc',
    password: process.env.DB_PASS || '123456',
    entities: [RiskEntity, AuditEntity, IssueEntity, UserEntity, TenantEntity],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('✅ DataSource initialized');

  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const riskRepo = ds.getRepository(RiskEntity);
  const auditRepo = ds.getRepository(AuditEntity);
  const issueRepo = ds.getRepository(IssueEntity);

  // Ensure default tenant exists
  let tenant = await tenantRepo.findOne({ where: { slug: 'default' } });
  if (!tenant) {
    tenant = tenantRepo.create({
      id:
        process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
      name: 'Default Tenant',
      slug: 'default',
      is_active: true,
    });
    tenant = await tenantRepo.save(tenant);
    console.log('✅ Created default tenant');
  }

  // Seed auth users with bcrypt
  const adminEmail = 'admin@local';
  const adminPass = await bcrypt.hash('Admin!123', 10);
  let admin = await userRepo.findOne({
    where: { email: adminEmail, tenant_id: tenant.id },
  });
  if (admin) {
    admin.password_hash = adminPass;
    admin.display_name = 'Admin User';
    admin.is_active = true;
    await userRepo.save(admin);
    console.log('✅ Updated admin user:', adminEmail);
  } else {
    admin = userRepo.create({
      id: uuid.v4(),
      tenant_id: tenant.id,
      email: adminEmail,
      password_hash: adminPass,
      display_name: 'Admin User',
      is_active: true,
      is_email_verified: true,
    });
    admin = await userRepo.save(admin);
    console.log('✅ Created admin user:', adminEmail);
  }

  const userEmail = 'user@local';
  const userPass = await bcrypt.hash('User!123', 10);
  let user = await userRepo.findOne({
    where: { email: userEmail, tenant_id: tenant.id },
  });
  if (user) {
    user.password_hash = userPass;
    user.display_name = 'Regular User';
    user.is_active = true;
    await userRepo.save(user);
    console.log('✅ Updated regular user:', userEmail);
  } else {
    user = userRepo.create({
      id: uuid.v4(),
      tenant_id: tenant.id,
      email: userEmail,
      password_hash: userPass,
      display_name: 'Regular User',
      is_active: true,
      is_email_verified: true,
    });
    user = await userRepo.save(user);
    console.log('✅ Created regular user:', userEmail);
  }

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
