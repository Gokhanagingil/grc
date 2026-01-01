import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateSystemSettingsTable
 *
 * Creates the nest_system_settings table for storing system-wide and tenant-specific settings.
 * This table supports both global settings (tenant_id = NULL) and tenant-specific settings.
 */
export class CreateSystemSettingsTable1730500000000 implements MigrationInterface {
  name = 'CreateSystemSettingsTable1730500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create nest_system_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nest_system_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NULL,
        key varchar(255) NOT NULL,
        value jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, key)
      )
    `);

    // Add index on tenant_id for efficient tenant-specific queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nest_system_settings_tenant_id" 
      ON nest_system_settings (tenant_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_system_settings_tenant_id"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS nest_system_settings
    `);
  }
}

