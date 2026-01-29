import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add List View Preferences Migration
 *
 * Adds default_sort, default_filter, and default_search columns to nest_list_views
 * to support saving complete list view preferences including filters and search.
 */
export class AddListViewPreferences1737800000000 implements MigrationInterface {
  name = 'AddListViewPreferences1737800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nest_list_views"
      ADD COLUMN IF NOT EXISTS "default_sort" varchar(100)
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views"
      ADD COLUMN IF NOT EXISTS "default_filter" text
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views"
      ADD COLUMN IF NOT EXISTS "default_search" varchar(200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nest_list_views"
      DROP COLUMN IF EXISTS "default_search"
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views"
      DROP COLUMN IF EXISTS "default_filter"
    `);

    await queryRunner.query(`
      ALTER TABLE "nest_list_views"
      DROP COLUMN IF EXISTS "default_sort"
    `);
  }
}
