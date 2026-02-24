import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRiskAssessmentAndPolicyTables1740700000000 implements MigrationInterface {
  name = 'CreateRiskAssessmentAndPolicyTables1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itsm_risk_level_enum') THEN
          CREATE TYPE itsm_risk_level_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itsm_change_risk_assessment (
        id uuid DEFAULT uuid_generate_v4() NOT NULL,
        tenant_id uuid NOT NULL,
        change_id uuid NOT NULL,
        risk_score integer NOT NULL DEFAULT 0,
        risk_level itsm_risk_level_enum NOT NULL DEFAULT 'LOW',
        computed_at timestamptz NOT NULL DEFAULT NOW(),
        breakdown jsonb NOT NULL DEFAULT '[]',
        impacted_ci_count integer NOT NULL DEFAULT 0,
        impacted_service_count integer NOT NULL DEFAULT 0,
        has_freeze_conflict boolean NOT NULL DEFAULT false,
        has_sla_risk boolean NOT NULL DEFAULT false,
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        is_deleted boolean NOT NULL DEFAULT false,
        CONSTRAINT pk_itsm_change_risk_assessment PRIMARY KEY (id),
        CONSTRAINT fk_itsm_risk_assessment_tenant FOREIGN KEY (tenant_id) REFERENCES nest_tenants(id),
        CONSTRAINT fk_itsm_risk_assessment_change FOREIGN KEY (change_id) REFERENCES itsm_changes(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_assessment_tenant_change
        ON itsm_change_risk_assessment (tenant_id, change_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_assessment_tenant_risk_level
        ON itsm_change_risk_assessment (tenant_id, risk_level);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_assessment_tenant_risk_score
        ON itsm_change_risk_assessment (tenant_id, risk_score);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS itsm_change_policy (
        id uuid DEFAULT uuid_generate_v4() NOT NULL,
        tenant_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        priority integer NOT NULL DEFAULT 0,
        conditions jsonb NOT NULL DEFAULT '{}',
        actions jsonb NOT NULL DEFAULT '{}',
        created_by uuid,
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        is_deleted boolean NOT NULL DEFAULT false,
        CONSTRAINT pk_itsm_change_policy PRIMARY KEY (id),
        CONSTRAINT fk_itsm_change_policy_tenant FOREIGN KEY (tenant_id) REFERENCES nest_tenants(id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_change_policy_tenant_active
        ON itsm_change_policy (tenant_id, is_active);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_change_policy_tenant_priority
        ON itsm_change_policy (tenant_id, priority);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS itsm_change_policy;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS itsm_change_risk_assessment;`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS itsm_risk_level_enum;`);
  }
}
