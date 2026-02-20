import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateOnboardingTables
 *
 * Creates the 6 onboarding tables for Suite-first Platform Onboarding Core v1:
 * - tenant_initialization_profile
 * - tenant_active_suite
 * - tenant_enabled_module
 * - tenant_active_framework
 * - tenant_maturity_profile
 * - onboarding_decision
 *
 * This migration is additive only - no existing tables or data are altered.
 */
export class CreateOnboardingTables1734112800000 implements MigrationInterface {
  name = 'CreateOnboardingTables1734112800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for PostgreSQL
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "suite_type_enum" AS ENUM ('GRC_SUITE', 'ITSM_SUITE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "module_type_enum" AS ENUM ('risk', 'policy', 'control', 'audit', 'incident', 'request', 'change', 'problem', 'cmdb');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "framework_type_enum" AS ENUM ('ISO27001', 'SOC2', 'GDPR', 'HIPAA', 'NIST', 'PCI_DSS');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "maturity_level_enum" AS ENUM ('foundational', 'intermediate', 'advanced');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "decision_type_enum" AS ENUM ('suite_activation', 'module_enable', 'module_disable', 'framework_activation', 'framework_deactivation', 'maturity_change', 'policy_override');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create tenant_initialization_profile table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_initialization_profile" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "schema_version" integer NOT NULL DEFAULT 1,
        "policy_set_version" varchar(50),
        "initialized_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_tenant_initialization_profile" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_initialization_profile_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on tenant_id for tenant_initialization_profile
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_init_profile_tenant_unique" 
      ON "tenant_initialization_profile" ("tenant_id") 
      WHERE "is_deleted" = false
    `);

    // Create standard indexes for tenant_initialization_profile
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_init_profile_tenant_id" ON "tenant_initialization_profile" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_init_profile_created_at" ON "tenant_initialization_profile" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_init_profile_updated_at" ON "tenant_initialization_profile" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_init_profile_is_deleted" ON "tenant_initialization_profile" ("is_deleted")`,
    );

    // Create tenant_active_suite table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_active_suite" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "suite_type" "suite_type_enum" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "activated_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_tenant_active_suite" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_active_suite_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, suite_type) for tenant_active_suite
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_active_suite_tenant_suite_unique" 
      ON "tenant_active_suite" ("tenant_id", "suite_type") 
      WHERE "is_deleted" = false
    `);

    // Create standard indexes for tenant_active_suite
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_suite_tenant_id" ON "tenant_active_suite" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_suite_created_at" ON "tenant_active_suite" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_suite_updated_at" ON "tenant_active_suite" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_suite_is_deleted" ON "tenant_active_suite" ("is_deleted")`,
    );

    // Create tenant_enabled_module table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_enabled_module" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "suite_type" "suite_type_enum" NOT NULL,
        "module_type" "module_type_enum" NOT NULL,
        "is_enabled" boolean NOT NULL DEFAULT true,
        "enabled_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_tenant_enabled_module" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_enabled_module_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, module_type) for tenant_enabled_module
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_enabled_module_tenant_module_unique" 
      ON "tenant_enabled_module" ("tenant_id", "module_type") 
      WHERE "is_deleted" = false
    `);

    // Create composite index on (tenant_id, suite_type, module_type) for tenant_enabled_module
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_enabled_module_tenant_suite_module" 
      ON "tenant_enabled_module" ("tenant_id", "suite_type", "module_type")
    `);

    // Create standard indexes for tenant_enabled_module
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_enabled_module_tenant_id" ON "tenant_enabled_module" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_enabled_module_created_at" ON "tenant_enabled_module" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_enabled_module_updated_at" ON "tenant_enabled_module" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_enabled_module_is_deleted" ON "tenant_enabled_module" ("is_deleted")`,
    );

    // Create tenant_active_framework table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_active_framework" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "framework_type" "framework_type_enum" NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "activated_at" timestamp,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_tenant_active_framework" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_active_framework_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on (tenant_id, framework_type) for tenant_active_framework
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_active_framework_tenant_framework_unique" 
      ON "tenant_active_framework" ("tenant_id", "framework_type") 
      WHERE "is_deleted" = false
    `);

    // Create standard indexes for tenant_active_framework
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_framework_tenant_id" ON "tenant_active_framework" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_framework_created_at" ON "tenant_active_framework" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_framework_updated_at" ON "tenant_active_framework" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_active_framework_is_deleted" ON "tenant_active_framework" ("is_deleted")`,
    );

    // Create tenant_maturity_profile table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_maturity_profile" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "maturity_level" "maturity_level_enum" NOT NULL DEFAULT 'foundational',
        "assessed_at" timestamp,
        "assessed_by" uuid,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_tenant_maturity_profile" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_maturity_profile_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create unique index on tenant_id for tenant_maturity_profile
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_maturity_profile_tenant_unique" 
      ON "tenant_maturity_profile" ("tenant_id") 
      WHERE "is_deleted" = false
    `);

    // Create standard indexes for tenant_maturity_profile
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_maturity_profile_tenant_id" ON "tenant_maturity_profile" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_maturity_profile_created_at" ON "tenant_maturity_profile" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_maturity_profile_updated_at" ON "tenant_maturity_profile" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_maturity_profile_is_deleted" ON "tenant_maturity_profile" ("is_deleted")`,
    );

    // Create onboarding_decision table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "onboarding_decision" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "decision_type" "decision_type_enum" NOT NULL,
        "decision_key" varchar(100) NOT NULL,
        "decision_value" jsonb NOT NULL,
        "previous_value" jsonb,
        "reason" text,
        "decided_by" uuid NOT NULL,
        "decided_at" timestamp NOT NULL DEFAULT now(),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_onboarding_decision" PRIMARY KEY ("id"),
        CONSTRAINT "FK_onboarding_decision_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for onboarding_decision
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_onboarding_decision_tenant_created" ON "onboarding_decision" ("tenant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_onboarding_decision_tenant_type" ON "onboarding_decision" ("tenant_id", "decision_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_onboarding_decision_tenant_id" ON "onboarding_decision" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_onboarding_decision_created_at" ON "onboarding_decision" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_onboarding_decision_updated_at" ON "onboarding_decision" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_onboarding_decision_is_deleted" ON "onboarding_decision" ("is_deleted")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key dependencies)
    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_decision"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_maturity_profile"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_active_framework"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_enabled_module"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_active_suite"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tenant_initialization_profile"`,
    );

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "decision_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "maturity_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "framework_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "module_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "suite_type_enum"`);
  }
}
