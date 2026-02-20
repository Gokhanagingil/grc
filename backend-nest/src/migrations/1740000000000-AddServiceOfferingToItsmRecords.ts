import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceOfferingToItsmRecords1740000000000
  implements MigrationInterface
{
  name = 'AddServiceOfferingToItsmRecords1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── itsm_incidents: add offering_id + repurpose existing service_id to point to cmdb_service ──
    await queryRunner.query(`
      ALTER TABLE "itsm_incidents"
        ADD COLUMN IF NOT EXISTS "service_id" uuid,
        ADD COLUMN IF NOT EXISTS "offering_id" uuid
    `);

    // Drop any existing FK constraints on service_id (may point to itsm_services)
    await queryRunner.query(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'itsm_incidents'
            AND con.contype = 'f'
            AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = con.conrelid
                AND a.attnum = ANY(con.conkey)
                AND a.attname = 'service_id'
            )
        ) LOOP
          EXECUTE 'ALTER TABLE "itsm_incidents" DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
        END LOOP;
      END $$
    `);

    // NULL out any existing service_id values that reference itsm_services (not cmdb_service)
    await queryRunner.query(`
      UPDATE "itsm_incidents"
      SET "service_id" = NULL
      WHERE "service_id" IS NOT NULL
        AND "service_id" NOT IN (SELECT "id" FROM "cmdb_service")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incidents"
          ADD CONSTRAINT "FK_itsm_incidents_service_id"
          FOREIGN KEY ("service_id") REFERENCES "cmdb_service"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_incidents"
          ADD CONSTRAINT "FK_itsm_incidents_offering_id"
          FOREIGN KEY ("offering_id") REFERENCES "cmdb_service_offering"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_service"
        ON "itsm_incidents" ("tenant_id", "service_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_incidents_tenant_offering"
        ON "itsm_incidents" ("tenant_id", "offering_id")
    `);

    // ── itsm_changes: add offering_id + repurpose existing service_id to point to cmdb_service ──
    await queryRunner.query(`
      ALTER TABLE "itsm_changes"
        ADD COLUMN IF NOT EXISTS "offering_id" uuid
    `);

    // Drop any existing FK constraints on service_id (may point to itsm_services)
    await queryRunner.query(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          WHERE rel.relname = 'itsm_changes'
            AND con.contype = 'f'
            AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = con.conrelid
                AND a.attnum = ANY(con.conkey)
                AND a.attname = 'service_id'
            )
        ) LOOP
          EXECUTE 'ALTER TABLE "itsm_changes" DROP CONSTRAINT IF EXISTS "' || r.conname || '"';
        END LOOP;
      END $$
    `);

    // NULL out any existing service_id values that reference itsm_services (not cmdb_service)
    await queryRunner.query(`
      UPDATE "itsm_changes"
      SET "service_id" = NULL
      WHERE "service_id" IS NOT NULL
        AND "service_id" NOT IN (SELECT "id" FROM "cmdb_service")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes"
          ADD CONSTRAINT "FK_itsm_changes_service_id"
          FOREIGN KEY ("service_id") REFERENCES "cmdb_service"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_changes"
          ADD CONSTRAINT "FK_itsm_changes_offering_id"
          FOREIGN KEY ("offering_id") REFERENCES "cmdb_service_offering"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_service"
        ON "itsm_changes" ("tenant_id", "service_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_changes_tenant_offering"
        ON "itsm_changes" ("tenant_id", "offering_id")
    `);

    // ── itsm_services: add service_id and offering_id ──
    await queryRunner.query(`
      ALTER TABLE "itsm_services"
        ADD COLUMN IF NOT EXISTS "service_id" uuid,
        ADD COLUMN IF NOT EXISTS "offering_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_services"
          ADD CONSTRAINT "FK_itsm_services_cmdb_service_id"
          FOREIGN KEY ("service_id") REFERENCES "cmdb_service"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "itsm_services"
          ADD CONSTRAINT "FK_itsm_services_cmdb_offering_id"
          FOREIGN KEY ("offering_id") REFERENCES "cmdb_service_offering"("id")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_services_tenant_service"
        ON "itsm_services" ("tenant_id", "service_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_itsm_services_tenant_offering"
        ON "itsm_services" ("tenant_id", "offering_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itsm_services_tenant_offering"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itsm_services_tenant_service"`);
    await queryRunner.query(`ALTER TABLE "itsm_services" DROP CONSTRAINT IF EXISTS "FK_itsm_services_cmdb_offering_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_services" DROP CONSTRAINT IF EXISTS "FK_itsm_services_cmdb_service_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_services" DROP COLUMN IF EXISTS "offering_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_services" DROP COLUMN IF EXISTS "service_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itsm_changes_tenant_offering"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itsm_changes_tenant_service"`);
    await queryRunner.query(`ALTER TABLE "itsm_changes" DROP CONSTRAINT IF EXISTS "FK_itsm_changes_offering_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_changes" DROP CONSTRAINT IF EXISTS "FK_itsm_changes_service_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_changes" DROP COLUMN IF EXISTS "offering_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itsm_incidents_tenant_offering"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itsm_incidents_tenant_service"`);
    await queryRunner.query(`ALTER TABLE "itsm_incidents" DROP CONSTRAINT IF EXISTS "FK_itsm_incidents_offering_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_incidents" DROP CONSTRAINT IF EXISTS "FK_itsm_incidents_service_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_incidents" DROP COLUMN IF EXISTS "offering_id"`);
    await queryRunner.query(`ALTER TABLE "itsm_incidents" DROP COLUMN IF EXISTS "service_id"`);
  }
}
