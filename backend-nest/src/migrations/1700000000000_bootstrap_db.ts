import { MigrationInterface, QueryRunner } from 'typeorm';

export class BootstrapDb1700000000000 implements MigrationInterface {
  name = 'BootstrapDb1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS auth;`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS tenant;`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS app;`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audit;`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS comms;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant.tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth.permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth.role_permissions (
        role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth.user_roles (
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth.login_attempts (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID,
        email TEXT,
        ip INET,
        success BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        revoked_at TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
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
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_policies_tenant ON app.policies(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON auth.users(tenant_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_roles_tenant ON auth.roles(tenant_id);`);

    await queryRunner.query(`
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
    `);

    // RLS policies (idempotent via DO blocks)
    await queryRunner.query(`ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth.roles ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE app.policies ENABLE ROW LEVEL SECURITY;`);

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

  public async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}


