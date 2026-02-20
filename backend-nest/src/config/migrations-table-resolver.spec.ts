/**
 * Migrations Table Resolver Unit Tests
 *
 * Tests for the migrations table name resolution logic to ensure
 * the correct table is selected based on configuration and database state.
 */

import { DataSource } from 'typeorm';
import {
  resolveMigrationsTableName,
  getMigrationsTableNameFromConfig,
  MigrationsTableResolution,
} from './migrations-table-resolver';

describe('MigrationsTableResolver', () => {
  describe('getMigrationsTableNameFromConfig', () => {
    it('should return configured table name when migrationsTableName is set', () => {
      const mockDataSource = {
        options: {
          migrationsTableName: 'typeorm_migrations',
        },
      } as unknown as DataSource;

      const result = getMigrationsTableNameFromConfig(mockDataSource);
      expect(result).toBe('typeorm_migrations');
    });

    it('should return default "migrations" when migrationsTableName is not set', () => {
      const mockDataSource = {
        options: {},
      } as unknown as DataSource;

      const result = getMigrationsTableNameFromConfig(mockDataSource);
      expect(result).toBe('migrations');
    });

    it('should return default "migrations" when migrationsTableName is empty string', () => {
      const mockDataSource = {
        options: {
          migrationsTableName: '',
        },
      } as unknown as DataSource;

      const result = getMigrationsTableNameFromConfig(mockDataSource);
      expect(result).toBe('migrations');
    });

    it('should return default "migrations" when migrationsTableName is null', () => {
      const mockDataSource = {
        options: {
          migrationsTableName: null,
        },
      } as unknown as DataSource;

      const result = getMigrationsTableNameFromConfig(mockDataSource);
      expect(result).toBe('migrations');
    });
  });

  describe('resolveMigrationsTableName', () => {
    describe('when migrationsTableName is configured', () => {
      it('should return configured table name with source "config"', async () => {
        const mockDataSource = {
          options: {
            migrationsTableName: 'custom_migrations',
          },
          query: jest.fn(),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result).toEqual<MigrationsTableResolution>({
          tableName: 'custom_migrations',
          source: 'config',
        });
        expect(mockDataSource.query).not.toHaveBeenCalled();
      });
    });

    describe('when migrationsTableName is not configured', () => {
      it('should prefer typeorm_migrations when both tables exist', async () => {
        const mockDataSource = {
          options: {},
          query: jest
            .fn()
            .mockImplementation((sql: string, params: string[]) => {
              const tableName = params[0];
              if (tableName === 'typeorm_migrations') {
                return Promise.resolve([{ exists: true }]);
              }
              if (tableName === 'migrations') {
                return Promise.resolve([{ exists: true }]);
              }
              return Promise.resolve([{ exists: false }]);
            }),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result).toEqual<MigrationsTableResolution>({
          tableName: 'typeorm_migrations',
          source: 'detected_typeorm_migrations',
        });
      });

      it('should use typeorm_migrations when only typeorm_migrations exists', async () => {
        const mockDataSource = {
          options: {},
          query: jest
            .fn()
            .mockImplementation((sql: string, params: string[]) => {
              const tableName = params[0];
              if (tableName === 'typeorm_migrations') {
                return Promise.resolve([{ exists: true }]);
              }
              return Promise.resolve([{ exists: false }]);
            }),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result).toEqual<MigrationsTableResolution>({
          tableName: 'typeorm_migrations',
          source: 'detected_typeorm_migrations',
        });
      });

      it('should use migrations when only migrations table exists', async () => {
        const mockDataSource = {
          options: {},
          query: jest
            .fn()
            .mockImplementation((sql: string, params: string[]) => {
              const tableName = params[0];
              if (tableName === 'migrations') {
                return Promise.resolve([{ exists: true }]);
              }
              return Promise.resolve([{ exists: false }]);
            }),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result).toEqual<MigrationsTableResolution>({
          tableName: 'migrations',
          source: 'detected_migrations',
        });
      });

      it('should return default with warning when neither table exists', async () => {
        const mockDataSource = {
          options: {},
          query: jest.fn().mockResolvedValue([{ exists: false }]),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result.tableName).toBe('migrations');
        expect(result.source).toBe('default');
        expect(result.warning).toBeDefined();
        expect(result.warning).toContain(
          'Neither typeorm_migrations nor migrations table exists',
        );
      });

      it('should handle query errors gracefully and return false for table existence', async () => {
        const mockDataSource = {
          options: {},
          query: jest.fn().mockRejectedValue(new Error('Connection error')),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result.tableName).toBe('migrations');
        expect(result.source).toBe('default');
        expect(result.warning).toBeDefined();
      });

      it('should handle empty query results', async () => {
        const mockDataSource = {
          options: {},
          query: jest.fn().mockResolvedValue([]),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result.tableName).toBe('migrations');
        expect(result.source).toBe('default');
      });

      it('should handle non-array query results', async () => {
        const mockDataSource = {
          options: {},
          query: jest.fn().mockResolvedValue(null),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result.tableName).toBe('migrations');
        expect(result.source).toBe('default');
      });
    });

    describe('staging mismatch scenario', () => {
      it('should correctly resolve to typeorm_migrations in staging scenario with both tables', async () => {
        const mockDataSource = {
          options: {},
          query: jest
            .fn()
            .mockImplementation((sql: string, params: string[]) => {
              const tableName = params[0];
              if (tableName === 'typeorm_migrations') {
                return Promise.resolve([{ exists: true }]);
              }
              if (tableName === 'migrations') {
                return Promise.resolve([{ exists: true }]);
              }
              return Promise.resolve([{ exists: false }]);
            }),
        } as unknown as DataSource;

        const result = await resolveMigrationsTableName(mockDataSource);

        expect(result.tableName).toBe('typeorm_migrations');
        expect(result.source).toBe('detected_typeorm_migrations');
        expect(result.warning).toBeUndefined();
      });
    });
  });
});
