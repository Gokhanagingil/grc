import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add Control relationships:
 * - control_to_policy: Many-to-many relationship between controls and policies
 * - control_to_cap: Many-to-many relationship between controls and corrective actions
 * 
 * This migration enables:
 * - Linking controls to policies (N:N)
 * - Linking controls to CAPs (N:N)
 * 
 * These relationships are required for the demo experience to show
 * complete GRC relationships across all modules.
 */
export class AddControlRelationships1740000000000 implements MigrationInterface {
  name = 'AddControlRelationships1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    const uuidType = isPostgres ? 'UUID' : 'TEXT';
    const timestampType = isPostgres ? 'TIMESTAMPTZ NOT NULL DEFAULT now()' : 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP';

    // Helper function to check if table exists
    const tableExists = async (table: string): Promise<boolean> => {
      const tableName = table.includes('.') ? table.split('.')[1] : table;
      const schema = table.includes('.') ? table.split('.')[0] : (isPostgres ? 'public' : null);
      
      if (isPostgres) {
        const result = await queryRunner.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = $2
          ) as exists;
        `, [schema || 'public', tableName]);
        return result[0]?.exists || false;
      } else {
        const tables = await queryRunner.query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
          [tableName]
        );
        return tables.length > 0;
      }
    };

    // 1. Create control_to_policy join table
    const controlToPolicyTable = `${tablePrefix}control_to_policy`;
    const controlToPolicyExists = await tableExists(controlToPolicyTable);
    
    if (!controlToPolicyExists) {
      const controlToPolicySql = isPostgres
        ? `
        CREATE TABLE ${controlToPolicyTable} (
          control_id ${uuidType} NOT NULL,
          policy_id ${uuidType} NOT NULL,
          tenant_id ${uuidType} NOT NULL,
          created_at ${timestampType},
          updated_at ${timestampType},
          PRIMARY KEY (control_id, policy_id, tenant_id),
          CONSTRAINT fk_control_to_policy_control 
            FOREIGN KEY (control_id) REFERENCES ${tablePrefix}control_library(id) ON DELETE CASCADE,
          CONSTRAINT fk_control_to_policy_policy 
            FOREIGN KEY (policy_id) REFERENCES ${tablePrefix}policies(id) ON DELETE CASCADE
        );
      `
        : `
        CREATE TABLE control_to_policy (
          control_id ${uuidType} NOT NULL,
          policy_id ${uuidType} NOT NULL,
          tenant_id ${uuidType} NOT NULL,
          created_at ${timestampType},
          updated_at ${timestampType},
          PRIMARY KEY (control_id, policy_id, tenant_id)
        );
      `;
      
      await queryRunner.query(controlToPolicySql);
      console.log('✅ Created control_to_policy table');

      // Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_control_to_policy_tenant 
        ON ${controlToPolicyTable}(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_control_to_policy_control 
        ON ${controlToPolicyTable}(control_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_control_to_policy_policy 
        ON ${controlToPolicyTable}(policy_id);
      `);
      console.log('✅ Created indexes for control_to_policy');
    } else {
      console.log('⚠️  control_to_policy table already exists, skipping');
    }

    // 2. Create control_to_cap join table
    const controlToCapTable = `${tablePrefix}control_to_cap`;
    const controlToCapExists = await tableExists(controlToCapTable);
    
    if (!controlToCapExists) {
      const controlToCapSql = isPostgres
        ? `
        CREATE TABLE ${controlToCapTable} (
          control_id ${uuidType} NOT NULL,
          cap_id ${uuidType} NOT NULL,
          tenant_id ${uuidType} NOT NULL,
          created_at ${timestampType},
          updated_at ${timestampType},
          PRIMARY KEY (control_id, cap_id, tenant_id),
          CONSTRAINT fk_control_to_cap_control 
            FOREIGN KEY (control_id) REFERENCES ${tablePrefix}control_library(id) ON DELETE CASCADE,
          CONSTRAINT fk_control_to_cap_cap 
            FOREIGN KEY (cap_id) REFERENCES ${tablePrefix}corrective_actions(id) ON DELETE CASCADE
        );
      `
        : `
        CREATE TABLE control_to_cap (
          control_id ${uuidType} NOT NULL,
          cap_id ${uuidType} NOT NULL,
          tenant_id ${uuidType} NOT NULL,
          created_at ${timestampType},
          updated_at ${timestampType},
          PRIMARY KEY (control_id, cap_id, tenant_id)
        );
      `;
      
      await queryRunner.query(controlToCapSql);
      console.log('✅ Created control_to_cap table');

      // Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_control_to_cap_tenant 
        ON ${controlToCapTable}(tenant_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_control_to_cap_control 
        ON ${controlToCapTable}(control_id);
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_control_to_cap_cap 
        ON ${controlToCapTable}(cap_id);
      `);
      console.log('✅ Created indexes for control_to_cap');
    } else {
      console.log('⚠️  control_to_cap table already exists, skipping');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.driver.options.type;
    const isPostgres = driver === 'postgres';
    const tablePrefix = isPostgres ? 'public.' : '';

    // Drop indexes first
    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_to_cap_cap;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_to_cap_control;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_to_cap_tenant;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_to_policy_policy;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_to_policy_control;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_control_to_policy_tenant;`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}control_to_cap;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}control_to_policy;`);
    
    console.log('✅ Dropped control relationship tables');
  }
}

