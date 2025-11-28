import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLifecycle1733000000000 implements MigrationInterface {
  name = 'CreateAuditLifecycle1733000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    const uuidType = isPostgres ? 'UUID' : 'TEXT';
    const dateType = isPostgres ? 'DATE' : 'TEXT';
    const timestampType = isPostgres ? 'TIMESTAMP' : 'TEXT';
    const timestampDefault = isPostgres ? 'NOW()' : "CURRENT_TIMESTAMP";

    // Audit Plans
    const auditPlansTableSql = `
      CREATE TABLE IF NOT EXISTS audit_plans (
        id ${uuidType} PRIMARY KEY,
        tenant_id ${uuidType} NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        period_start ${dateType} NOT NULL,
        period_end ${dateType} NOT NULL,
        scope TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'planned',
        created_by ${uuidType},
        updated_by ${uuidType},
        created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        archived_at ${timestampType}
      );
    `;
    await queryRunner.query(auditPlansTableSql);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_plans_tenant ON audit_plans(tenant_id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_plans_code_tenant ON audit_plans(code, tenant_id);
    `);

    // Audit Engagements
    const auditEngagementsTableSql = `
      CREATE TABLE IF NOT EXISTS audit_engagements (
        id ${uuidType} PRIMARY KEY,
        tenant_id ${uuidType} NOT NULL,
        plan_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES audit_plans(id) ON DELETE CASCADE' : ''},
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        auditee TEXT,
        lead_auditor_id ${uuidType},
        status VARCHAR(50) NOT NULL DEFAULT 'planned',
        created_by ${uuidType},
        updated_by ${uuidType},
        created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
      );
    `;
    await queryRunner.query(auditEngagementsTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_engagements_plan_fk ON audit_engagements(plan_id);
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_engagements_tenant ON audit_engagements(tenant_id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_engagements_code_tenant ON audit_engagements(code, tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_engagements_plan ON audit_engagements(plan_id);
    `);

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE audit_engagements 
        DROP CONSTRAINT IF EXISTS fk_audit_engagements_plan CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_engagements 
        ADD CONSTRAINT fk_audit_engagements_plan 
        FOREIGN KEY(plan_id) REFERENCES audit_plans(id) ON DELETE CASCADE;
      `);
    }

    // Audit Tests
    const auditTestsTableSql = `
      CREATE TABLE IF NOT EXISTS audit_tests (
        id ${uuidType} PRIMARY KEY,
        tenant_id ${uuidType} NOT NULL,
        engagement_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES audit_engagements(id) ON DELETE CASCADE' : ''},
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        objective TEXT,
        population_ref TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'planned',
        created_by ${uuidType},
        updated_by ${uuidType},
        created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
      );
    `;
    await queryRunner.query(auditTestsTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_tests_engagement_fk ON audit_tests(engagement_id);
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_tests_tenant ON audit_tests(tenant_id);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_tests_code_tenant ON audit_tests(code, tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_tests_engagement ON audit_tests(engagement_id);
    `);

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE audit_tests 
        DROP CONSTRAINT IF EXISTS fk_audit_tests_engagement CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_tests 
        ADD CONSTRAINT fk_audit_tests_engagement 
        FOREIGN KEY(engagement_id) REFERENCES audit_engagements(id) ON DELETE CASCADE;
      `);
    }

    // Audit Evidences
    const auditEvidencesTableSql = `
      CREATE TABLE IF NOT EXISTS audit_evidences (
        id ${uuidType} PRIMARY KEY,
        tenant_id ${uuidType} NOT NULL,
        test_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES audit_tests(id) ON DELETE CASCADE' : ''},
        type VARCHAR(50) NOT NULL DEFAULT 'note',
        uri_or_text TEXT NOT NULL,
        collected_at ${timestampType} NOT NULL,
        collected_by ${uuidType},
        created_by ${uuidType},
        updated_by ${uuidType},
        created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
      );
    `;
    await queryRunner.query(auditEvidencesTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_evidences_test_fk ON audit_evidences(test_id);
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_evidences_tenant ON audit_evidences(tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_evidences_test ON audit_evidences(test_id);
    `);

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE audit_evidences 
        DROP CONSTRAINT IF EXISTS fk_audit_evidences_test CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_evidences 
        ADD CONSTRAINT fk_audit_evidences_test 
        FOREIGN KEY(test_id) REFERENCES audit_tests(id) ON DELETE CASCADE;
      `);
    }

    // Audit Findings
    const auditFindingsTableSql = `
      CREATE TABLE IF NOT EXISTS audit_findings (
        id ${uuidType} PRIMARY KEY,
        tenant_id ${uuidType} NOT NULL,
        engagement_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES audit_engagements(id) ON DELETE CASCADE' : ''},
        test_id ${uuidType}${isPostgres ? ' REFERENCES audit_tests(id) ON DELETE SET NULL' : ''},
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        title TEXT NOT NULL,
        details TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        due_date ${dateType},
        policy_id ${uuidType},
        clause_id ${uuidType},
        control_id ${uuidType},
        risk_instance_id ${uuidType},
        created_by ${uuidType},
        updated_by ${uuidType},
        created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
      );
    `;
    await queryRunner.query(auditFindingsTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_findings_engagement_fk ON audit_findings(engagement_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_findings_test_fk ON audit_findings(test_id);
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_findings_tenant ON audit_findings(tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_findings_engagement ON audit_findings(engagement_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_findings_test ON audit_findings(test_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_findings_status ON audit_findings(status);
    `);

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        DROP CONSTRAINT IF EXISTS fk_audit_findings_engagement CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        ADD CONSTRAINT fk_audit_findings_engagement 
        FOREIGN KEY(engagement_id) REFERENCES audit_engagements(id) ON DELETE CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        DROP CONSTRAINT IF EXISTS fk_audit_findings_test CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        ADD CONSTRAINT fk_audit_findings_test 
        FOREIGN KEY(test_id) REFERENCES audit_tests(id) ON DELETE SET NULL;
      `);
    }

    // Corrective Actions (CAP)
    const correctiveActionsTableSql = `
      CREATE TABLE IF NOT EXISTS corrective_actions (
        id ${uuidType} PRIMARY KEY,
        tenant_id ${uuidType} NOT NULL,
        finding_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES audit_findings(id) ON DELETE CASCADE' : ''},
        title TEXT NOT NULL,
        description TEXT,
        assignee_user_id ${uuidType},
        due_date ${dateType},
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        created_by ${uuidType},
        updated_by ${uuidType},
        created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
        updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
      );
    `;
    await queryRunner.query(correctiveActionsTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_corrective_actions_finding_fk ON corrective_actions(finding_id);
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_corrective_actions_tenant ON corrective_actions(tenant_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_corrective_actions_finding ON corrective_actions(finding_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_corrective_actions_status ON corrective_actions(status);
    `);

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE corrective_actions 
        DROP CONSTRAINT IF EXISTS fk_corrective_actions_finding CASCADE;
      `);
      await queryRunner.query(`
        ALTER TABLE corrective_actions 
        ADD CONSTRAINT fk_corrective_actions_finding 
        FOREIGN KEY(finding_id) REFERENCES audit_findings(id) ON DELETE CASCADE;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS corrective_actions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_findings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_evidences;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_tests;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_engagements;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_plans;`);
  }
}
