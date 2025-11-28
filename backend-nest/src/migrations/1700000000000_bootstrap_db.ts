import { MigrationInterface, QueryRunner } from 'typeorm';

export class BootstrapDb1700000000000 implements MigrationInterface {
  name = 'BootstrapDb1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;

    // PostgreSQL-specific extensions (skip for SQLite)
    if (driver === 'postgres') {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext;`);
    }

    // PostgreSQL schemas (SQLite doesn't support schemas, we use table name prefixes)
    if (driver === 'postgres') {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS auth;`);
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS tenant;`);
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS app;`);
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit;`);
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS comms;`);
    }

    // Table: tenants
    const tenantTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS tenant.tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(tenantTableSql);

    // Table: users
    const usersTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant.tenants(id) ON DELETE CASCADE,
        email CITEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        is_email_verified BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        twofa_secret TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, email)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        is_email_verified INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        twofa_secret TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, email)
      );
    `;
    await queryRunner.query(usersTableSql);

    // Table: roles
    const rolesTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant.tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_system BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, name)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, name)
      );
    `;
    await queryRunner.query(rolesTableSql);

    // Table: permissions
    const permissionsTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(permissionsTableSql);

    // Table: role_permissions
    const rolePermissionsTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.role_permissions (
        role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `;
    await queryRunner.query(rolePermissionsTableSql);

    // Table: user_roles
    const userRolesTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.user_roles (
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
    `;
    await queryRunner.query(userRolesTableSql);

    // Table: login_attempts
    const loginAttemptsTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.login_attempts (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID,
        email TEXT,
        ip INET,
        success BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        email TEXT,
        ip TEXT,
        success INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(loginAttemptsTableSql);

    // Table: refresh_tokens
    const refreshTokensTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        revoked_at TIMESTAMPTZ
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT
      );
    `;
    await queryRunner.query(refreshTokensTableSql);

    // Table: policies
    const policiesTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant.tenants(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','review','approved','retired')),
        owner_first_name TEXT,
        owner_last_name TEXT,
        effective_date DATE,
        review_date DATE,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, code)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','review','approved','retired')),
        owner_first_name TEXT,
        owner_last_name TEXT,
        effective_date TEXT,
        review_date TEXT,
        created_by TEXT,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, code)
      );
    `;
    await queryRunner.query(policiesTableSql);

    // Indexes
    if (driver === 'postgres') {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_policies_tenant ON app.policies(tenant_id);`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_users_tenant ON auth.users(tenant_id);`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_roles_tenant ON auth.roles(tenant_id);`,
      );
    } else {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_policies_tenant ON policies(tenant_id);`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);`,
      );
    }

    // Table: audit_logs
    const auditLogsTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS audit.audit_logs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID,
        user_id UUID,
        entity_schema TEXT NOT NULL,
        entity_table TEXT NOT NULL,
        entity_id UUID,
        action TEXT NOT NULL,
        diff JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT,
        user_id TEXT,
        entity_schema TEXT NOT NULL,
        entity_table TEXT NOT NULL,
        entity_id TEXT,
        action TEXT NOT NULL,
        diff TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(auditLogsTableSql);

    // RLS policies (PostgreSQL only - SQLite doesn't support RLS)
    if (driver === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;`,
      );
      await queryRunner.query(
        `ALTER TABLE auth.roles ENABLE ROW LEVEL SECURITY;`,
      );
      await queryRunner.query(
        `ALTER TABLE app.policies ENABLE ROW LEVEL SECURITY;`,
      );

      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='auth' AND tablename='users' AND policyname='users_tenant_isolation') THEN
          CREATE POLICY users_tenant_isolation ON auth.users USING (tenant_id::text = current_setting('app.tenant_id', true));
        END IF; END $$;`);

      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='auth' AND tablename='roles' AND policyname='roles_tenant_isolation') THEN
          CREATE POLICY roles_tenant_isolation ON auth.roles USING (tenant_id::text = current_setting('app.tenant_id', true));
        END IF; END $$;`);

      await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='policies' AND policyname='policies_tenant_isolation') THEN
          CREATE POLICY policies_tenant_isolation ON app.policies USING (tenant_id::text = current_setting('app.tenant_id', true));
        END IF; END $$;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    
    if (driver === 'postgres') {
      await queryRunner.query(`DROP TABLE IF EXISTS audit.audit_logs`);
      await queryRunner.query(`DROP TABLE IF EXISTS app.policies`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.refresh_tokens`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.login_attempts`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.user_roles`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.role_permissions`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.permissions`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.roles`);
      await queryRunner.query(`DROP TABLE IF EXISTS auth.users`);
      await queryRunner.query(`DROP TABLE IF EXISTS tenant.tenants`);
    } else {
      await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
      await queryRunner.query(`DROP TABLE IF EXISTS policies`);
      await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
      await queryRunner.query(`DROP TABLE IF EXISTS login_attempts`);
      await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);
      await queryRunner.query(`DROP TABLE IF EXISTS role_permissions`);
      await queryRunner.query(`DROP TABLE IF EXISTS permissions`);
      await queryRunner.query(`DROP TABLE IF EXISTS roles`);
      await queryRunner.query(`DROP TABLE IF EXISTS users`);
      await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
    }
  }
}
