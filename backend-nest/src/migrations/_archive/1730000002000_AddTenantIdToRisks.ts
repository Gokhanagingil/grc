import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddTenantIdToRisks1730000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tenant_id column if it doesn't exist
    const table = await queryRunner.getTable('risks');
    if (!table || !table.findColumnByName('tenant_id')) {
      await queryRunner.addColumn(
        'risks',
        new TableColumn({
          name: 'tenant_id',
          type: 'uuid',
          isNullable: false,
        }),
      );

      // Create index
      await queryRunner.createIndex(
        'risks',
        new TableIndex({
          name: 'idx_risks_tenant_id',
          columnNames: ['tenant_id'],
        }),
      );

      // Set default tenant for existing records (using default tenant ID from env or seed)
      const defaultTenantId = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
      await queryRunner.query(`
        UPDATE risks 
        SET tenant_id = '${defaultTenantId}' 
        WHERE tenant_id IS NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('risks', 'idx_risks_tenant_id');
    await queryRunner.dropColumn('risks', 'tenant_id');
  }
}
