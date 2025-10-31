import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { TenantEntity } from '../entities/tenant/tenant.entity';
import { RoleEntity } from '../entities/auth/role.entity';
import { UserEntity } from '../entities/auth/user.entity';

config();

async function run() {
  const email = process.env.TEST_USER_EMAIL || 'test1@local';
  const password = process.env.TEST_USER_PASSWORD || 'test1';
  const display = process.env.TEST_USER_NAME || 'Test User';
  const defaultTenantId = process.env.APP_DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
  const saltRounds = Number(process.env.CRYPTO_SALT_ROUNDS || 12);

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'grc',
    username: process.env.DB_USER || 'grc_app',
    password: process.env.DB_PASS || 'please-change',
    schema: process.env.DB_SCHEMA || 'public',
    synchronize: false,
    logging: false,
    entities: [TenantEntity, RoleEntity, UserEntity],
  });
  await ds.initialize();

  const tenantRepo = ds.getRepository(TenantEntity);
  const roleRepo = ds.getRepository(RoleEntity);
  const userRepo = ds.getRepository(UserEntity);

  const tenant = await tenantRepo.findOne({ where: { id: defaultTenantId }, select: { id: true } as any });
  if (!tenant) throw new Error(`Default tenant not found: ${defaultTenantId}`);

  const roleRow = await ds.getRepository(RoleEntity).createQueryBuilder('r')
    .select(['r.id'])
    .where('r.tenant_id = :tid AND r.name = :name', { tid: tenant.id, name: 'USER' })
    .getRawOne<{ r_id: string }>();
  const roleId = (roleRow as any)?.r_id || (roleRow as any)?.id;
  if (!roleId) throw new Error('Role USER not found; run main seed first');

  const hash = await bcrypt.hash(password, saltRounds);

  const upsertUser = await ds.query(
    `INSERT INTO auth.users (tenant_id, email, password_hash, display_name, is_email_verified, is_active)
     VALUES ($1,$2,$3,$4,true,true)
     ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name, is_active = true
     RETURNING id`,
    [tenant.id, email, hash, display]
  );
  const userId = upsertUser?.[0]?.id as string;

  if (userId && roleId) {
    await ds.query(
      `INSERT INTO auth.user_roles (user_id, role_id)
       VALUES ($1,$2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId]
    );
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded test user: ${email} (${userId})`);

  await ds.destroy();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed_test_user failed', err);
  process.exit(1);
});


