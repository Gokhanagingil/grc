import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRiskInstanceAndCatalogFields1731000000000
  implements MigrationInterface
{
  name = 'AddRiskInstanceAndCatalogFields1731000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Add entity_type and entity_filter to risk_catalog
    const riskCatalogTable = isPostgres ? 'public.risk_catalog' : 'risk_catalog';
    
    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${riskCatalogTable} 
        ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS entity_filter TEXT,
        ADD COLUMN IF NOT EXISTS owner_role TEXT;
      `);
    } else {
      // SQLite doesn't support ADD COLUMN IF NOT EXISTS, check first
      const tableInfo = await queryRunner.query(`PRAGMA table_info(${riskCatalogTable});`);
      const hasEntityType = tableInfo.some((col: any) => col.name === 'entity_type');
      const hasEntityFilter = tableInfo.some((col: any) => col.name === 'entity_filter');
      const hasOwnerRole = tableInfo.some((col: any) => col.name === 'owner_role');

      if (!hasEntityType) {
        await queryRunner.query(`ALTER TABLE ${riskCatalogTable} ADD COLUMN entity_type VARCHAR(50);`);
      }
      if (!hasEntityFilter) {
        await queryRunner.query(`ALTER TABLE ${riskCatalogTable} ADD COLUMN entity_filter TEXT;`);
      }
      if (!hasOwnerRole) {
        await queryRunner.query(`ALTER TABLE ${riskCatalogTable} ADD COLUMN owner_role TEXT;`);
      }
    }

    // Create risk_instances table
    const riskInstancesTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS public.risk_instances (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        catalog_id UUID NOT NULL REFERENCES public.risk_catalog(id) ON DELETE CASCADE,
        entity_id UUID NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        owner_id UUID,
        assigned_to UUID,
        likelihood INTEGER NOT NULL DEFAULT 3,
        impact INTEGER NOT NULL DEFAULT 3,
        residual_risk DECIMAL(5,2),
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        controls_linked TEXT[] DEFAULT '{}',
        notes TEXT,
        last_assessed_at TIMESTAMP,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_catalog_entity UNIQUE (catalog_id, entity_id, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS risk_instances (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        catalog_id TEXT NOT NULL REFERENCES risk_catalog(id) ON DELETE CASCADE,
        entity_id TEXT NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        owner_id TEXT,
        assigned_to TEXT,
        likelihood INTEGER NOT NULL DEFAULT 3,
        impact INTEGER NOT NULL DEFAULT 3,
        residual_risk REAL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        controls_linked TEXT DEFAULT '[]',
        notes TEXT,
        last_assessed_at TEXT,
        created_by TEXT,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(riskInstancesTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_catalog_entity ON risk_instances(catalog_id, entity_id, tenant_id);
      `);
    }

    // Create indexes
    const tablePrefix = isPostgres ? 'public.' : '';
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_instances_tenant ON ${tablePrefix}risk_instances(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_risk_instances_catalog ON ${tablePrefix}risk_instances(catalog_id);
      CREATE INDEX IF NOT EXISTS idx_risk_instances_entity ON ${tablePrefix}risk_instances(entity_id, entity_type);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}risk_instances;`);
    
    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE ${tablePrefix}risk_catalog 
        DROP COLUMN IF EXISTS entity_type,
        DROP COLUMN IF EXISTS entity_filter,
        DROP COLUMN IF EXISTS owner_role;
      `);
    } else {
      // SQLite doesn't support DROP COLUMN easily, skip for down migration
      // In practice, this would require recreating the table
    }
  }
}
