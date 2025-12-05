import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Swagger/OpenAPI configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GRC Platform API')
    .setDescription(
      `Enterprise Governance, Risk, and Compliance (GRC) Platform API.
      
This API provides endpoints for managing:
- **Risks** - Risk identification, assessment, and mitigation tracking
- **Policies** - Policy lifecycle management and compliance
- **Requirements** - Compliance framework requirements tracking
- **Controls** - Control implementation and effectiveness monitoring

## Authentication
All endpoints require JWT authentication via Bearer token.
Include the token in the Authorization header: \`Bearer <token>\`

## Multi-Tenancy
All GRC endpoints require the \`x-tenant-id\` header to identify the tenant context.
      `,
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-id',
        description: 'Tenant ID (UUID) for multi-tenant isolation',
      },
      'tenant-id',
    )
    .addTag('Health', 'Health check endpoints')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Tenants', 'Tenant management endpoints')
    .addTag('GRC Risks', 'Risk management endpoints')
    .addTag('GRC Policies', 'Policy management endpoints')
    .addTag('GRC Requirements', 'Compliance requirement endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'GRC Platform API Documentation',
  });

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
  console.log(`Swagger docs: http://localhost:${port}/docs`);
  console.log('='.repeat(60));
}

bootstrap();
