import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './common/logger';

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
  logger.log('Application started', {
    environment: nodeEnv,
    port,
    healthCheck: `http://localhost:${port}/health/live`,
    metrics: `http://localhost:${port}/metrics`,
    apiDocs: `http://localhost:${port}/`,
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
