import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { resolveMigrationsTableName } from '../config/migrations-table-resolver';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  details: Record<string, unknown>;
}

export interface DbHealthResult extends HealthCheckResult {
  details: {
    connected: boolean;
    migrationStatus: {
      pending: number;
      executed: number;
      lastMigration: string | null;
    };
    lastBackupTimestamp: string | null;
    responseTimeMs: number;
  };
}

export interface AuthHealthResult extends HealthCheckResult {
  details: {
    jwtConfigured: boolean;
    refreshTokenConfigured: boolean;
    requiredEnvVars: {
      name: string;
      configured: boolean;
    }[];
  };
}

export interface DotWalkingHealthResult extends HealthCheckResult {
  details: {
    resolverWorking: boolean;
    testPath: string;
    testResult: unknown;
    responseTimeMs: number;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async checkDatabase(): Promise<DbHealthResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      await this.dataSource.query('SELECT 1');
      const connected = true;
      const responseTimeMs = Date.now() - startTime;

      // Resolve the correct migrations table name
      const resolution = await resolveMigrationsTableName(this.dataSource);
      const migrationsTableName = resolution.tableName;

      const migrationsResult: unknown = await this.dataSource
        .query(`SELECT * FROM "${migrationsTableName}" ORDER BY timestamp DESC`)
        .catch(() => []);
      const migrations = (
        Array.isArray(migrationsResult) ? migrationsResult : []
      ) as { name: string }[];

      const pendingMigrations: boolean = await this.dataSource
        .showMigrations()
        .catch(() => false);

      const lastBackupTimestamp = this.getLastBackupTimestamp();

      return {
        status: 'healthy',
        timestamp,
        details: {
          connected,
          migrationStatus: {
            pending: pendingMigrations ? 1 : 0,
            executed: migrations.length,
            lastMigration: migrations[0]?.name || null,
          },
          lastBackupTimestamp,
          responseTimeMs,
        },
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp,
        details: {
          connected: false,
          migrationStatus: {
            pending: 0,
            executed: 0,
            lastMigration: null,
          },
          lastBackupTimestamp: null,
          responseTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  checkAuth(): AuthHealthResult {
    const timestamp = new Date().toISOString();

    // Check JWT configuration with safe access
    const jwtSecret = this.configService.get<string>('jwt.secret', '');
    const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn', '');
    const refreshTokenSecret =
      this.configService.get<string>('jwt.refreshSecret', '') || jwtSecret;

    const requiredEnvVars = [
      {
        name: 'JWT_SECRET',
        configured: !!jwtSecret,
      },
      {
        name: 'JWT_EXPIRES_IN',
        configured: !!jwtExpiresIn,
      },
      {
        name: 'REFRESH_TOKEN_SECRET',
        configured: !!refreshTokenSecret,
      },
      {
        name: 'REFRESH_TOKEN_EXPIRES_IN',
        configured: !!this.configService.get<string>(
          'jwt.refreshExpiresIn',
          '',
        ),
      },
    ];

    const jwtConfigured = !!jwtSecret;
    const refreshTokenConfigured = !!refreshTokenSecret;

    const allConfigured = requiredEnvVars.every((v) => v.configured);

    return {
      status: allConfigured
        ? 'healthy'
        : jwtConfigured
          ? 'degraded'
          : 'unhealthy',
      timestamp,
      details: {
        jwtConfigured,
        refreshTokenConfigured,
        requiredEnvVars,
      },
    };
  }

  checkDotWalking(): DotWalkingHealthResult {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const testPath = 'user.email';

    try {
      const testObject = {
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      const result = this.resolveDotPath(testObject, testPath);
      const responseTimeMs = Date.now() - startTime;

      return {
        status: result === 'test@example.com' ? 'healthy' : 'unhealthy',
        timestamp,
        details: {
          resolverWorking: result === 'test@example.com',
          testPath,
          testResult: result,
          responseTimeMs,
        },
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp,
        details: {
          resolverWorking: false,
          testPath,
          testResult: null,
          responseTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  async getOverallHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    checks: {
      db: DbHealthResult;
      auth: AuthHealthResult;
      dotWalking: DotWalkingHealthResult;
    };
  }> {
    const db = await this.checkDatabase();
    const auth = this.checkAuth();
    const dotWalking = this.checkDotWalking();

    const statuses = [db.status, auth.status, dotWalking.status];
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        db,
        auth,
        dotWalking,
      },
    };
  }

  private getLastBackupTimestamp(): string | null {
    const backupDir = path.join(process.cwd(), 'backups');

    try {
      if (!fs.existsSync(backupDir)) {
        return null;
      }

      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith('grc_backup_') && f.endsWith('.sql.gz'))
        .sort()
        .reverse();

      if (files.length === 0) {
        return null;
      }

      const latestFile = files[0];
      const stats = fs.statSync(path.join(backupDir, latestFile));
      return stats.mtime.toISOString();
    } catch {
      return null;
    }
  }

  private resolveDotPath(obj: Record<string, unknown>, path: string): unknown {
    if (!path || path.trim() === '') {
      return obj;
    }

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
