import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateSystemSettingsTable
 *
 * Creates the nest_system_settings table for storing system-wide settings.
 * This table stores global system settings that apply to all tenants.
 */
export class CreateSystemSettingsTable1730500000000 implements MigrationInterface {
  name = 'CreateSystemSettingsTable1730500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension is available
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create nest_system_settings table
    // Matches SystemSetting entity exactly:
    // - id: uuid PRIMARY KEY (PrimaryGeneratedColumn)
    // - key: varchar(255) NOT NULL, UNIQUE (unique: true, @Index())
    // - value: text NOT NULL
    // - description: text NULL
    // - category: varchar(100) NULL
    // - createdAt: timestamptz NOT NULL DEFAULT now() (CreateDateColumn) - camelCase!
    // - updatedAt: timestamptz NOT NULL DEFAULT now() (UpdateDateColumn) - camelCase!
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS nest_system_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        key varchar(255) NOT NULL,
        value text NOT NULL,
        description text NULL,
        category varchar(100) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Defensive ALTER for existing installs - add columns that may be missing
    // Using exact column names as entity expects (camelCase for createdAt/updatedAt)
    await queryRunner.query(`
      ALTER TABLE "nest_system_settings" ADD COLUMN IF NOT EXISTS "description" text;
    `);
    await queryRunner.query(`
      ALTER TABLE "nest_system_settings" ADD COLUMN IF NOT EXISTS "category" varchar(100);
    `);
    await queryRunner.query(`
      ALTER TABLE "nest_system_settings" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now();
    `);
    await queryRunner.query(`
      ALTER TABLE "nest_system_settings" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();
    `);

    // Rename snake_case columns to camelCase if they exist (fix for existing DBs)
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Rename created_at to createdAt if it exists and createdAt doesn't
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = current_schema()
          AND table_name = 'nest_system_settings' 
          AND column_name = 'created_at'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = current_schema()
          AND table_name = 'nest_system_settings' 
          AND column_name = 'createdAt'
        ) THEN
          ALTER TABLE "nest_system_settings" RENAME COLUMN "created_at" TO "createdAt";
        END IF;

        -- Rename updated_at to updatedAt if it exists and updatedAt doesn't
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = current_schema()
          AND table_name = 'nest_system_settings' 
          AND column_name = 'updated_at'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = current_schema()
          AND table_name = 'nest_system_settings' 
          AND column_name = 'updatedAt'
        ) THEN
          ALTER TABLE "nest_system_settings" RENAME COLUMN "updated_at" TO "updatedAt";
        END IF;
      END $$;
    `);

    // Fix value column type if it exists as jsonb (should be text NOT NULL)
    // Cast jsonb to text using USING clause for safe conversion
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = current_schema()
          AND table_name = 'nest_system_settings' 
          AND column_name = 'value' 
          AND data_type = 'jsonb'
        ) THEN
          ALTER TABLE "nest_system_settings" ALTER COLUMN "value" TYPE text USING "value"::text;
          ALTER TABLE "nest_system_settings" ALTER COLUMN "value" SET NOT NULL;
        END IF;
      END $$;
    `);

    // Drop tenant_id index if it exists (not in entity) - must drop before column
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_system_settings_tenant_id"
    `);

    // Drop old unique constraint if it exists (tenant_id, key) - must drop before column
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        -- Find and drop unique constraint involving tenant_id and key
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'nest_system_settings'::regclass
        AND contype = 'u'
        AND conname LIKE '%tenant_id%key%';
        
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE nest_system_settings DROP CONSTRAINT IF EXISTS %I', constraint_name);
        END IF;
      END $$;
    `);

    // Remove tenant_id column if it exists (not in entity)
    await queryRunner.query(`
      ALTER TABLE "nest_system_settings" DROP COLUMN IF EXISTS "tenant_id";
    `);

    // Create unique index on key (matches @Index() and unique: true in entity)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_nest_system_settings_key" 
      ON nest_system_settings (key)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nest_system_settings_key"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS nest_system_settings
    `);
  }
}

