import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';

config();

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 5432);
const database = process.env.DB_NAME || 'grc';
const username = process.env.DB_USER || 'grc_app';
const password = process.env.DB_PASS || 'please-change';
const rounds = Number(process.env.CRYPTO_SALT_ROUNDS || 12);
const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@local';
const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe!123';

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  // Ensure default tenant
  const tenant = await ds.query(
    `INSERT INTO tenant.tenants (name, slug, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (name) DO UPDATE SET updated_at=now()
     RETURNING id`,
    [process.env.APP_DEFAULT_TENANT_NAME || 'Default', 'default']
  );
  const tenantId: string = tenant[0].id;
  console.log('Tenant:', tenantId);

  // Permissions catalog
  const perms = ['policy.read','policy.create','policy.update','policy.delete','user.read','user.manage','role.manage','audit.read'];
  for (const code of perms) {
    await ds.query(`INSERT INTO auth.permissions (id, code) VALUES (gen_random_uuid(), $1) ON CONFLICT (code) DO NOTHING`, [code]);
  }

  // Roles
  const roleUpsert = async (name: string, isSystem: boolean) => {
    const r = await ds.query(
      `INSERT INTO auth.roles (id, tenant_id, name, is_system)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at=now()
       RETURNING id`,
      [tenantId, name, isSystem]
    );
    return r[0].id as string;
  };

  const superAdminId = await roleUpsert('SUPERADMIN', true);
  const adminId = await roleUpsert('ADMIN', false);
  const userId = await roleUpsert('USER', false);
  const auditorId = await roleUpsert('AUDITOR', false);

  // Map permissions to roles (SUPERADMIN gets all)
  const permRows = await ds.query(`SELECT id, code FROM auth.permissions`);
  const codeToId = new Map<string,string>(permRows.map((p: any) => [p.code, p.id]));
  const link = async (roleId: string, codes: string[]) => {
    for (const c of codes) {
      const pid = codeToId.get(c);
      if (pid) {
        await ds.query(
          `INSERT INTO auth.role_permissions (role_id, permission_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [roleId, pid]
        );
      }
    }
  };

  await link(superAdminId, perms);
  await link(adminId, ['policy.read','policy.create','policy.update','user.read','role.manage']);
  await link(userId, ['policy.read']);
  await link(auditorId, ['audit.read','policy.read']);

  // Admin user
  const passHash = await bcrypt.hash(adminPass, rounds);
  const userRow = await ds.query(
    `INSERT INTO auth.users (id, tenant_id, email, password_hash, is_active)
     VALUES (gen_random_uuid(), $1, $2, $3, true)
     ON CONFLICT (tenant_id, email) DO UPDATE SET updated_at=now()
     RETURNING id`,
    [tenantId, adminEmail, passHash]
  );
  const adminUserId: string = userRow[0].id;
  await ds.query(`INSERT INTO auth.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [adminUserId, superAdminId]);
  console.log('Admin user:', adminUserId, adminEmail);

  await ds.destroy();
}

run().catch((e) => {
  console.error('Seed failed', e);
  process.exit(1);
});


