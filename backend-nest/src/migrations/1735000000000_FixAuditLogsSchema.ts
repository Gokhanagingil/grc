import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration to fix audit_logs table schema for SQLite compatibility.
 * 
 * This migration:
 * 1. Drops the existing audit_logs table (if it exists)
 * 2. Recreates it with the correct schema matching AuditLogEntity
 * 
 * Note: This is safe for dev environments where audit logs are not critical.
 * In production, you should back up the table before running this migration.
 */
export class FixAuditLogsSchema1735000000000 implements MigrationInterface {
  name = 'FixAuditLogsSchema1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if we're using SQLite
    const isSQLite = queryRunner.connection.options.type === 'sqlite';

    if (isSQLite) {
      // For SQLite, we need to drop and recreate the table
      // SQLite doesn't support ALTER TABLE for changing column types easily
      const tableExists = await queryRunner.hasTable('audit_logs');

      if (tableExists) {
        // Drop the existing table
        await queryRunner.dropTable('audit_logs');
      }

      // Recreate the table with correct schema
      await queryRunner.createTable(
        new Table({
          name: 'audit_logs',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36', // UUID length
              isPrimary: true,
              isNullable: false,
            },
            {
              name: 'tenant_id',
              type: 'varchar',
              length: '36', // UUID length
              isNullable: true,
            },
            {
              name: 'user_id',
              type: 'varchar',
              length: '36', // UUID length
              isNullable: true,
            },
            {
              name: 'entity_schema',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'entity_table',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'entity_id',
              type: 'varchar',
              length: '36', // UUID length
              isNullable: true,
            },
            {
              name: 'action',
              type: 'text',
              isNullable: false,
            },
            {
              name: 'diff',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              isNullable: false,
              default: "CURRENT_TIMESTAMP",
            },
          ],
        }),
        true, // If not exists
      );
    } else {
      // For PostgreSQL, ensure the schema exists and table is correct
      // PostgreSQL migration was already handled in bootstrap_db.ts
      // This is a no-op for PostgreSQL
      const tableExists = await queryRunner.hasTable('audit_logs');
      if (!tableExists) {
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS audit.audit_logs (
            id UUID PRIMARY KEY,
            tenant_id UUID,
            user_id UUID,
            entity_schema TEXT NOT NULL,
            entity_table TEXT NOT NULL,
            entity_id UUID,
            action TEXT NOT NULL,
            diff JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table if it exists
    const tableExists = await queryRunner.hasTable('audit_logs');
    if (tableExists) {
      await queryRunner.dropTable('audit_logs');
    }
  }
}

