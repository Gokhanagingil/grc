import { MigrationInterface, QueryRunner } from 'typeorm';

export class DataFoundationsSquashed1730000005000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;

    // PostgreSQL-specific extension (skip for SQLite)
    if (driver === 'postgres') {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS ltree;');
    }

    // PostgreSQL schemas (SQLite doesn't support schemas, we use table name prefixes)
    if (driver === 'postgres') {
      await queryRunner.query('CREATE SCHEMA IF NOT EXISTS app;');
    }

    // 1. risk_category
    const riskCategoryTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.risk_category (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        code VARCHAR(50) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_category (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code VARCHAR(50) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(riskCategoryTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_risk_category ON app.risk_category(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_category_code ON app.risk_category(code);',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_category DROP CONSTRAINT IF EXISTS uq_riskcat_tenant_code CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_category ADD CONSTRAINT uq_riskcat_tenant_code UNIQUE(tenant_id, code);',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_risk_category ON risk_category(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_category_code ON risk_category(code);',
      );
      // SQLite doesn't support DROP CONSTRAINT IF EXISTS, so we skip it
      // Unique constraint is handled via CREATE UNIQUE INDEX
      await queryRunner.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_riskcat_tenant_code ON risk_category(tenant_id, code);',
      );
    }

    // 2. standard
    const standardTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.standard (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        code VARCHAR(50) NOT NULL,
        name TEXT NOT NULL,
        version VARCHAR(20),
        publisher VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS standard (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code VARCHAR(50) NOT NULL,
        name TEXT NOT NULL,
        version VARCHAR(20),
        publisher VARCHAR(100),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(standardTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_standard ON app.standard(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_code ON app.standard(code);',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard DROP CONSTRAINT IF EXISTS uq_standard_tenant_code CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard ADD CONSTRAINT uq_standard_tenant_code UNIQUE(tenant_id, code);',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_standard ON standard(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_code ON standard(code);',
      );
      await queryRunner.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_standard_tenant_code ON standard(tenant_id, code);',
      );
    }

    // 3. standard_clause
    const standardClauseTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.standard_clause (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        standard_id UUID NOT NULL,
        clause_code VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        text TEXT,
        parent_id UUID,
        path VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS standard_clause (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        standard_id TEXT NOT NULL,
        clause_code VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        text TEXT,
        parent_id TEXT,
        path VARCHAR(500),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(standardClauseTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_standard_clause ON app.standard_clause(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_clause_standard_id ON app.standard_clause(standard_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_clause_code ON app.standard_clause(clause_code);',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_clause DROP CONSTRAINT IF EXISTS uq_clause_tenant_code CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_clause ADD CONSTRAINT uq_clause_tenant_code UNIQUE(tenant_id, clause_code);',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_clause DROP CONSTRAINT IF EXISTS fk_standard_clause_standard CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_clause ADD CONSTRAINT fk_standard_clause_standard FOREIGN KEY(standard_id) REFERENCES app.standard(id) ON DELETE CASCADE;',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_standard_clause ON standard_clause(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_clause_standard_id ON standard_clause(standard_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_clause_code ON standard_clause(clause_code);',
      );
      await queryRunner.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_clause_tenant_code ON standard_clause(tenant_id, clause_code);',
      );
      // SQLite foreign keys are handled via table definition
    }

    // 4. control_library
    const controlLibraryTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.control_library (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        family VARCHAR(100),
        "references" JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS control_library (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        family VARCHAR(100),
        "references" TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(controlLibraryTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_control_library ON app.control_library(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_control_library_code ON app.control_library(code);',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_library DROP CONSTRAINT IF EXISTS uq_control_tenant_code CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_library ADD CONSTRAINT uq_control_tenant_code UNIQUE(tenant_id, code);',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_control_library ON control_library(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_control_library_code ON control_library(code);',
      );
      await queryRunner.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_control_tenant_code ON control_library(tenant_id, code);',
      );
    }

    // 5. risk_catalog
    const riskCatalogTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.risk_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category_id UUID,
        default_likelihood INTEGER DEFAULT 3,
        default_impact INTEGER DEFAULT 3,
        control_refs JSONB DEFAULT '[]',
        tags JSONB DEFAULT '[]',
        schema_version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_catalog (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category_id TEXT,
        default_likelihood INTEGER DEFAULT 3,
        default_impact INTEGER DEFAULT 3,
        control_refs TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        schema_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(riskCatalogTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_risk_catalog ON app.risk_catalog(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_catalog_category_id ON app.risk_catalog(category_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_catalog_code ON app.risk_catalog(code);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS gin_risk_catalog_tags ON app.risk_catalog USING GIN (tags);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS gin_risk_catalog_control_refs ON app.risk_catalog USING GIN (control_refs);',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_catalog DROP CONSTRAINT IF EXISTS uq_risk_tenant_code CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_catalog ADD CONSTRAINT uq_risk_tenant_code UNIQUE(tenant_id, code);',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_catalog DROP CONSTRAINT IF EXISTS fk_risk_catalog_category CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_catalog ADD CONSTRAINT fk_risk_catalog_category FOREIGN KEY(category_id) REFERENCES app.risk_category(id) ON DELETE SET NULL;',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_risk_catalog ON risk_catalog(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_catalog_category_id ON risk_catalog(category_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_catalog_code ON risk_catalog(code);',
      );
      // SQLite doesn't support GIN indexes, skip them
      await queryRunner.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_tenant_code ON risk_catalog(tenant_id, code);',
      );
      // SQLite foreign keys are handled via table definition
    }

    // 6. standard_mapping
    const standardMappingTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.standard_mapping (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        from_clause_id UUID NOT NULL,
        to_clause_id UUID NOT NULL,
        relation VARCHAR(20) NOT NULL DEFAULT 'similar',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS standard_mapping (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        from_clause_id TEXT NOT NULL,
        to_clause_id TEXT NOT NULL,
        relation VARCHAR(20) NOT NULL DEFAULT 'similar',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(standardMappingTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_standard_mapping ON app.standard_mapping(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_mapping_from ON app.standard_mapping(from_clause_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_mapping_to ON app.standard_mapping(to_clause_id);',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_mapping DROP CONSTRAINT IF EXISTS fk_standard_mapping_from CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_mapping ADD CONSTRAINT fk_standard_mapping_from FOREIGN KEY(from_clause_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_mapping DROP CONSTRAINT IF EXISTS fk_standard_mapping_to CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_mapping ADD CONSTRAINT fk_standard_mapping_to FOREIGN KEY(to_clause_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_standard_mapping ON standard_mapping(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_mapping_from ON standard_mapping(from_clause_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_standard_mapping_to ON standard_mapping(to_clause_id);',
      );
      // SQLite foreign keys are handled via table definition
    }

    // 7. control_to_clause
    const controlToClauseTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.control_to_clause (
        control_id UUID NOT NULL,
        clause_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (control_id, clause_id, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS control_to_clause (
        control_id TEXT NOT NULL,
        clause_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (control_id, clause_id, tenant_id)
      );
    `;
    await queryRunner.query(controlToClauseTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_control_to_clause ON app.control_to_clause(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_control_to_clause_control ON app.control_to_clause(control_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_control_to_clause_clause ON app.control_to_clause(clause_id);',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_to_clause DROP CONSTRAINT IF EXISTS fk_control_to_clause_control CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_to_clause ADD CONSTRAINT fk_control_to_clause_control FOREIGN KEY(control_id) REFERENCES app.control_library(id) ON DELETE CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_to_clause DROP CONSTRAINT IF EXISTS fk_control_to_clause_clause CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_to_clause ADD CONSTRAINT fk_control_to_clause_clause FOREIGN KEY(clause_id) REFERENCES app.standard_clause(id) ON DELETE CASCADE;',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_control_to_clause ON control_to_clause(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_control_to_clause_control ON control_to_clause(control_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_control_to_clause_clause ON control_to_clause(clause_id);',
      );
      // SQLite foreign keys are handled via table definition
    }

    // 8. risk_to_control
    const riskToControlTableSql = driver === 'postgres'
      ? `
      CREATE TABLE IF NOT EXISTS app.risk_to_control (
        risk_id UUID NOT NULL,
        control_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (risk_id, control_id, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_to_control (
        risk_id TEXT NOT NULL,
        control_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (risk_id, control_id, tenant_id)
      );
    `;
    await queryRunner.query(riskToControlTableSql);

    if (driver === 'postgres') {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_risk_to_control ON app.risk_to_control(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_to_control_risk ON app.risk_to_control(risk_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_to_control_control ON app.risk_to_control(control_id);',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_to_control DROP CONSTRAINT IF EXISTS fk_risk_to_control_risk CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_to_control ADD CONSTRAINT fk_risk_to_control_risk FOREIGN KEY(risk_id) REFERENCES app.risk_catalog(id) ON DELETE CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_to_control DROP CONSTRAINT IF EXISTS fk_risk_to_control_control CASCADE;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_to_control ADD CONSTRAINT fk_risk_to_control_control FOREIGN KEY(control_id) REFERENCES app.control_library(id) ON DELETE CASCADE;',
      );
    } else {
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_all_tenant_risk_to_control ON risk_to_control(tenant_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_to_control_risk ON risk_to_control(risk_id);',
      );
      await queryRunner.query(
        'CREATE INDEX IF NOT EXISTS idx_risk_to_control_control ON risk_to_control(control_id);',
      );
      // SQLite foreign keys are handled via table definition
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;

    if (driver === 'postgres') {
      // Development only - safe DROP order
      // Drop constraints first
      await queryRunner.query(
        'ALTER TABLE app.risk_to_control DROP CONSTRAINT IF EXISTS fk_risk_to_control_control;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_to_control DROP CONSTRAINT IF EXISTS fk_risk_to_control_risk;',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_to_clause DROP CONSTRAINT IF EXISTS fk_control_to_clause_clause;',
      );
      await queryRunner.query(
        'ALTER TABLE app.control_to_clause DROP CONSTRAINT IF EXISTS fk_control_to_clause_control;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_mapping DROP CONSTRAINT IF EXISTS fk_standard_mapping_to;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_mapping DROP CONSTRAINT IF EXISTS fk_standard_mapping_from;',
      );
      await queryRunner.query(
        'ALTER TABLE app.risk_catalog DROP CONSTRAINT IF EXISTS fk_risk_catalog_category;',
      );
      await queryRunner.query(
        'ALTER TABLE app.standard_clause DROP CONSTRAINT IF EXISTS fk_standard_clause_standard;',
      );

      // Drop junction tables first
      await queryRunner.query(
        'DROP TABLE IF EXISTS app.risk_to_control CASCADE;',
      );
      await queryRunner.query(
        'DROP TABLE IF EXISTS app.control_to_clause CASCADE;',
      );
      await queryRunner.query(
        'DROP TABLE IF EXISTS app.standard_mapping CASCADE;',
      );

      // Drop main tables
      await queryRunner.query('DROP TABLE IF EXISTS app.risk_catalog CASCADE;');
      await queryRunner.query(
        'DROP TABLE IF EXISTS app.control_library CASCADE;',
      );
      await queryRunner.query(
        'DROP TABLE IF EXISTS app.standard_clause CASCADE;',
      );
      await queryRunner.query('DROP TABLE IF EXISTS app.standard CASCADE;');
      await queryRunner.query('DROP TABLE IF EXISTS app.risk_category CASCADE;');

      // Note: ltree extension is not dropped (may be used by other schemas)
    } else {
      // SQLite: Drop tables directly (no CASCADE needed)
      await queryRunner.query('DROP TABLE IF EXISTS risk_to_control;');
      await queryRunner.query('DROP TABLE IF EXISTS control_to_clause;');
      await queryRunner.query('DROP TABLE IF EXISTS standard_mapping;');
      await queryRunner.query('DROP TABLE IF EXISTS risk_catalog;');
      await queryRunner.query('DROP TABLE IF EXISTS control_library;');
      await queryRunner.query('DROP TABLE IF EXISTS standard_clause;');
      await queryRunner.query('DROP TABLE IF EXISTS standard;');
      await queryRunner.query('DROP TABLE IF EXISTS risk_category;');
    }
  }
}
