import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { VersioningType, RequestMethod, Controller, Get } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from '../src/config/env.validation';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { TenantEntity } from '../src/entities/tenant/tenant.entity';
import { UserEntity } from '../src/entities/auth/user.entity';
import { RefreshTokenEntity } from '../src/entities/auth/refresh-token.entity';
import { DataSource } from 'typeorm';
import { AuthService } from '../src/modules/auth/auth.service';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Controller({ path: 'health', version: '2' })
class SmokeHealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async base() {
    let db = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      db = 'ok';
    } catch {
      db = 'down';
    }
    return {
      status: 'ok',
      deps: { db },
      time: new Date().toISOString(),
    };
  }

  @Get('live')
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA || 'public',
        ssl:
          (process.env.DB_SSL || 'false').toLowerCase() === 'true'
            ? { rejectUnauthorized: false }
            : false,
        entities: [TenantEntity, UserEntity, RefreshTokenEntity],
        synchronize: false,
        logging: false,
        migrationsRun: false,
      }),
    }),
    TypeOrmModule.forFeature([TenantEntity, UserEntity, RefreshTokenEntity]),
    UsersModule,
    AuthModule,
  ],
  controllers: [SmokeHealthController],
})
class SmokeAppModule {}

async function bootstrap() {
  const app = await NestFactory.create(SmokeAppModule, {
    logger: ['error', 'warn'],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });

  const port = Number(process.env.PORT || 5002);
  await app.listen(port, '0.0.0.0');

  const dataSource = app.get(DataSource);
  const authService = app.get(AuthService);
  const configService = app.get(NestConfigService);
  const expressApp: any = app.getHttpAdapter().getInstance();

  const healthHandler = async (_req: any, res: any) => {
    try {
      await dataSource.query('SELECT 1');
      res.json({ status: 'ok', time: new Date().toISOString(), deps: { db: 'ok' } });
    } catch (error) {
      res.status(503).json({ status: 'error', error: (error as Error).message });
    }
  };

  expressApp.get('/health', healthHandler);
  expressApp.get('/v2/health', healthHandler);
  expressApp.get('/api/v2/health', healthHandler);

  expressApp.post('/api/v2/auth/login', async (req: any, res: any) => {
    const { email, password, mfaCode } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password required' });
    }

    const tenantHeader = req.headers['x-tenant-id'] as string | undefined;
    const defaultTenant = configService.get<string>('DEFAULT_TENANT_ID')?.trim();
    const tenantId = tenantHeader?.trim() || defaultTenant;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant context required',
        detail: 'Provide x-tenant-id header or configure DEFAULT_TENANT_ID',
      });
    }

    try {
      const result = await authService.login(email, password, tenantId, mfaCode);
      return res.json(result);
    } catch (error: any) {
      const status = error?.status ?? 401;
      const message = error?.response?.message ?? error?.message ?? 'Unauthorized';
      return res.status(status).json({ message });
    }
  });

  const httpAdapter = app.getHttpAdapter();
  const instance: any = httpAdapter.getInstance?.() ?? httpAdapter.getHttpServer?.();
  const stack: any[] = instance?._router?.stack ?? [];
  const mapped = stack
    .filter((layer) => layer.route?.path)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods || {}),
    }));
  console.log('Mapped routes:', mapped);
  console.log(`Smoke server ready at http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Smoke server bootstrap failed:', err);
  process.exit(1);
});
