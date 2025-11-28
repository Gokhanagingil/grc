import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntityRegistry1732000000000 implements MigrationInterface {
  name = 'CreateEntityRegistry1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get driver type to determine database-specific SQL
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    // Create entity_types table
    const entityTypesTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS public.entity_types (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_entity_types_code_tenant UNIQUE (code, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS entity_types (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(entityTypesTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_entity_types_code_tenant ON entity_types(code, tenant_id);
      `);
    }

    // Create entities table
    const entitiesTableSql = isPostgres
      ? `
      CREATE TABLE IF NOT EXISTS public.entities (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        entity_type_id UUID NOT NULL REFERENCES public.entity_types(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        criticality INTEGER NOT NULL DEFAULT 3 CHECK (criticality >= 1 AND criticality <= 5),
        owner_user_id UUID,
        attributes JSONB DEFAULT '{}',
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_entities_code_tenant UNIQUE (code, tenant_id)
      );
    `
      : `
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        entity_type_id TEXT NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
        code VARCHAR(100) NOT NULL,
        name TEXT NOT NULL,
        criticality INTEGER NOT NULL DEFAULT 3 CHECK (criticality >= 1 AND criticality <= 5),
        owner_user_id TEXT,
        attributes TEXT DEFAULT '{}',
        created_by TEXT,
        updated_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await queryRunner.query(entitiesTableSql);

    if (!isPostgres) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_entities_code_tenant ON entities(code, tenant_id);
      `);
    }

    // Create indexes
    if (isPostgres) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_entity_types_tenant ON public.entity_types(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entity_types_code_tenant ON public.entity_types(code, tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_tenant ON public.entities(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(entity_type_id);
        CREATE INDEX IF NOT EXISTS idx_entities_code_tenant ON public.entities(code, tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_owner ON public.entities(owner_user_id);
      `);
    } else {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_entity_types_tenant ON entity_types(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entity_types_code_tenant ON entity_types(code, tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type_id);
        CREATE INDEX IF NOT EXISTS idx_entities_code_tenant ON entities(code, tenant_id);
        CREATE INDEX IF NOT EXISTS idx_entities_owner ON entities(owner_user_id);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`DROP TABLE IF EXISTS public.entities;`);
      await queryRunner.query(`DROP TABLE IF EXISTS public.entity_types;`);
    } else {
      await queryRunner.query(`DROP TABLE IF EXISTS entities;`);
      await queryRunner.query(`DROP TABLE IF EXISTS entity_types;`);
    }
  }
}
