import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MiniModule } from './mini/mini.module';

async function bootstrap() {
  const port = Number(process.env.APP_PORT || 5002);
  const prefix = process.env.API_PREFIX || 'api/v2';
  try {
    const app = await NestFactory.create(MiniModule, { logger: ['error','warn','log','debug','verbose'] });
    app.setGlobalPrefix(prefix);
    await app.listen(port, '0.0.0.0');
    console.log(\\n MINI Server: http://localhost:\/\\);
  } catch (err) {
    console.error(' MINI bootstrap error:', err?.stack || err);
    process.exit(1);
  }
}
process.on('unhandledRejection', (r) => console.error('UNHANDLED REJECTION (mini):', r));
process.on('uncaughtException', (e) => { console.error('UNCAUGHT EXCEPTION (mini):', e); process.exit(1); });
bootstrap();
