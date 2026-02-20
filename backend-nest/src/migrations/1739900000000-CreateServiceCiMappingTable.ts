import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceCiMappingTable1739900000000 implements MigrationInterface {
  name = 'CreateServiceCiMappingTable1739900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cmdb_service_ci (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES nest_tenants(id),
        service_id UUID NOT NULL,
        ci_id UUID NOT NULL,
        relationship_type VARCHAR(50) NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE cmdb_service_ci
          ADD CONSTRAINT fk_cmdb_service_ci_service
          FOREIGN KEY (service_id) REFERENCES cmdb_service(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE cmdb_service_ci
          ADD CONSTRAINT fk_cmdb_service_ci_ci
          FOREIGN KEY (ci_id) REFERENCES cmdb_ci(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE cmdb_service_ci
          ADD CONSTRAINT uq_cmdb_service_ci_tenant_service_ci_type
          UNIQUE (tenant_id, service_id, ci_id, relationship_type);
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_ci_tenant_service
        ON cmdb_service_ci (tenant_id, service_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_ci_tenant_ci
        ON cmdb_service_ci (tenant_id, ci_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_ci_tenant_rel_type
        ON cmdb_service_ci (tenant_id, relationship_type);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cmdb_service_ci_tenant_created
        ON cmdb_service_ci (tenant_id, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cmdb_service_ci;`);
  }
}
