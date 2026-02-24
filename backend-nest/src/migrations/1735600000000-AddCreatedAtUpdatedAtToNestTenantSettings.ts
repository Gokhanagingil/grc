import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddCreatedAtUpdatedAtToNestTenantSettings
 *
 * Adds createdAt and updatedAt columns to nest_tenant_settings table.
 * These columns are required by the TenantSetting entity which uses
 * @CreateDateColumn() and @UpdateDateColumn() decorators.
 *
 * Column names are in camelCase to match the entity property names
 * as expected by the schema contract validation.
 *
 * This migration runs after CreateMissingSchemaContractTables (1735500000000)
 * to fix the missing columns issue.
 */
export class AddCreatedAtUpdatedAtToNestTenantSettings1735600000000 implements MigrationInterface {
  name = 'AddCreatedAtUpdatedAtToNestTenantSettings1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add createdAt column (camelCase to match entity property name)
    await queryRunner.query(`
      ALTER TABLE "nest_tenant_settings" 
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    `);

    // Add updatedAt column (camelCase to match entity property name)
    await queryRunner.query(`
      ALTER TABLE "nest_tenant_settings" 
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop updatedAt column
    await queryRunner.query(`
      ALTER TABLE "nest_tenant_settings" 
      DROP COLUMN IF EXISTS "updatedAt"
    `);

    // Drop createdAt column
    await queryRunner.query(`
      ALTER TABLE "nest_tenant_settings" 
      DROP COLUMN IF EXISTS "createdAt"
    `);
  }
}
