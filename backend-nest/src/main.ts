import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger';
import {
  runDatabaseDiagnostics,
  formatDiagnosticsForLogging,
} from './config/database-diagnostics';

/**
 * Bootstrap the NestJS application
 *
 * This NestJS backend runs alongside the existing Express backend:
 * - Express backend: port 3001
 * - NestJS backend: port 3002 (default)
 */
async function bootstrap() {
  // Create the application with structured logger
  const logger = new StructuredLoggerService();
  logger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger, // Use structured logger for NestJS internal logs
  });

  const configService = app.get(ConfigService);

  // Run database connection diagnostics AFTER TypeORM is initialized
  // This verifies that the app is connected to the correct database/schema
  // and that expected tables exist. This runs ONCE at startup.
  // In test environment, we print enhanced diagnostics to prove bootstrap and runtime
  // connect to the same DB/schema/search_path.
  try {
    const dataSource = app.get<DataSource>(getDataSourceToken());
    if (dataSource && dataSource.isInitialized) {
      const diagnostics = await runDatabaseDiagnostics(dataSource);
      const diagnosticsLog = formatDiagnosticsForLogging(diagnostics);
      logger.log('Database connection diagnostics', {
        diagnostics: diagnosticsLog,
        configSource: diagnostics.configSource,
        currentDatabase: diagnostics.currentDatabase,
        currentSchema: diagnostics.currentSchema,
        searchPath: diagnostics.searchPath,
        nestUsersExists: diagnostics.nestUsersExists,
        nestAuditLogsExists: diagnostics.nestAuditLogsExists,
      });

      // Log formatted diagnostics to console for visibility
      console.log('\n' + diagnosticsLog + '\n');

      // In test environment, print enhanced diagnostics to prove same DB/schema
      const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
      if (nodeEnv === 'test') {
        console.log(
          '[Runtime Diagnostics] ========================================',
        );
        console.log(
          '[Runtime Diagnostics] Test Environment Runtime Diagnostics',
        );
        console.log(
          '[Runtime Diagnostics] ========================================',
        );
        console.log(
          `[Runtime Diagnostics] Current Database: ${diagnostics.currentDatabase ?? 'UNKNOWN'}`,
        );
        console.log(
          `[Runtime Diagnostics] Current Schema: ${diagnostics.currentSchema ?? 'UNKNOWN'}`,
        );
        console.log(
          `[Runtime Diagnostics] Search Path: ${diagnostics.searchPath ?? 'UNKNOWN'}`,
        );

        // Check critical GRC tables using to_regclass (runtime drift check)
        // This ensures the app doesn't start with missing tables in test environment
        try {
          const driftCheckResult = await dataSource.manager.query<
            Array<{
              db: string;
              schema: string;
              grc_requirements: string | null;
              grc_policies: string | null;
              grc_risks: string | null;
            }>
          >(`
            SELECT
              current_database() as db,
              current_schema() as schema,
              to_regclass('public.grc_requirements')::text as grc_requirements,
              to_regclass('public.grc_policies')::text as grc_policies,
              to_regclass('public.grc_risks')::text as grc_risks
          `);

          const result = driftCheckResult[0];
          console.log(
            '[Runtime Diagnostics] Runtime drift check (to_regclass):',
          );
          console.log(`[Runtime Diagnostics]   Database: ${result?.db}`);
          console.log(`[Runtime Diagnostics]   Schema: ${result?.schema}`);
          console.log(
            `[Runtime Diagnostics]   grc_requirements: ${result?.grc_requirements ?? 'NULL'}`,
          );
          console.log(
            `[Runtime Diagnostics]   grc_policies: ${result?.grc_policies ?? 'NULL'}`,
          );
          console.log(
            `[Runtime Diagnostics]   grc_risks: ${result?.grc_risks ?? 'NULL'}`,
          );

          // HARD FAIL in test environment if any critical GRC table is missing (NULL)
          if (
            !result?.grc_requirements ||
            !result?.grc_policies ||
            !result?.grc_risks
          ) {
            const missingTables: string[] = [];
            if (!result?.grc_requirements)
              missingTables.push('grc_requirements');
            if (!result?.grc_policies) missingTables.push('grc_policies');
            if (!result?.grc_risks) missingTables.push('grc_risks');

            const errorMsg =
              `FATAL: Critical GRC tables missing in test environment!\n` +
              `Missing tables: ${missingTables.join(', ')}\n` +
              `Database: ${result?.db}\n` +
              `Schema: ${result?.schema}\n` +
              `This indicates the database was not properly migrated before tests started.\n` +
              `Ensure db:test:bootstrap ran successfully before starting the test app.`;

            console.error(
              '[Runtime Diagnostics] ========================================',
            );
            console.error('[Runtime Diagnostics] FATAL ERROR');
            console.error(
              '[Runtime Diagnostics] ========================================',
            );
            console.error(errorMsg);
            console.error(
              '[Runtime Diagnostics] ========================================',
            );

            throw new Error(errorMsg);
          }

          console.log(
            '[Runtime Diagnostics] ✓ All critical GRC tables exist (NOT NULL)',
          );
        } catch (error) {
          // Re-throw if it's our intentional error, otherwise log warning
          if (error instanceof Error && error.message.includes('FATAL:')) {
            throw error;
          }
          console.warn(
            '[Runtime Diagnostics] Could not check critical tables:',
            error instanceof Error ? error.message : String(error),
          );
        }

        console.log(
          '[Runtime Diagnostics] ========================================',
        );
        console.log('');
      }

      // Warn if critical tables are missing (but don't fail startup - let the app try)
      if (!diagnostics.nestUsersExists || !diagnostics.nestAuditLogsExists) {
        logger.warn(
          'Expected tables missing in database. This may cause runtime errors.',
          {
            configSource: diagnostics.configSource,
            nestUsersExists: diagnostics.nestUsersExists,
            nestAuditLogsExists: diagnostics.nestAuditLogsExists,
            currentDatabase: diagnostics.currentDatabase,
            currentSchema: diagnostics.currentSchema,
          },
        );
      }
    }
  } catch (error) {
    // If we can't get the DataSource or run diagnostics, log but continue
    logger.warn('Failed to run database diagnostics', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const corsOrigins = configService.get<string>(
    'cors.origins',
    'http://localhost:3000,http://localhost:3001,http://localhost:3002',
  );
  app.enableCors({
    origin: corsOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  // Get port from config (default 3002 to avoid conflict with Express on 3001)
  const port = configService.get<number>('app.port', 3002);

  await app.listen(port);

  // Log startup information using structured logger
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

  // Log migration mode (for TypeORM migrations)
  const migrationMode =
    process.env.TYPEORM_MIGRATIONS_MODE === 'dist' ||
    process.env.TYPEORM_MIGRATIONS_MODE === 'src'
      ? process.env.TYPEORM_MIGRATIONS_MODE
      : 'auto-detect';

  logger.log('Application started', {
    environment: nodeEnv,
    port,
    migrationMode,
    healthCheck: `http://localhost:${port}/health/live`,
    metrics: `http://localhost:${port}/metrics`,
    apiDocs: `http://localhost:${port}/`,
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
