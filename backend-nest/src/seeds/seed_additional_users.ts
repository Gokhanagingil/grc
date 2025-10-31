import 'reflect-metadata';
import { AppDataSource } from '../config/typeorm.config';
import * as bcrypt from 'bcryptjs';

async function upsertUser(
  tenantId: string,
  email: string,
  password: string,
  displayName: string | null,
  roleName: 'ADMIN' | 'USER',
) {
  const ds = AppDataSource;
  const rounds = Number(process.env.CRYPTO_SALT_ROUNDS || 12);
  const hash = await bcrypt.hash(password, rounds);

  // Ensure role exists for tenant
  const role = await ds.query(
    `SELECT id FROM auth.roles WHERE tenant_id=$1 AND name=$2 LIMIT 1`,
    [tenantId, roleName],
  );
  if (!role.length) {
    throw new Error(`Role ${roleName} not found for tenant ${tenantId}`);
  }
  const roleId: string = role[0].id;

  // Upsert user by (tenant_id, email)
  const existing = await ds.query(
    `SELECT id FROM auth.users WHERE tenant_id=$1 AND email=$2 LIMIT 1`,
    [tenantId, email],
  );

  let userId: string;
  if (existing.length) {
    userId = existing[0].id;
    await ds.query(
      `UPDATE auth.users SET password_hash=$1, display_name=$2, is_active=true, updated_at=now()
       WHERE id=$3`,
      [hash, displayName, userId],
    );
    // link role (idempotent)
    await ds.query(
      `INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId],
    );
    console.log(`Updated user: ${email} (${userId})`);
  } else {
    const inserted = await ds.query(
      `INSERT INTO auth.users (id, tenant_id, email, password_hash, display_name, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
       RETURNING id`,
      [tenantId, email, hash, displayName],
    );
    userId = inserted[0].id;
    await ds.query(
      `INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId],
    );
    console.log(`Created user: ${email} (${userId})`);
  }
}

async function run() {
  await AppDataSource.initialize();

  // Resolve tenant id (given or by slug 'default')
  const givenTenant = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
  let tenantId = givenTenant;
  try {
    const row = await AppDataSource.query(
      `SELECT id FROM tenant.tenants WHERE slug='default' LIMIT 1`,
    );
    if (row?.length) tenantId = row[0].id;
  } catch {}

  const users = [
    { email: 'grc1@local', username: 'grc1', password: 'grc1', role: 'ADMIN' as const },
    { email: 'grc2@local', username: 'grc2', password: 'grc2', role: 'USER' as const },
  ];

  for (const u of users) {
    await upsertUser(tenantId, u.email, u.password, u.username, u.role);
  }

  await AppDataSource.destroy();
}

run().catch((e) => {
  console.error('seed_additional_users failed:', e?.message || e);
  process.exit(1);
});


