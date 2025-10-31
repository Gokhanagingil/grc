import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CreateRefreshTokens1730000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        schema: 'auth',
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'jti',
            type: 'uuid',
            isUnique: true,
            isNullable: false,
            default: 'gen_random_uuid()',
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'revoked',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'auth.refresh_tokens',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedSchema: 'auth',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'auth.refresh_tokens',
      new TableIndex({ name: 'idx_refresh_tokens_user_id', columnNames: ['user_id'] }),
    );

    await queryRunner.createIndex(
      'auth.refresh_tokens',
      new TableIndex({ name: 'idx_refresh_tokens_expires_at', columnNames: ['expires_at'] }),
    );

    await queryRunner.createIndex(
      'auth.refresh_tokens',
      new TableIndex({ name: 'idx_refresh_tokens_jti', columnNames: ['jti'], isUnique: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('auth.refresh_tokens', true);
  }
}

