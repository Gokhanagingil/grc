import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { UserEntity } from '../entities/auth/user.entity';
import { TenantEntity } from '../entities/tenant/tenant.entity';
import * as bcrypt from 'bcryptjs';
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
    entities: [UserEntity, TenantEntity],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log('✅ DataSource initialized');

  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);

  // Get or create default tenant
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
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

  // Admin user
  const adminEmail = 'admin@local';
  const adminPassword = 'Admin!123';
  let admin = await userRepo.findOne({
    where: { email: adminEmail, tenant_id: tenant.id },
  });
  if (admin) {
    const hash = await bcrypt.hash(adminPassword, saltRounds);
    admin.password_hash = hash;
    admin.display_name = 'Admin User';
    admin.is_active = true;
    await userRepo.save(admin);
    console.log(`✅ Updated admin user: ${adminEmail}`);
  } else {
    const hash = await bcrypt.hash(adminPassword, saltRounds);
    admin = userRepo.create({
      id: uuid.v4(),
      tenant_id: tenant.id,
      email: adminEmail,
      password_hash: hash,
      display_name: 'Admin User',
      is_active: true,
      is_email_verified: true,
    });
    admin = await userRepo.save(admin);
    console.log(
      `✅ Created admin user: ${adminEmail} (${admin.id.substring(0, 8)}...)`,
    );
  }

  // Regular user
  const userEmail = 'user@local';
  const userPassword = 'User!123';
  let user = await userRepo.findOne({
    where: { email: userEmail, tenant_id: tenant.id },
  });
  if (user) {
    const hash = await bcrypt.hash(userPassword, saltRounds);
    user.password_hash = hash;
    user.display_name = 'Regular User';
    user.is_active = true;
    await userRepo.save(user);
    console.log(`✅ Updated regular user: ${userEmail}`);
  } else {
    const hash = await bcrypt.hash(userPassword, saltRounds);
    user = userRepo.create({
      id: uuid.v4(),
      tenant_id: tenant.id,
      email: userEmail,
      password_hash: hash,
      display_name: 'Regular User',
      is_active: true,
      is_email_verified: true,
    });
    user = await userRepo.save(user);
    console.log(
      `✅ Created regular user: ${userEmail} (${user.id.substring(0, 8)}...)`,
    );
  }

  console.log('✅ Auth seed completed');
  await ds.destroy();
}

run().catch((err) => {
  console.error('❌ Auth seed failed:', err);
  process.exit(1);
});
