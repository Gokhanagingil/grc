import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    const cfg = app.get(ConfigService);
    const port = cfg.get<number>('APP_PORT') ?? cfg.get<number>('PORT') ?? 5002;
    const prefix = cfg.get<string>('API_PREFIX') ?? 'api';
    const healthPath = cfg.get<string>('HEALTH_PATH') ?? '/health';
    const corsOrigins = cfg.get<string>('CORS_ORIGINS') ?? '';
    const swaggerEnabled = cfg.get<string>('SWAGGER_ENABLED') !== 'false';

    app.setGlobalPrefix(prefix, { exclude: [] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });

    // CORS - Allow frontend origin
    const allowedOrigins = corsOrigins 
      ? corsOrigins.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    app.enableCors({ 
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    });

    // Global validation
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidUnknownValues: false }),
    );

    // Swagger
    if (swaggerEnabled) {
      const config = new DocumentBuilder()
        .setTitle('GRC Platform API')
        .setDescription('GRC backend (Policy CRUD, Postgres, Swagger)')
        .setVersion('0.1.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'x-tenant-id', in: 'header', description: 'Tenant context id (required)' }, 'x-tenant-id')
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('/api-docs', app, document);
    }

    await app.listen(port, '0.0.0.0');
    const url = await app.getUrl();
    console.log(`✅ Server: ${url}${prefix}`);
    console.log(`✅ Health: ${url}${healthPath} (or ${url}${prefix}${healthPath})`);
    if (swaggerEnabled) {
      console.log(`✅ Swagger: ${url}/api-docs`);
    }
  } catch (error) {
    console.error(' Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error(' Unhandled bootstrap error:', err);
  process.exit(1);
});
