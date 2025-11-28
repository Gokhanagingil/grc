import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddMfaAndLockoutToUsers1730000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'auth.users',
      new TableColumn({
        name: 'mfa_enabled',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'auth.users',
      new TableColumn({
        name: 'mfa_secret',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'auth.users',
      new TableColumn({
        name: 'failed_attempts',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'auth.users',
      new TableColumn({
        name: 'locked_until',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'auth.users',
      new TableIndex({
        name: 'idx_users_locked_until',
        columnNames: ['locked_until'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('auth.users', 'idx_users_locked_until');
    await queryRunner.dropColumn('auth.users', 'locked_until');
    await queryRunner.dropColumn('auth.users', 'failed_attempts');
    await queryRunner.dropColumn('auth.users', 'mfa_secret');
    await queryRunner.dropColumn('auth.users', 'mfa_enabled');
  }
}
