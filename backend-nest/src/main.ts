import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, { logger: ['log','error','warn'] });

    const port = Number(process.env.PORT || 5002);
    const prefix = process.env.API_PREFIX || 'api/v2';
    app.setGlobalPrefix(prefix);

    // Global validation
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidUnknownValues: false }));

    // Swagger
    const config = new DocumentBuilder()
      .setTitle('GRC Platform API')
      .setDescription('GRC backend (Policy CRUD, SQLite, Swagger)')
      .setVersion('0.1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/api-docs', app, document);

    await app.listen(port, '0.0.0.0');
    console.log('BUILD_TAG: FULL-BOOT-READY');
    console.log(` FULL backend is running: http://localhost:${port}/${prefix}`);
    console.log(` Swagger:                http://localhost:${port}/api-docs`);
  } catch (error) {
    console.error(' Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error(' Unhandled bootstrap error:', err);
  process.exit(1);
});
