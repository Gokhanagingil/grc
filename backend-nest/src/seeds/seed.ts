import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';

config();

const databaseUrl = process.env.DATABASE_URL;
const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 5432);
const database = process.env.DB_NAME || 'grc';
const username = process.env.DB_USER || 'grc_app';
const password = process.env.DB_PASS || 'please-change';
const schema = process.env.DB_SCHEMA || 'public';

const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || process.env.CRYPTO_SALT_ROUNDS || 12);
const defaultTenantId = process.env.DEFAULT_TENANT_ID;
const tenantName = process.env.APP_DEFAULT_TENANT_NAME || 'Default Tenant';
const tenantSlug = process.env.APP_DEFAULT_TENANT_SLUG || 'default';

const usersToSeed = [
  {
    email: 'grc1@local',
    password: process.env.SEED_USER1_PASSWORD || 'grc1',
    displayName: 'GRC One',
  },
  {
    email: 'grc2@local',
    password: process.env.SEED_USER2_PASSWORD || 'grc2',
    displayName: 'GRC Two',
  },
];

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    schema,
    url: databaseUrl,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  let tenantId = defaultTenantId;
  if (tenantId) {
    const result = await ds.query(
      `INSERT INTO tenant.tenants (id, name, slug, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, is_active = true, updated_at = now()
       RETURNING id`,
      [tenantId, tenantName, tenantSlug],
    );
    tenantId = result[0]?.id;
  } else {
    const result = await ds.query(
      `INSERT INTO tenant.tenants (name, slug, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_active = true, updated_at = now()
       RETURNING id`,
      [tenantName, tenantSlug],
    );
    tenantId = result[0]?.id;
  }

  if (!tenantId) {
    throw new Error('Failed to determine tenant id during seed.');
  }

  console.log('Tenant ready:', tenantId);

  for (const user of usersToSeed) {
    const hash = await bcrypt.hash(user.password, rounds);
    await ds.query(
      `INSERT INTO auth.users (id, tenant_id, email, password_hash, display_name, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name, is_active = true, updated_at = now()`,
      [tenantId, user.email, hash, user.displayName],
    );
    console.log(`Seeded user ${user.email}`);
  }

  await ds.destroy();
}

run().catch((e) => {
  console.error('Seed failed', e);
  process.exit(1);
});
