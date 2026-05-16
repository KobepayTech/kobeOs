import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  // Prevent accidental schema sync in production — use migrations instead.
  if (
    config.get('DB_SYNCHRONIZE') === 'true' &&
    config.get('NODE_ENV') === 'production'
  ) {
    throw new Error(
      'DB_SYNCHRONIZE must not be enabled in production. Run migrations instead.',
    );
  }

  // Allow base64-encoded uploads (camera captures, small file blobs) up to 25 MB.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173').split(','),
    credentials: true,
  });

  // Swagger API explorer — available at /api/docs in all environments.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('KobeOS API')
    .setDescription('REST API for KobeOS — ERP, cargo, hotel, payments, and productivity modules')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(config.get('PORT', 3000));
  await app.listen(port);
  Logger.log(`KOBE OS API listening on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
