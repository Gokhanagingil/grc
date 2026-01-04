import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: RenameTenantsToNestTenants
 *
 * Renames the "tenants" table to "nest_tenants" to align with the entity definition.
 * The Tenant entity expects table name "nest_tenants" (@Entity('nest_tenants')).
 *
 * This migration is idempotent:
 * - If "tenants" exists and "nest_tenants" does not, rename the table.
 * - If "nest_tenants" already exists, do nothing.
 * - PostgreSQL automatically updates all foreign key constraints when a table is renamed.
 *
 * This migration runs after all existing migrations that reference "tenants"(id)
 * to ensure all FK constraints are created first, then updated automatically
 * when the table is renamed.
 */
export class RenameTenantsToNestTenants1735100000000 implements MigrationInterface {
  name = 'RenameTenantsToNestTenants1735100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if "tenants" table exists and "nest_tenants" does not exist
    const tenantsExistsResult = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const nestTenantsExistsResult = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'nest_tenants'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const tenantsExists =
      (tenantsExistsResult[0] as { exists: boolean } | undefined)?.exists ===
      true;
    const nestTenantsExists =
      (nestTenantsExistsResult[0] as { exists: boolean } | undefined)
        ?.exists === true;

    // Only rename if "tenants" exists and "nest_tenants" does not exist
    if (tenantsExists && !nestTenantsExists) {
      // Rename the table
      // PostgreSQL automatically updates all foreign key constraints
      // when a table is renamed (they're stored by OID, not by name)
      await queryRunner.query(`ALTER TABLE "tenants" RENAME TO "nest_tenants"`);

      // Rename indexes (PostgreSQL doesn't automatically rename indexes)
      // These index names are from CreateTenantsTable migration
      // Check if index exists before renaming (PostgreSQL doesn't support IF EXISTS for RENAME)
      const nameIndexExists = (await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = 'IDX_tenants_name_unique'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      if (
        (nameIndexExists[0] as { exists: boolean } | undefined)?.exists === true
      ) {
        await queryRunner.query(`
          ALTER INDEX "IDX_tenants_name_unique" 
          RENAME TO "IDX_nest_tenants_name_unique"
        `);
      }

      const isActiveIndexExists = (await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = 'IDX_tenants_is_active'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      if (
        (isActiveIndexExists[0] as { exists: boolean } | undefined)?.exists ===
        true
      ) {
        await queryRunner.query(`
          ALTER INDEX "IDX_tenants_is_active" 
          RENAME TO "IDX_nest_tenants_is_active"
        `);
      }

      // Rename primary key constraint (check if it exists first)
      const pkExists = (await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM pg_constraint 
          WHERE conname = 'PK_tenants'
          AND conrelid = 'public.nest_tenants'::regclass
        ) as exists
      `)) as Array<{ exists: boolean }>;

      if ((pkExists[0] as { exists: boolean } | undefined)?.exists === true) {
        await queryRunner.query(`
          ALTER TABLE "nest_tenants" 
          RENAME CONSTRAINT "PK_tenants" TO "PK_nest_tenants"
        `);
      }
    } else if (tenantsExists && nestTenantsExists) {
      // Both tables exist - this shouldn't happen, but we'll skip the rename
      console.warn(
        '[RenameTenantsToNestTenants] Both "tenants" and "nest_tenants" tables exist. Skipping rename.',
      );
    } else if (!tenantsExists && nestTenantsExists) {
      // "nest_tenants" already exists, no action needed
      console.log(
        '[RenameTenantsToNestTenants] "nest_tenants" table already exists. No action needed.',
      );
    } else {
      // Neither table exists - this shouldn't happen if migrations run in order
      console.warn(
        '[RenameTenantsToNestTenants] Neither "tenants" nor "nest_tenants" table exists. Skipping rename.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if "nest_tenants" table exists and "tenants" does not exist
    const nestTenantsExistsResult = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'nest_tenants'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const tenantsExistsResult = (await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
      ) as exists
    `)) as Array<{ exists: boolean }>;

    const nestTenantsExists =
      (nestTenantsExistsResult[0] as { exists: boolean } | undefined)
        ?.exists === true;
    const tenantsExists =
      (tenantsExistsResult[0] as { exists: boolean } | undefined)?.exists ===
      true;

    // Only rename back if "nest_tenants" exists and "tenants" does not exist
    if (nestTenantsExists && !tenantsExists) {
      // Rename primary key constraint back (check if it exists first)
      const pkExists = (await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM pg_constraint 
          WHERE conname = 'PK_nest_tenants'
          AND conrelid = 'public.nest_tenants'::regclass
        ) as exists
      `)) as Array<{ exists: boolean }>;

      if ((pkExists[0] as { exists: boolean } | undefined)?.exists === true) {
        await queryRunner.query(`
          ALTER TABLE "nest_tenants" 
          RENAME CONSTRAINT "PK_nest_tenants" TO "PK_tenants"
        `);
      }

      // Rename indexes back (check if they exist first)
      const isActiveIndexExists = (await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = 'IDX_nest_tenants_is_active'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      if (
        (isActiveIndexExists[0] as { exists: boolean } | undefined)?.exists ===
        true
      ) {
        await queryRunner.query(`
          ALTER INDEX "IDX_nest_tenants_is_active" 
          RENAME TO "IDX_tenants_is_active"
        `);
      }

      const nameIndexExists = (await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = 'IDX_nest_tenants_name_unique'
        ) as exists
      `)) as Array<{ exists: boolean }>;

      if (
        (nameIndexExists[0] as { exists: boolean } | undefined)?.exists === true
      ) {
        await queryRunner.query(`
          ALTER INDEX "IDX_nest_tenants_name_unique" 
          RENAME TO "IDX_tenants_name_unique"
        `);
      }

      // Rename the table back
      await queryRunner.query(`ALTER TABLE "nest_tenants" RENAME TO "tenants"`);
    }
  }
}
