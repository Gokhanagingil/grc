import { NestFactory } from '@nestjs/core';
import { MiniModule } from './mini/mini.module';

async function bootstrap() {
  const app = await NestFactory.create(MiniModule, { logger: ['log', 'error', 'warn'] });
  const port = process.env.MINI_PORT || 5002;
  const prefix = 'api/v2';

  app.setGlobalPrefix(prefix);
  await app.listen(port);

  console.log('Mini backend running at http://localhost:' + port + '/' + prefix + '/health');
}

bootstrap();