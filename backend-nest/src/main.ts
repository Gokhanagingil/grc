import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  ValidationPipe,
  VersioningType,
  BadRequestException,
  Logger,
  RequestMethod,
} from '@nestjs/common';
import { NormalizationPipe } from './common/pipes/normalization/normalization.pipe';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ThrottleExceptionFilter } from './common/filters/throttle-exception.filter';
import { DataSource } from 'typeorm';

// Crash logger - write to crash.log
import * as fs from 'fs';
import * as path from 'path';

const crashLogPath = path.join(process.cwd(), 'crash.log');
const diagDirPath = path.join(process.cwd(), '.diag');
if (!fs.existsSync(diagDirPath)) {
  fs.mkdirSync(diagDirPath, { recursive: true });
}
const crashDiagPath = path.join(diagDirPath, 'crash.log');
const bootLogPath = path.join(diagDirPath, 'boot.log');

function writeCrashLog(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  if (error) {
    const stack = error.stack || error.toString();
    const payload = logEntry + stack + '\n\n';
    fs.appendFileSync(crashLogPath, payload);
    fs.appendFileSync(crashDiagPath, payload);
  } else {
    fs.appendFileSync(crashLogPath, logEntry);
    fs.appendFileSync(crashDiagPath, logEntry);
  }
}

function recordBoot(message: string, error?: any) {
  writeCrashLog(message, error);
  const logEntry = `[${new Date().toISOString()}] ${message}${error ? ` ${error}` : ''}\n`;
  fs.appendFileSync(bootLogPath, logEntry);
}

// Express route dumper for debugging
function dumpExpressRoutes(app: any) {
  try {
    // Try to get routes from NestJS router
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance();
    
    // NestJS uses Express/Fastify under the hood
    // Try to access the router stack
    const router = (instance as any)?._router || (instance as any)?._events?.request?._router;
    
    if (!router?.stack) {
      console.log('[ROUTES] no router stack found');
      console.log('[ROUTES] trying alternative method...');
      
      // Alternative: Try to get routes from NestJS internal router
      const routes = (app as any).getRoutes?.() || [];
      if (routes.length > 0) {
        console.log('[ROUTES] found', routes.length, 'routes via getRoutes()');
        routes
          .filter((r: any) => r.path?.includes('auth') || r.path?.includes('health'))
          .forEach((r: any) => {
            console.log('[ROUTE]', r.method?.toUpperCase() || '?', r.path || '?');
          });
      } else {
        console.log('[ROUTES] Note: Routes are mapped by NestJS RouterExplorer (see logs above)');
        console.log('[ROUTES] Expected paths:');
        console.log('[ROUTE] GET /api/v2/auth/ping');
        console.log('[ROUTE] POST /api/v2/auth/login');
        console.log('[ROUTE] GET /api/v2/health');
      }
      return;
    }

    const list: string[] = [];

    for (const layer of router.stack) {
      if (layer.route && layer.route.path) {
        const path = layer.route.path;
        const methods = Object.keys(layer.route.methods || {}).filter(
          (m) => layer.route.methods[m],
        );
        list.push(...methods.map((m) => `${m.toUpperCase()} ${path}`));
      } else if (layer.name === 'router' && layer.handle?.stack) {
        for (const sl of layer.handle.stack) {
          if (sl.route && sl.route.path) {
            const subPath = sl.route.path;
            const methods = Object.keys(sl.route.methods || {}).filter(
              (m) => sl.route.methods[m],
            );
            list.push(...methods.map((m) => `${m.toUpperCase()} ${subPath}`));
          }
        }
      }
    }

    const interesting = list.filter(
      (x) => x.includes('auth') || x.includes('health'),
    );

    console.log('[ROUTES] mapped count =', list.length);
    interesting.forEach((x) => console.log('[ROUTE]', x));
  } catch (e: any) {
    console.log('[ROUTES] dump failed:', e?.message || e);
  }
}

// Global error handlers with crash logging (non-fatal for diagnostics)
const safeCrashExit = process.env.SAFE_CRASH_EXIT === 'true';

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  const errorDetails = {
    name: error.name || 'UnhandledRejection',
    message: error.message || String(reason),
    stack: error.stack || 'No stack trace',
    promise: String(promise),
  };
  
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.stderr.write(`\n❌ UNHANDLED REJECTION\n`);
  process.stderr.write(`Name: ${errorDetails.name}\n`);
  process.stderr.write(`Message: ${errorDetails.message}\n`);
  process.stderr.write(`Stack:\n${errorDetails.stack}\n`);
  process.stderr.write(`Promise: ${errorDetails.promise}\n\n`);
  
  writeCrashLog('UNHANDLED_REJECTION', error);
  writeCrashLog(`UNHANDLED_REJECTION_DETAILS: ${JSON.stringify(errorDetails, null, 2)}`, null);
  
  if (safeCrashExit) {
    console.error('⚠️  SAFE_CRASH_EXIT=true, exiting...');
    process.exit(1);
  } else {
    console.error('⚠️  Non-fatal mode: continuing for diagnostics...');
  }
});

process.on('uncaughtException', (error: Error) => {
  const errorDetails = {
    name: error.name || 'UncaughtException',
    message: error.message || String(error),
    stack: error.stack || 'No stack trace',
  };
  
  console.error('❌ Uncaught Exception:', error);
  process.stderr.write(`\n❌ UNCAUGHT EXCEPTION\n`);
  process.stderr.write(`Name: ${errorDetails.name}\n`);
  process.stderr.write(`Message: ${errorDetails.message}\n`);
  process.stderr.write(`Stack:\n${errorDetails.stack}\n\n`);
  
  writeCrashLog('UNCAUGHT_EXCEPTION', error);
  writeCrashLog(`UNCAUGHT_EXCEPTION_DETAILS: ${JSON.stringify(errorDetails, null, 2)}`, null);
  
  if (safeCrashExit) {
    console.error('⚠️  SAFE_CRASH_EXIT=true, exiting...');
    process.exit(1);
  } else {
    console.error('⚠️  Non-fatal mode: continuing for diagnostics...');
  }
});

async function bootstrap() {
  try {
    // Logger level based on LOG_LEVEL env var
    const logLevel = process.env.LOG_LEVEL || 'log';
    const loggerLevels: Array<'log' | 'error' | 'warn' | 'verbose' | 'debug'> = [
      'error',
      'warn',
      'log',
    ];
    if (logLevel === 'verbose' || logLevel === 'debug') {
      loggerLevels.push('debug', 'verbose');
    }

    console.log('[BOOT] Creating NestFactory with AppModule...');
    process.stderr.write('[BOOT] Creating NestFactory with AppModule...\n');
    
    let app;
    try {
      app = await NestFactory.create(AppModule, {
        logger: loggerLevels,
        bufferLogs: true,
        abortOnError: false, // Don't abort on initialization errors
      });
      console.log('[BOOT] NestFactory.create() succeeded');
      process.stderr.write('[BOOT] NestFactory.create() succeeded\n');
    } catch (createError: any) {
      const errorDetails = {
        name: createError?.name || 'Unknown',
        message: createError?.message || String(createError),
        stack: createError?.stack || 'No stack trace',
        cause: createError?.cause || null,
      };
      
      console.error('❌ [BOOT] NestFactory.create() failed:');
      process.stderr.write(`\n❌ NESTFACTORY.CREATE FAILED\n`);
      process.stderr.write(`Name: ${errorDetails.name}\n`);
      process.stderr.write(`Message: ${errorDetails.message}\n`);
      process.stderr.write(`Stack:\n${errorDetails.stack}\n\n`);
      
      if (createError?.stack) {
        console.error('Stack:', createError.stack);
      }
      writeCrashLog('NESTFACTORY_CREATE_ERROR', createError);
      writeCrashLog(`NESTFACTORY_CREATE_ERROR_DETAILS: ${JSON.stringify(errorDetails, null, 2)}`, null);
      throw createError;
    }

    const cfg = app.get(ConfigService);
    const port = cfg.get<number>('APP_PORT') ?? cfg.get<number>('PORT') ?? 5002;
    const host = cfg.get<string>('HOST') ?? '0.0.0.0';
    const corsOrigins = cfg.get<string>('CORS_ORIGINS') ?? '';
    const swaggerEnabled = cfg.get<string>('SWAGGER_ENABLED') !== 'false';
    const logHttpRequests = cfg.get<string>('LOG_HTTP_REQUESTS') === 'true';

    const prefixFromEnv = cfg.get<string>('API_PREFIX');
    const versionFromEnv = cfg.get<string>('API_VERSION');
    const defaultPrefix = 'api';
    let globalPrefix = defaultPrefix;
    let defaultVersion = (versionFromEnv ?? 'v2').replace(/^v/i, '') || '2';

    if (prefixFromEnv) {
      const normalizedPrefix = prefixFromEnv.trim().replace(/^\/+/g, '');
      if (normalizedPrefix.length > 0) {
        const segments = normalizedPrefix.split('/').filter(Boolean);
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1] ?? '';
          if (lastSegment && /^v\d+$/i.test(lastSegment)) {
            defaultVersion = lastSegment.replace(/^v/i, '') || defaultVersion;
            segments.pop();
          }
          if (segments.length > 0) {
            globalPrefix = segments.join('/');
          }
        }
      }
    }

    const versionSegment = `v${defaultVersion}`;

    // ============================================
    // STEP 1: Versioning & Global Prefix (BEFORE init)
    // ============================================
    // Enable URI versioning BEFORE init - this adds /v2 to all routes
    // Exclude 'health' path from versioning so /health works at root
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion,
      // Note: NestJS doesn't support path-based exclusion in enableVersioning
      // RootHealthController uses @Version('1') to differentiate, but still gets /v1 prefix
      // Alternative: use middleware or separate route handler
    });

    // Set global prefix as 'api' (no leading slash) BEFORE init
    // ✨ Exclude health endpoint and Swagger docs from prefix for ALL HTTP methods (GET, HEAD, OPTIONS, etc.)
    // Some environments trigger HEAD/OPTIONS requests that cause 404s if only GET is excluded
    app.setGlobalPrefix(globalPrefix, {
      exclude: [
        { path: 'health', method: RequestMethod.ALL },
        { path: 'api-docs', method: RequestMethod.ALL },
        { path: 'api-docs-json', method: RequestMethod.ALL },
      ],
    });

    // ============================================
    // STEP 2: Middleware, Pipes, Filters (BEFORE init)
    // ============================================
    // Helmet security headers
    app.use(helmet());

    // Trust proxy (for production behind reverse proxy)
    // Get Express instance early so we can use it for health handlers before app.init()
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', true);

    // HTTP request logging (feature flag controlled)
    if (logHttpRequests) {
      app.use((req: any, _res: any, next: any) => {
        console.log('[REQ]', req.method, req.url);
        next();
      });
    }

    // CORS - Allow frontend origin
    // Default origins include localhost and remote demo IP (192.168.31.28)
    const allowedOrigins = corsOrigins
      ? corsOrigins
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [
          'http://localhost:3000', // React dev server
          'http://localhost:1907', // Frontend demo (serve)
          'http://127.0.0.1:3000',
          'http://127.0.0.1:1907',
          'http://192.168.31.28:1907', // Remote demo access
        ];
    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      exposedHeaders: ['Authorization'],
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    });

    console.log(`?? CORS enabled for origins: ${allowedOrigins.join(', ')}`);
    console.log(`?? Global prefix: /${globalPrefix}, Version: ${defaultVersion} -> Final: /${globalPrefix}/${versionSegment}`);
    if (logHttpRequests) {
      console.log(`📝 HTTP request logging enabled`);
    }

    // Global exception filter for rate limiting
    app.useGlobalFilters(new ThrottleExceptionFilter());

    // Global normalization pipe - runs BEFORE ValidationPipe
    // This normalizes empty strings, UUIDs, arrays, booleans, dates, and nested objects
    app.useGlobalPipes(new NormalizationPipe());

    // Global validation with enhanced settings for query parameter flexibility
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidUnknownValues: false,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true, // Auto-convert string numbers to numbers
        },
        skipMissingProperties: true, // Skip validation for undefined/null properties
        exceptionFactory: (errors) => {
          const formattedErrors = errors.map((error) => {
            const messages = Object.values(error.constraints || {});
            return {
              field: error.property,
              messages,
            };
          });
          // Return BadRequestException with array of errors for frontend to display
          return new BadRequestException({
            message: 'Validation failed',
            errors: formattedErrors,
          });
        },
      }),
    );

    // ============================================
    // STEP 2.5: Register raw Express health handlers BEFORE app.init()
    // ============================================
    // Register raw Express handlers for health endpoints BEFORE NestJS routing initializes
    // This ensures health endpoints are available even if NestJS routing has issues
    // Express route registration order matters - routes registered first take precedence
    const safeMode = process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1';
    // expressApp already declared above (trust proxy setup)

    // Helper function to register health route (GET and HEAD)
    const registerHealthRoute = (path: string) => {
      expressApp.get(path, (_req: any, res: any) => {
        let dbStatus: 'disabled' | 'ok' | 'down' = safeMode ? 'disabled' : 'down';
        if (!safeMode) {
          try {
            const dataSource = app.get(DataSource, { strict: false });
            if (dataSource && dataSource.isInitialized) {
              dbStatus = 'ok';
            }
          } catch {
            dbStatus = 'down';
          }
        }
        res.status(200).json({
          status: 'ok',
          time: new Date().toISOString(),
          deps: {
            db: dbStatus,
            redis: 'disabled',
          },
        });
      });
      expressApp.head(path, (_req: any, res: any) => {
        res.sendStatus(200);
      });
    };

    // Register health routes: /health and /api/v2/health (primary)
    // Register BEFORE app.init() so they take precedence over NestJS routing
    registerHealthRoute('/health');
    registerHealthRoute(`/${globalPrefix}/${versionSegment}/health`);
    // Optional: Also register /v2/health for convenience
    registerHealthRoute(`/${versionSegment}/health`);

    const registeredPaths = [
      '/health',
      `/${globalPrefix}/${versionSegment}/health`,
      `/${versionSegment}/health`,
    ];
    console.log(
      `[BOOT] Raw health handlers registered BEFORE app.init(): ${registeredPaths.join(', ')}`,
    );

    // ============================================
    // STEP 3: Initialize app (triggers module initialization)
    // ============================================
    console.log('[BOOT] checkpoint: before app.init()');
    console.error('[BOOT] checkpoint: before app.init()'); // Force to stderr
    process.stderr.write('[BOOT] checkpoint: before app.init()\n');
    recordBoot('[BOOT] checkpoint: before app.init()');
    try {
      console.log('[BOOT] Starting app.init()...');
      process.stderr.write('[BOOT] Starting app.init()...\n');
      await app.init();
      console.log('[BOOT] checkpoint: after app.init()');
      console.error('[BOOT] checkpoint: after app.init()'); // Force to stderr
      recordBoot('[BOOT] checkpoint: after app.init()');
      console.log('[BOOT] app.init complete');
    } catch (e: any) {
      const errorDetails = {
        name: e?.name || 'Unknown',
        message: e?.message || String(e),
        stack: e?.stack || 'No stack trace',
        cause: e?.cause || null,
        toString: String(e),
      };
      
      console.error('❌ [BOOT] app.init() failed with error:');
      console.error('   Error name:', errorDetails.name);
      console.error('   Error message:', errorDetails.message);
      console.error('   Stack trace:');
      console.error(errorDetails.stack);
      if (errorDetails.cause) {
        console.error('   Cause:', errorDetails.cause);
      }
      
      // Also write to stderr explicitly
      process.stderr.write(`\n❌ [BOOT] app.init() FAILED\n`);
      process.stderr.write(`Name: ${errorDetails.name}\n`);
      process.stderr.write(`Message: ${errorDetails.message}\n`);
      process.stderr.write(`Stack:\n${errorDetails.stack}\n\n`);
      
      // Enhanced crash log
      recordBoot('[BOOT] app.init() threw', e);
      writeCrashLog('APP_INIT_ERROR', e);
      writeCrashLog(`APP_INIT_ERROR_DETAILS: ${JSON.stringify(errorDetails, null, 2)}`, null);
      
      throw e;
    }

    // ============================================
    // STEP 4: Swagger (after init, before listen)
    // ============================================
    // Prometheus metrics handled by MetricsModule and MetricsInterceptor
    // Endpoint: /api/v2/metrics (via MetricsController)
    const metricsEnabled = cfg.get<string>('METRICS_ENABLED') === 'true';
    if (metricsEnabled) {
      console.log(`✅ Metrics enabled: /api/v2/metrics`);
    }

    // Swagger (skip in SAFE_MODE)
    if (swaggerEnabled && !safeMode) {
      try {
        const apiBaseUrl = `/${globalPrefix}/${versionSegment}`;
        const config = new DocumentBuilder()
          .setTitle('GRC Platform API')
          .setDescription(
            'GRC backend (Policy CRUD, Postgres, Swagger, Event Engine)',
          )
          .setVersion('0.1.0')
          .setBasePath(apiBaseUrl)
          .addServer(`http://${host}:${port}${apiBaseUrl}`, 'Development server')
          .addBearerAuth()
          .addApiKey(
            {
              type: 'apiKey',
              name: 'x-tenant-id',
              in: 'header',
              description: 'Tenant context id (required)',
            },
            'x-tenant-id',
          )
          .addApiKey(
            {
              type: 'apiKey',
              name: 'x-ingest-token',
              in: 'header',
              description: 'Ingest token for event ingestion',
            },
            'x-ingest-token',
          )
          .build();
        const document = SwaggerModule.createDocument(app, config);
        // Setup Swagger at root level (not affected by global prefix)
        // This ensures /api-docs is accessible regardless of API_PREFIX
        SwaggerModule.setup('api-docs', app, document, {
          swaggerOptions: {
            persistAuthorization: true,
            docExpansion: 'none',
            filter: true,
            showRequestDuration: true,
          },
          customSiteTitle: 'GRC Platform API',
          customCss: '.swagger-ui .topbar { display: none }',
        });
        
        // Add JSON endpoint for contract testing (also exclude from global prefix)
        app.getHttpAdapter().get('api-docs-json', (req: any, res: any) => {
          res.setHeader('Content-Type', 'application/json');
          res.send(JSON.stringify(document, null, 2));
        });
        
        console.log(`📖 Swagger UI available at http://${host}:${port}/api-docs`);
        console.log(`📖 Swagger JSON available at http://${host}:${port}/api-docs-json`);
      } catch (swaggerError: any) {
        console.error('❌ Swagger setup failed:', swaggerError?.message || swaggerError);
        console.error('   Stack:', swaggerError?.stack);
      }
    } else {
      if (!swaggerEnabled) {
        console.log('⚠️  Swagger disabled (SWAGGER_ENABLED=false or not set)');
      }
      if (safeMode) {
        console.log('⚠️  Swagger disabled (SAFE_MODE=true)');
      }
    }

    // ============================================
    // STEP 5: Start listening
    // ============================================
    console.log('[BOOT] checkpoint: before app.listen()');
    recordBoot('[BOOT] checkpoint: before app.listen()');
    try {
      await app.listen(port, host);
    } catch (e) {
      console.error('[BOOT] app.listen() threw:', e);
      recordBoot('[BOOT] app.listen() threw', e);
      throw e;
    }
    console.log('[BOOT] checkpoint: after app.listen()');
    recordBoot('[BOOT] checkpoint: after app.listen()');

    // Log binding information clearly
    const logger = new Logger('Bootstrap');
    const safeModeLog = safeMode ? ' (SAFE_MODE=1)' : ' (SAFE_MODE=0)';
    logger.log(`✅ HTTP server listening on ${host}:${port}${safeModeLog}`);
    logger.log(`   Local: http://127.0.0.1:${port}`);
    logger.log(`   Network: http://${host}:${port}`);
    logger.log(`   Health endpoints: http://${host}:${port}/health, http://${host}:${port}/${globalPrefix}/${versionSegment}/health, http://${host}:${port}/${versionSegment}/health`);
    logger.log(`   API Base: http://${host}:${port}/${globalPrefix}/${versionSegment}`);
    if (swaggerEnabled) {
      logger.log(`   Swagger: http://${host}:${port}/api-docs`);
    }

    // Dump Express routes for debugging (SAFE_MODE only)
    // Verify /health and /api/v2/health are mapped correctly
    if (process.env.SAFE_MODE === 'true' || process.env.SAFE_MODE === '1') {
      dumpExpressRoutes(app);
      logger.log('[ROUTES] Expected routes:');
      logger.log('[ROUTE] GET /health (RootHealthController)');
      logger.log('[ROUTE] HEAD /health (RootHealthController)');
      logger.log('[ROUTE] GET /api/v2/health (HealthController)');
    }
  } catch (error: any) {
    console.error('❌ Bootstrap failed:', error);
    if (error?.stack) {
      console.error('Stack:', error.stack);
      writeCrashLog('BOOTSTRAP_ERROR', error);
    } else {
      writeCrashLog('BOOTSTRAP_ERROR', new Error(String(error)));
    }
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  const errorDetails = {
    name: err?.name || 'Unknown',
    message: err?.message || String(err),
    stack: err?.stack || 'No stack trace',
    cause: err?.cause || null,
    toString: String(err),
  };
  
  console.error('❌ Unhandled bootstrap error:', err);
  process.stderr.write(`\n❌ UNHANDLED BOOTSTRAP ERROR\n`);
  process.stderr.write(`Name: ${errorDetails.name}\n`);
  process.stderr.write(`Message: ${errorDetails.message}\n`);
  process.stderr.write(`Stack:\n${errorDetails.stack}\n\n`);
  
  if (err?.stack) {
    console.error('Stack:', err.stack);
    writeCrashLog('BOOTSTRAP_UNHANDLED', err);
    writeCrashLog(`BOOTSTRAP_UNHANDLED_DETAILS: ${JSON.stringify(errorDetails, null, 2)}`, null);
  } else {
    writeCrashLog('BOOTSTRAP_UNHANDLED', new Error(String(err)));
  }
  process.exit(1);
});
