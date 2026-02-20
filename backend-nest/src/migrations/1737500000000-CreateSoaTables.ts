import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create SOA (Statement of Applicability) Tables
 *
 * Creates the following tables:
 * - grc_soa_profiles: SOA profile metadata (name, standard, status, version)
 * - grc_soa_items: Individual SOA items linking profiles to clauses
 * - grc_soa_item_controls: M2M linking SOA items to controls
 * - grc_soa_item_evidence: M2M linking SOA items to evidence
 *
 * Also creates necessary enums and indexes for performance.
 */
export class CreateSoaTables1737500000000 implements MigrationInterface {
  name = 'CreateSoaTables1737500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "grc_soa_profiles_status_enum" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')
    `);

    await queryRunner.query(`
      CREATE TYPE "grc_soa_items_applicability_enum" AS ENUM ('APPLICABLE', 'NOT_APPLICABLE', 'UNDECIDED')
    `);

    await queryRunner.query(`
      CREATE TYPE "grc_soa_items_implementation_status_enum" AS ENUM ('IMPLEMENTED', 'PARTIALLY_IMPLEMENTED', 'PLANNED', 'NOT_IMPLEMENTED')
    `);

    // Create grc_soa_profiles table
    await queryRunner.query(`
      CREATE TABLE "grc_soa_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "standard_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "scope_text" text,
        "status" "grc_soa_profiles_status_enum" NOT NULL DEFAULT 'DRAFT',
        "version" integer NOT NULL DEFAULT 1,
        "published_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_soa_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_soa_profiles_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_grc_soa_profiles_standard" FOREIGN KEY ("standard_id") REFERENCES "standards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create indexes for grc_soa_profiles
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_tenant_id" ON "grc_soa_profiles" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_standard_id" ON "grc_soa_profiles" ("standard_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_tenant_standard" ON "grc_soa_profiles" ("tenant_id", "standard_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_tenant_status" ON "grc_soa_profiles" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_tenant_name" ON "grc_soa_profiles" ("tenant_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_created_at" ON "grc_soa_profiles" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_updated_at" ON "grc_soa_profiles" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_profiles_is_deleted" ON "grc_soa_profiles" ("is_deleted")`,
    );

    // Create grc_soa_items table
    await queryRunner.query(`
      CREATE TABLE "grc_soa_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "profile_id" uuid NOT NULL,
        "clause_id" uuid NOT NULL,
        "applicability" "grc_soa_items_applicability_enum" NOT NULL DEFAULT 'UNDECIDED',
        "justification" text,
        "implementation_status" "grc_soa_items_implementation_status_enum" NOT NULL DEFAULT 'NOT_IMPLEMENTED',
        "target_date" date,
        "owner_user_id" uuid,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_grc_soa_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_soa_items_tenant" FOREIGN KEY ("tenant_id") REFERENCES "nest_tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_grc_soa_items_profile" FOREIGN KEY ("profile_id") REFERENCES "grc_soa_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_grc_soa_items_clause" FOREIGN KEY ("clause_id") REFERENCES "standard_clauses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_grc_soa_items_owner" FOREIGN KEY ("owner_user_id") REFERENCES "nest_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create indexes for grc_soa_items
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_tenant_id" ON "grc_soa_items" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_profile_id" ON "grc_soa_items" ("profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_clause_id" ON "grc_soa_items" ("clause_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_grc_soa_items_tenant_profile_clause" ON "grc_soa_items" ("tenant_id", "profile_id", "clause_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_tenant_profile" ON "grc_soa_items" ("tenant_id", "profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_tenant_applicability" ON "grc_soa_items" ("tenant_id", "applicability")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_tenant_impl_status" ON "grc_soa_items" ("tenant_id", "implementation_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_created_at" ON "grc_soa_items" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_updated_at" ON "grc_soa_items" ("updated_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_items_is_deleted" ON "grc_soa_items" ("is_deleted")`,
    );

    // Create grc_soa_item_controls table (M2M)
    await queryRunner.query(`
      CREATE TABLE "grc_soa_item_controls" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "soa_item_id" uuid NOT NULL,
        "control_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_soa_item_controls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_soa_item_controls_soa_item" FOREIGN KEY ("soa_item_id") REFERENCES "grc_soa_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_grc_soa_item_controls_control" FOREIGN KEY ("control_id") REFERENCES "grc_controls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create indexes for grc_soa_item_controls
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_item_controls_tenant_id" ON "grc_soa_item_controls" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_grc_soa_item_controls_unique" ON "grc_soa_item_controls" ("tenant_id", "soa_item_id", "control_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_item_controls_soa_item" ON "grc_soa_item_controls" ("tenant_id", "soa_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_item_controls_control" ON "grc_soa_item_controls" ("tenant_id", "control_id")`,
    );

    // Create grc_soa_item_evidence table (M2M)
    await queryRunner.query(`
      CREATE TABLE "grc_soa_item_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "soa_item_id" uuid NOT NULL,
        "evidence_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_grc_soa_item_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grc_soa_item_evidence_soa_item" FOREIGN KEY ("soa_item_id") REFERENCES "grc_soa_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_grc_soa_item_evidence_evidence" FOREIGN KEY ("evidence_id") REFERENCES "grc_evidence"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // Create indexes for grc_soa_item_evidence
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_item_evidence_tenant_id" ON "grc_soa_item_evidence" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_grc_soa_item_evidence_unique" ON "grc_soa_item_evidence" ("tenant_id", "soa_item_id", "evidence_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_item_evidence_soa_item" ON "grc_soa_item_evidence" ("tenant_id", "soa_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_grc_soa_item_evidence_evidence" ON "grc_soa_item_evidence" ("tenant_id", "evidence_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting FK constraints)
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_soa_item_evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_soa_item_controls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_soa_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grc_soa_profiles"`);

    // Drop enums
    await queryRunner.query(
      `DROP TYPE IF EXISTS "grc_soa_items_implementation_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "grc_soa_items_applicability_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "grc_soa_profiles_status_enum"`,
    );
  }
}
