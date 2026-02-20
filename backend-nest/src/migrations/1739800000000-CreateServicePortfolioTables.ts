import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServicePortfolioTables1739800000000 implements MigrationInterface {
  name = 'CreateServicePortfolioTables1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cmdb_service (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES nest_tenants(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'planned',
        tier VARCHAR(50),
        criticality VARCHAR(50),
        owner_user_id UUID,
        owner_email VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cmdb_service_offering (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES nest_tenants(id),
        service_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'planned',
        support_hours VARCHAR(100),
        default_sla_profile_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE cmdb_service_offering
          ADD CONSTRAINT fk_cmdb_service_offering_service
          FOREIGN KEY (service_id) REFERENCES cmdb_service(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cmdb_service_tenant_name
        ON cmdb_service (tenant_id, name) WHERE is_deleted = FALSE;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cmdb_service_offering_tenant_service_name
        ON cmdb_service_offering (tenant_id, service_id, name) WHERE is_deleted = FALSE;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_tenant_type ON cmdb_service (tenant_id, type);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_tenant_status ON cmdb_service (tenant_id, status);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_tenant_tier ON cmdb_service (tenant_id, tier);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_tenant_criticality ON cmdb_service (tenant_id, criticality);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_tenant_created ON cmdb_service (tenant_id, created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_offering_tenant_service ON cmdb_service_offering (tenant_id, service_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_offering_tenant_status ON cmdb_service_offering (tenant_id, status);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_offering_tenant_created ON cmdb_service_offering (tenant_id, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS cmdb_service_offering;`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS cmdb_service;`);
  }
}
