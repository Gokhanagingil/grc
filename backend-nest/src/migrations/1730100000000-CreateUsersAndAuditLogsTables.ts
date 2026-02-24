import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateUsersAndAuditLogsTables
 *
 * Creates the nest_users and nest_audit_logs tables that are required
 * by the User and AuditLog entities. These tables are fundamental to
 * the NestJS backend and must exist before other migrations that may
 * reference them.
 *
 * This migration runs after CreateTenantsTable (1730000000000) to ensure
 * the tenants table exists for the foreign key relationship.
 */
export class CreateUsersAndAuditLogsTables1730100000000 implements MigrationInterface {
  name = 'CreateUsersAndAuditLogsTables1730100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create UserRole enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('admin', 'manager', 'user');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create nest_users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'user',
        "first_name" varchar(255),
        "last_name" varchar(255),
        "department" varchar(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "tenant_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_users" PRIMARY KEY ("id"),
        CONSTRAINT "FK_nest_users_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL
      )
    `);

    // Create unique index on email
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_nest_users_email_unique" 
      ON "nest_users" ("email")
    `);

    // Create index on tenant_id for efficient tenant-based queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_users_tenant_id" 
      ON "nest_users" ("tenant_id")
    `);

    // Create index on is_active for filtering active users
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_users_is_active" 
      ON "nest_users" ("is_active")
    `);

    // Create nest_audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nest_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "user_id" uuid,
        "action" varchar(255) NOT NULL,
        "resource" varchar(100) NOT NULL,
        "resource_id" varchar(255),
        "entity_name" varchar(100),
        "entity_id" uuid,
        "before_state" jsonb,
        "after_state" jsonb,
        "status_code" integer,
        "metadata" jsonb,
        "ip_address" varchar(45),
        "correlation_id" uuid,
        "latency_ms" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nest_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for nest_audit_logs as defined in the entity
    // Index on (tenant_id, created_at)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_tenant_created" 
      ON "nest_audit_logs" ("tenant_id", "created_at")
    `);

    // Index on (user_id, created_at)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_user_created" 
      ON "nest_audit_logs" ("user_id", "created_at")
    `);

    // Index on (action, created_at)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_action_created" 
      ON "nest_audit_logs" ("action", "created_at")
    `);

    // Index on (entity_name, entity_id)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_entity" 
      ON "nest_audit_logs" ("entity_name", "entity_id")
    `);

    // Additional single-column indexes as defined in entity
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_tenant_id" 
      ON "nest_audit_logs" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_user_id" 
      ON "nest_audit_logs" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_entity_name" 
      ON "nest_audit_logs" ("entity_name")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_entity_id" 
      ON "nest_audit_logs" ("entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_audit_logs_correlation_id" 
      ON "nest_audit_logs" ("correlation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for nest_audit_logs
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_correlation_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_entity_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_entity_name"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_tenant_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_entity"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_action_created"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_user_created"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_audit_logs_tenant_created"
    `);

    // Drop nest_audit_logs table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "nest_audit_logs"
    `);

    // Drop indexes for nest_users
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_users_is_active"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_users_tenant_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_users_email_unique"
    `);

    // Drop nest_users table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "nest_users"
    `);

    // Drop UserRole enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "user_role_enum"
    `);
  }
}
