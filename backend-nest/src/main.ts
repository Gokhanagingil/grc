import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

/**
 * Bootstrap the NestJS application
 * 
 * This NestJS backend runs alongside the existing Express backend:
 * - Express backend: port 3001
 * - NestJS backend: port 3002 (default)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  const corsOrigins = configService.get<string>('cors.origins') || '';
  app.enableCors({
    origin: corsOrigins.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  // Get port from config (default 3002 to avoid conflict with Express on 3001)
  const port = configService.get<number>('app.port') || 3002;

  await app.listen(port);

  console.log('='.repeat(60));
  console.log('GRC Platform - NestJS Backend');
  console.log('='.repeat(60));
  console.log(`Environment: ${configService.get<string>('app.nodeEnv')}`);
  console.log(`Port: ${port}`);
  console.log(`Health check: http://localhost:${port}/health/live`);
  console.log(`API docs: http://localhost:${port}/`);
  console.log('='.repeat(60));
}

bootstrap();
