import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Risk Module Full Rewrite Migration
 * 
 * This migration implements the complete enterprise-grade Risk Management module
 * with ISO 27005 + NIST RMF + COSO alignment:
 * 
 * - Enhanced Risk Catalog with full fields
 * - Complete Risk Instance lifecycle
 * - N:N relationships (controls, policies, requirements)
 * - Attachment support
 * - Inherent/Residual scoring
 * - Treatment plans
 */
export class RiskModuleFullRewrite1741000000000
  implements MigrationInterface
{
  name = 'RiskModuleFullRewrite1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    // Helper to check if column exists
    const columnExists = async (table: string, column: string): Promise<boolean> => {
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = $2
          );
        `, [table.replace('public.', ''), column]);
        return result[0]?.exists || false;
      }
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${table.replace('public.', '')});`);
      return tableInfo.some((col: any) => col.name === column);
    };

    // ============================================
    // PART 1: Update risk_catalog table
    // ============================================
    const riskCatalogTable = `${tablePrefix}risk_catalog`;
    
    // Add new fields to risk_catalog
    const newCatalogFields = [
      { name: 'title', type: isPostgres ? 'TEXT' : 'TEXT', nullable: true },
      { name: 'risk_statement', type: isPostgres ? 'TEXT' : 'TEXT', nullable: true },
      { name: 'root_cause', type: isPostgres ? 'TEXT' : 'TEXT', nullable: true },
      { name: 'impact_areas', type: isPostgres ? 'JSONB' : 'TEXT', nullable: true },
      { name: 'default_inherent_likelihood', type: 'INTEGER', nullable: true },
      { name: 'default_inherent_impact', type: 'INTEGER', nullable: true },
      { name: 'default_inherent_score', type: 'INTEGER', nullable: true },
    ];

    for (const field of newCatalogFields) {
      const exists = await columnExists(riskCatalogTable, field.name);
      if (!exists) {
        if (isPostgres) {
          await queryRunner.query(`
            ALTER TABLE ${riskCatalogTable}
            ADD COLUMN ${field.name} ${field.type}${field.nullable ? '' : ' NOT NULL'};
          `);
        } else {
          await queryRunner.query(`
            ALTER TABLE ${riskCatalogTable}
            ADD COLUMN ${field.name} ${field.type};
          `);
        }
      }
    }

    // Migrate existing data: copy name to title
    await queryRunner.query(`
      UPDATE ${riskCatalogTable}
      SET title = name
      WHERE title IS NULL AND name IS NOT NULL;
    `);

    // Migrate existing data: copy default_likelihood/impact to inherent
    await queryRunner.query(`
      UPDATE ${riskCatalogTable}
      SET 
        default_inherent_likelihood = COALESCE(default_inherent_likelihood, default_likelihood, 3),
        default_inherent_impact = COALESCE(default_inherent_impact, default_impact, 3),
        default_inherent_score = COALESCE(
          default_inherent_likelihood * default_inherent_impact,
          default_likelihood * default_impact,
          9
        )
      WHERE default_inherent_likelihood IS NULL;
    `);

    // ============================================
    // PART 2: Create N:N relationship tables
    // ============================================
    
    // Create risk_to_policy table
    const riskToPolicyTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS ${tablePrefix}risk_to_policy (
        risk_id UUID NOT NULL REFERENCES ${tablePrefix}risk_catalog(id) ON DELETE CASCADE,
        policy_id UUID NOT NULL REFERENCES ${tablePrefix}policies(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (risk_id, policy_id, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_to_policy (
        risk_id TEXT NOT NULL REFERENCES risk_catalog(id) ON DELETE CASCADE,
        policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (risk_id, policy_id, tenant_id)
      );
    `;
    await queryRunner.query(riskToPolicyTableSql);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_to_policy_tenant ON ${tablePrefix}risk_to_policy(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_risk_to_policy_risk ON ${tablePrefix}risk_to_policy(risk_id);
      CREATE INDEX IF NOT EXISTS idx_risk_to_policy_policy ON ${tablePrefix}risk_to_policy(policy_id);
    `);

    // Create risk_to_requirement table
    const riskToRequirementTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS ${tablePrefix}risk_to_requirement (
        risk_id UUID NOT NULL REFERENCES ${tablePrefix}risk_catalog(id) ON DELETE CASCADE,
        requirement_id UUID NOT NULL REFERENCES ${tablePrefix}requirements(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (risk_id, requirement_id, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_to_requirement (
        risk_id TEXT NOT NULL REFERENCES risk_catalog(id) ON DELETE CASCADE,
        requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (risk_id, requirement_id, tenant_id)
      );
    `;
    await queryRunner.query(riskToRequirementTableSql);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_to_requirement_tenant ON ${tablePrefix}risk_to_requirement(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_risk_to_requirement_risk ON ${tablePrefix}risk_to_requirement(risk_id);
      CREATE INDEX IF NOT EXISTS idx_risk_to_requirement_requirement ON ${tablePrefix}risk_to_requirement(requirement_id);
    `);

    // ============================================
    // PART 3: Create attachment tables
    // ============================================
    
    // Create risk_catalog_attachments table
    const riskCatalogAttachmentsTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS ${tablePrefix}risk_catalog_attachments (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        risk_catalog_id UUID NOT NULL REFERENCES ${tablePrefix}risk_catalog(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        description TEXT,
        uploaded_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_catalog_attachments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        risk_catalog_id TEXT NOT NULL REFERENCES risk_catalog(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        description TEXT,
        uploaded_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(riskCatalogAttachmentsTableSql);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_catalog_attachments_tenant ON ${tablePrefix}risk_catalog_attachments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_risk_catalog_attachments_risk ON ${tablePrefix}risk_catalog_attachments(risk_catalog_id);
    `);

    // Create risk_instance_attachments table
    const riskInstanceAttachmentsTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS ${tablePrefix}risk_instance_attachments (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        risk_instance_id UUID NOT NULL REFERENCES ${tablePrefix}risk_instances(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        description TEXT,
        uploaded_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_instance_attachments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        risk_instance_id TEXT NOT NULL REFERENCES risk_instances(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        description TEXT,
        uploaded_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(riskInstanceAttachmentsTableSql);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_instance_attachments_tenant ON ${tablePrefix}risk_instance_attachments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_risk_instance_attachments_risk ON ${tablePrefix}risk_instance_attachments(risk_instance_id);
    `);

    // ============================================
    // PART 4: Update risk_instances table
    // ============================================
    const riskInstancesTable = `${tablePrefix}risk_instances`;
    
    // Add new fields to risk_instances
    const newInstanceFields = [
      { name: 'description', type: isPostgres ? 'TEXT' : 'TEXT', nullable: true },
      { name: 'inherent_likelihood', type: 'INTEGER', nullable: true },
      { name: 'inherent_impact', type: 'INTEGER', nullable: true },
      { name: 'inherent_score', type: 'INTEGER', nullable: true },
      { name: 'residual_likelihood', type: 'INTEGER', nullable: true },
      { name: 'residual_impact', type: 'INTEGER', nullable: true },
      { name: 'residual_score', type: 'INTEGER', nullable: true },
      { name: 'treatment_action', type: isPostgres ? 'TEXT' : 'TEXT', nullable: true },
      { name: 'treatment_owner_id', type: isPostgres ? 'UUID' : 'TEXT', nullable: true },
      { name: 'treatment_due_date', type: isPostgres ? 'TIMESTAMP' : 'TEXT', nullable: true },
      { name: 'expected_reduction', type: isPostgres ? 'TEXT' : 'TEXT', nullable: true },
    ];

    for (const field of newInstanceFields) {
      const exists = await columnExists(riskInstancesTable, field.name);
      if (!exists) {
        if (isPostgres) {
          await queryRunner.query(`
            ALTER TABLE ${riskInstancesTable}
            ADD COLUMN ${field.name} ${field.type}${field.nullable ? '' : ' NOT NULL'};
          `);
        } else {
          await queryRunner.query(`
            ALTER TABLE ${riskInstancesTable}
            ADD COLUMN ${field.name} ${field.type};
          `);
        }
      }
    }

    // Migrate existing data: copy likelihood/impact to inherent
    await queryRunner.query(`
      UPDATE ${riskInstancesTable}
      SET 
        inherent_likelihood = COALESCE(inherent_likelihood, likelihood, 3),
        inherent_impact = COALESCE(inherent_impact, impact, 3),
        inherent_score = COALESCE(
          inherent_likelihood * inherent_impact,
          likelihood * impact,
          9
        )
      WHERE inherent_likelihood IS NULL;
    `);

    // Update status enum to include 'draft' and 'in_progress'
    // Note: For Postgres enum types, this would require ALTER TYPE, but we're using VARCHAR
    // so no migration needed for SQLite/Postgres text columns

    // Add status index if not exists
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_instances_status ON ${riskInstancesTable}(status);
    `);

    // Make entity_type nullable (it can now be inferred from entity_id)
    // Note: This is already nullable in the new entity definition
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    // Drop attachment tables
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}risk_instance_attachments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}risk_catalog_attachments;`);

    // Drop N:N relationship tables
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}risk_to_requirement;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}risk_to_policy;`);

    // Note: We don't drop columns from risk_catalog and risk_instances
    // to maintain backward compatibility. If full rollback is needed,
    // those columns can be dropped manually.
  }
}

