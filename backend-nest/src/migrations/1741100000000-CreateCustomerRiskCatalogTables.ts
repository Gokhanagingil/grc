import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerRiskCatalogTables1741100000000 implements MigrationInterface {
  name = 'CreateCustomerRiskCatalogTables1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_risk_catalog" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "code" varchar(50),
        "title" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(50) NOT NULL,
        "signal_type" varchar(50) NOT NULL,
        "severity" varchar(20) NOT NULL,
        "likelihood_weight" int NOT NULL DEFAULT 50,
        "impact_weight" int NOT NULL DEFAULT 50,
        "score_contribution_model" varchar(30) NOT NULL DEFAULT 'FLAT_POINTS',
        "score_value" numeric(10,2) NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "owner_group" varchar(255),
        "owner" varchar(255),
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "tags" jsonb,
        "source" varchar(30) NOT NULL DEFAULT 'MANUAL',
        "source_ref" varchar(255),
        "rationale" text,
        "remediation_guidance" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_customer_risk_catalog" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_risk_catalog_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_risk_catalog_tenant_code"
        ON "customer_risk_catalog" ("tenant_id", "code")
        WHERE code IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_catalog_tenant_status"
        ON "customer_risk_catalog" ("tenant_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_catalog_tenant_category"
        ON "customer_risk_catalog" ("tenant_id", "category")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_catalog_tenant_severity"
        ON "customer_risk_catalog" ("tenant_id", "severity")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_catalog_tenant_signal_type"
        ON "customer_risk_catalog" ("tenant_id", "signal_type")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_risk_binding" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "catalog_risk_id" uuid NOT NULL,
        "target_type" varchar(30) NOT NULL,
        "target_id" varchar(255) NOT NULL,
        "scope_mode" varchar(20) NOT NULL DEFAULT 'DIRECT',
        "enabled" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_customer_risk_binding" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_risk_binding_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_risk_binding_catalog" FOREIGN KEY ("catalog_risk_id")
          REFERENCES "customer_risk_catalog"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_risk_binding_unique"
        ON "customer_risk_binding" ("tenant_id", "catalog_risk_id", "target_type", "target_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_binding_tenant_catalog"
        ON "customer_risk_binding" ("tenant_id", "catalog_risk_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_binding_tenant_target"
        ON "customer_risk_binding" ("tenant_id", "target_type", "target_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_binding_tenant_enabled"
        ON "customer_risk_binding" ("tenant_id", "enabled")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_risk_observation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "catalog_risk_id" uuid NOT NULL,
        "target_type" varchar(30) NOT NULL,
        "target_id" varchar(255) NOT NULL,
        "observed_at" timestamptz NOT NULL DEFAULT now(),
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "evidence_type" varchar(30) NOT NULL DEFAULT 'MANUAL',
        "evidence_ref" varchar(255),
        "raw_signal" jsonb,
        "calculated_score" numeric(10,2),
        "expires_at" timestamptz,
        "waived_by" uuid,
        "waived_at" timestamptz,
        "waiver_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_customer_risk_observation" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_risk_observation_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "nest_tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_risk_observation_catalog" FOREIGN KEY ("catalog_risk_id")
          REFERENCES "customer_risk_catalog"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_observation_tenant_catalog"
        ON "customer_risk_observation" ("tenant_id", "catalog_risk_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_observation_tenant_target"
        ON "customer_risk_observation" ("tenant_id", "target_type", "target_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_observation_tenant_status"
        ON "customer_risk_observation" ("tenant_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_risk_observation_tenant_observed"
        ON "customer_risk_observation" ("tenant_id", "observed_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_risk_observation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_risk_binding"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_risk_catalog"`);
  }
}
