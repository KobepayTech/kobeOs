import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, static as expressStatic } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { buildOriginPredicate } from './common/cors';

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

  // ── Serve the storefront SPA for *.kobeapptz.com ──────────────────────────
  // The wildcard Cloudflare tunnel routes *.kobeapptz.com to this server.
  // We must serve the built SPA (index.html + assets) so customer stores
  // render. The SPA's main.tsx detects the tenant subdomain and routes to
  // the ErpShop storefront component.
  //
  // Expected: run `npm run build` at repo root first → dist/ folder created.
  const spaPath = join(__dirname, '..', '..', 'dist');
  if (existsSync(spaPath)) {
    app.use(expressStatic(spaPath, { index: false }));
    Logger.log(`Serving SPA static files from ${spaPath}`, 'Bootstrap');
  } else {
    Logger.warn(
      `SPA dist/ not found at ${spaPath}. ` +
      `Run 'npm run build' at the repo root to enable storefronts. ` +
      `API routes still work — only customer-facing shops will be unavailable.`,
      'Bootstrap',
    );
  }

  // API routes live under /api/* — this is set BEFORE the SPA fallback
  // so /api/store/:slug/* resolves to Nest controllers, not index.html.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const cors = buildOriginPredicate();
  app.enableCors({ origin: cors.predicate, credentials: true });
  // Log the effective CORS config at boot so a misconfig is loud
  // instead of silently 4xx'ing every browser fetch (which the SPA
  // then reports as "Backend unreachable" via OfflineWriteQueuedError).
  if (!cors.baseDomain && cors.explicit.every((o) => o.includes('localhost'))) {
    Logger.warn(
      'CORS: no TENANT_BASE_DOMAIN set and CORS_ORIGIN is localhost-only. ' +
      'Browsers hitting this API from any non-localhost origin will fail preflight.',
      'Bootstrap',
    );
  } else {
    Logger.log(
      `CORS: explicit=[${cors.explicit.join(', ')}]` +
      (cors.baseDomain ? `, wildcard=*.${cors.baseDomain} + apex ${cors.baseDomain}` : ''),
      'Bootstrap',
    );
  }

  // Swagger API explorer — available at /api/docs in all environments.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('KobeOS API')
    .setDescription('REST API for KobeOS — ERP, cargo, hotel, payments, and productivity modules')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // SPA catch-all: return index.html for any route that isn't /api/* or /assets/*
  // This lets React Router in the browser handle paths like /shop/:slug,
  // /m/:slug, and tenant subdomains (slug.kobeapptz.com → /).
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
      return next();
    }
    const indexPath = join(spaPath, 'index.html');
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  const port = Number(config.get('PORT', 3000));
  await app.listen(port);
  Logger.log(`KOBE OS API listening on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
