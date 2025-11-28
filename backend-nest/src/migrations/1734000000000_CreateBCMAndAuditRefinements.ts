import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBCMAndAuditRefinements1734000000000
  implements MigrationInterface
{
  name = 'CreateBCMAndAuditRefinements1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    const uuidType = isPostgres ? 'UUID' : 'TEXT';
    const numericType = isPostgres ? 'NUMERIC(10,2)' : 'REAL';
    const timestampType = isPostgres ? 'TIMESTAMP' : 'TEXT';
    const timestampDefault = isPostgres ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP';
    const dateType = isPostgres ? 'DATE' : 'TEXT';
    const jsonType = isPostgres ? 'JSONB' : 'TEXT';

    // Helper function to check if column exists in SQLite
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
          ) as exists;
        `, [table, column]);
        return result[0]?.exists || false;
      } else {
        const tableInfo = await queryRunner.query(`PRAGMA table_info(${table});`);
        return tableInfo.some((col: any) => col.name === column);
      }
    };

    // Add closed_at to corrective_actions
    const hasClosedAt = await columnExists('corrective_actions', 'closed_at');
    if (!hasClosedAt) {
      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE corrective_actions 
          ADD COLUMN closed_at ${timestampType};
        `);
      } else {
        await queryRunner.query(`
          ALTER TABLE corrective_actions 
          ADD COLUMN closed_at ${timestampType};
        `);
      }
    }

    // Add bia_process_id to audit_findings
    const hasBiaProcessId = await columnExists('audit_findings', 'bia_process_id');
    if (!hasBiaProcessId) {
      await queryRunner.query(`
        ALTER TABLE audit_findings 
        ADD COLUMN bia_process_id ${uuidType};
      `);
    }

    // Create bia_processes table
    const biaProcessesTableExists = await queryRunner.hasTable('bia_processes');
    if (!biaProcessesTableExists) {
      const biaProcessesTableSql = `
        CREATE TABLE IF NOT EXISTS bia_processes (
          id ${uuidType} PRIMARY KEY,
          tenant_id ${uuidType} NOT NULL,
          code VARCHAR(100) NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          owner_user_id ${uuidType},
          criticality INTEGER NOT NULL DEFAULT 3,
          rto_hours ${numericType} NOT NULL DEFAULT 24,
          rpo_hours ${numericType} NOT NULL DEFAULT 8,
          mtpd_hours ${numericType} NOT NULL DEFAULT 48,
          created_by ${uuidType},
          updated_by ${uuidType},
          created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
          updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
        );
      `;
      await queryRunner.query(biaProcessesTableSql);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bia_processes_tenant ON bia_processes(tenant_id);
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bia_processes_code_tenant ON bia_processes(code, tenant_id);
      `);
    }

    // Create bia_process_dependencies table
    const biaDependenciesTableExists = await queryRunner.hasTable('bia_process_dependencies');
    if (!biaDependenciesTableExists) {
      const biaDependenciesTableSql = `
        CREATE TABLE IF NOT EXISTS bia_process_dependencies (
          id ${uuidType} PRIMARY KEY,
          tenant_id ${uuidType} NOT NULL,
          process_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES bia_processes(id) ON DELETE CASCADE' : ''},
          entity_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES entities(id) ON DELETE CASCADE' : ''},
          dependency_type VARCHAR(50) NOT NULL DEFAULT 'other',
          created_by ${uuidType},
          updated_by ${uuidType},
          created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
          updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
        );
      `;
      await queryRunner.query(biaDependenciesTableSql);

      if (!isPostgres) {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_bia_deps_process_fk ON bia_process_dependencies(process_id);
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_bia_deps_entity_fk ON bia_process_dependencies(entity_id);
        `);
      }

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bia_deps_tenant ON bia_process_dependencies(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bia_deps_process ON bia_process_dependencies(process_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bia_deps_entity ON bia_process_dependencies(entity_id);
      `);

      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE bia_process_dependencies 
          DROP CONSTRAINT IF EXISTS fk_bia_deps_process CASCADE;
        `);
        await queryRunner.query(`
          ALTER TABLE bia_process_dependencies 
          ADD CONSTRAINT fk_bia_deps_process 
          FOREIGN KEY(process_id) REFERENCES bia_processes(id) ON DELETE CASCADE;
        `);
        await queryRunner.query(`
          ALTER TABLE bia_process_dependencies 
          DROP CONSTRAINT IF EXISTS fk_bia_deps_entity CASCADE;
        `);
        await queryRunner.query(`
          ALTER TABLE bia_process_dependencies 
          ADD CONSTRAINT fk_bia_deps_entity 
          FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE;
        `);
      }
    }

    // Create bcp_plans table
    const bcpPlansTableExists = await queryRunner.hasTable('bcp_plans');
    if (!bcpPlansTableExists) {
      const bcpPlansTableSql = `
        CREATE TABLE IF NOT EXISTS bcp_plans (
          id ${uuidType} PRIMARY KEY,
          tenant_id ${uuidType} NOT NULL,
          code VARCHAR(100) NOT NULL,
          name TEXT NOT NULL,
          process_id ${uuidType}${isPostgres ? ' REFERENCES bia_processes(id) ON DELETE SET NULL' : ''},
          scope_entity_id ${uuidType},
          version VARCHAR(20) NOT NULL DEFAULT '1.0',
          status VARCHAR(50) NOT NULL DEFAULT 'draft',
          steps ${jsonType} DEFAULT '[]',
          last_tested_at ${timestampType},
          created_by ${uuidType},
          updated_by ${uuidType},
          created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
          updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
        );
      `;
      await queryRunner.query(bcpPlansTableSql);

      if (!isPostgres) {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_bcp_plans_process_fk ON bcp_plans(process_id);
        `);
      }

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bcp_plans_tenant ON bcp_plans(tenant_id);
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bcp_plans_code_tenant ON bcp_plans(code, tenant_id);
      `);

      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE bcp_plans 
          DROP CONSTRAINT IF EXISTS fk_bcp_plans_process CASCADE;
        `);
        await queryRunner.query(`
          ALTER TABLE bcp_plans 
          ADD CONSTRAINT fk_bcp_plans_process 
          FOREIGN KEY(process_id) REFERENCES bia_processes(id) ON DELETE SET NULL;
        `);
      }
    }

    // Create bcp_exercises table
    const bcpExercisesTableExists = await queryRunner.hasTable('bcp_exercises');
    if (!bcpExercisesTableExists) {
      const bcpExercisesTableSql = `
        CREATE TABLE IF NOT EXISTS bcp_exercises (
          id ${uuidType} PRIMARY KEY,
          tenant_id ${uuidType} NOT NULL,
          plan_id ${uuidType} NOT NULL${isPostgres ? ' REFERENCES bcp_plans(id) ON DELETE CASCADE' : ''},
          code VARCHAR(100) NOT NULL,
          name TEXT NOT NULL,
          date ${dateType} NOT NULL,
          scenario TEXT,
          result TEXT,
          findings_count INTEGER NOT NULL DEFAULT 0,
          caps_count INTEGER NOT NULL DEFAULT 0,
          created_by ${uuidType},
          updated_by ${uuidType},
          created_at ${timestampType} NOT NULL DEFAULT ${timestampDefault},
          updated_at ${timestampType} NOT NULL DEFAULT ${timestampDefault}
        );
      `;
      await queryRunner.query(bcpExercisesTableSql);

      if (!isPostgres) {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_bcp_exercises_plan_fk ON bcp_exercises(plan_id);
        `);
      }

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bcp_exercises_tenant ON bcp_exercises(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_bcp_exercises_plan ON bcp_exercises(plan_id);
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bcp_exercises_code_tenant ON bcp_exercises(code, tenant_id);
      `);

      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE bcp_exercises 
          DROP CONSTRAINT IF EXISTS fk_bcp_exercises_plan CASCADE;
        `);
        await queryRunner.query(`
          ALTER TABLE bcp_exercises 
          ADD CONSTRAINT fk_bcp_exercises_plan 
          FOREIGN KEY(plan_id) REFERENCES bcp_plans(id) ON DELETE CASCADE;
        `);
      }
    }

    // Add FK from audit_findings to bia_processes (if bia_process_id exists)
    if (isPostgres) {
      const hasBiaProcessIdForFk = await columnExists('audit_findings', 'bia_process_id');
      if (hasBiaProcessIdForFk) {
        // Check if FK already exists
        const fkExists = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'audit_findings' 
            AND constraint_name = 'fk_audit_findings_bia_process'
          ) as exists;
        `);
        if (!fkExists[0]?.exists) {
          await queryRunner.query(`
            ALTER TABLE audit_findings 
            DROP CONSTRAINT IF EXISTS fk_audit_findings_bia_process CASCADE;
          `);
          await queryRunner.query(`
            ALTER TABLE audit_findings 
            ADD CONSTRAINT fk_audit_findings_bia_process 
            FOREIGN KEY(bia_process_id) REFERENCES bia_processes(id) ON DELETE SET NULL;
          `);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Remove FKs and tables in reverse order
    if (isPostgres) {
      const fkExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'audit_findings' 
          AND constraint_name = 'fk_audit_findings_bia_process'
        ) as exists;
      `);
      if (fkExists[0]?.exists) {
        await queryRunner.query(`
          ALTER TABLE audit_findings 
          DROP CONSTRAINT IF EXISTS fk_audit_findings_bia_process;
        `);
      }
    }

    if (isPostgres) {
      const hasBiaProcessId = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'audit_findings' AND column_name = 'bia_process_id'
        ) as exists;
      `);
      if (hasBiaProcessId[0]?.exists) {
        await queryRunner.query(`
          ALTER TABLE audit_findings 
          DROP COLUMN IF EXISTS bia_process_id;
        `);
      }
    }

    await queryRunner.query(`DROP TABLE IF EXISTS bcp_exercises;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bcp_plans;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bia_process_dependencies;`);
    await queryRunner.query(`DROP TABLE IF EXISTS bia_processes;`);

    if (isPostgres) {
      const hasClosedAt = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'corrective_actions' AND column_name = 'closed_at'
        ) as exists;
      `);
      if (hasClosedAt[0]?.exists) {
        await queryRunner.query(`
          ALTER TABLE corrective_actions 
          DROP COLUMN IF EXISTS closed_at;
        `);
      }
    }
  }
}
