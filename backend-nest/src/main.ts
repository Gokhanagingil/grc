import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    const cfg = app.get(ConfigService);
    const port = cfg.get<number>('APP_PORT') ?? cfg.get<number>('PORT') ?? 5002;
    const rawPrefix = cfg.get<string>('API_PREFIX') ?? '/api';
    const apiVersion = cfg.get<string>('API_VERSION') ?? 'v2';
    const healthPath = cfg.get<string>('HEALTH_PATH') ?? '/health';
    const corsOrigins = cfg.get<string>('CORS_ORIGINS') ?? '';
    const swaggerEnabled = cfg.get<string>('SWAGGER_ENABLED') !== 'false';

    // Normalize prefix: remove leading/trailing slashes
    const normPrefix = `/${rawPrefix.replace(/^\/?/, '').replace(/\/$/, '')}`.replace(/\/+/g, '/');
    const ver = (apiVersion ?? 'v2').replace(/^\/?/, '').replace(/\/$/, '');
    const finalPrefix = `${normPrefix}/${ver}`; // e.g., /api/v2
    
    // Set global prefix as /api/v2
    app.setGlobalPrefix(finalPrefix, { exclude: [] });
    
    // Enable URI versioning (already in prefix, but keep for compatibility)
    app.enableVersioning({ 
      type: VersioningType.URI, 
      defaultVersion: ver
    });
    
    // Rewrite middleware: fix double /api, double /v2, /v1 -> /v2
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      let p = req.url;
      
      // Collapse multiple slashes
      p = p.replace(/\/{2,}/g, '/');
      
      // Remove duplicate '/api' occurrences after the first '/api'
      p = p.replace(/\/api\/(api\/)+/g, '/api/');
      
      // Normalize duplicate versions: /api/v2/v2/ -> /api/v2/
      p = p.replace(new RegExp(`${finalPrefix}/v\\d+/`, 'g'), `${finalPrefix}/`);
      
      // Rewrite /api/v1/ to /api/v2/
      p = p.replace(/^\/api\/v1\//, `${finalPrefix}/`);
      
      // Ensure path starts with finalPrefix if it's an API route
      if (p.startsWith('/api/')) {
        const versionMatch = p.match(/^\/api\/v(\d+)\//);
        if (versionMatch && versionMatch[1] !== ver.replace('v', '')) {
          p = p.replace(/^\/api\/v\d+\//, `${finalPrefix}/`);
        } else if (!p.startsWith(finalPrefix)) {
          p = p.replace(/^\/api\//, `${finalPrefix}/`);
        }
      }
      
      req.url = p;
      next();
    });

    // CORS - Allow frontend origin
    const allowedOrigins = corsOrigins 
      ? corsOrigins.split(',').map((s: string) => s.trim()).filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    app.enableCors({ 
      origin: allowedOrigins,
      credentials: true,
      exposedHeaders: ['Authorization'],
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
    });
    
    console.log(`🌐 CORS enabled for origins: ${allowedOrigins.join(', ')}`);
    console.log(`📡 Global prefix: ${normPrefix}, Version: ${ver}`);

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
    console.log(`✅ Server: ${url}/${normPrefix}/${ver}`);
    console.log(`✅ Health: ${url}/${normPrefix}/${ver}/health`);
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
