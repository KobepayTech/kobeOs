import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, static as expressStatic } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join, basename, extname } from 'path';
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
  // Resolve the SPA build across deployments: explicit override first
  // (KOBEOS_SPA_PATH), then the bundled desktop location (KOBEOS_RESOURCES_PATH/
  // dist), then the monorepo/dev and cwd fallbacks. First candidate that
  // actually contains index.html wins.
  const spaCandidates = [
    process.env.KOBEOS_SPA_PATH,
    process.env.KOBEOS_RESOURCES_PATH ? join(process.env.KOBEOS_RESOURCES_PATH, 'dist') : null,
    join(__dirname, '..', '..', 'dist'),
    join(process.cwd(), 'dist'),
    join(process.cwd(), '..', 'dist'),
  ].filter((p): p is string => !!p);
  const spaPath = spaCandidates.find((p) => existsSync(join(p, 'index.html'))) ?? spaCandidates[0];
  if (existsSync(join(spaPath, 'index.html'))) {
    app.use(expressStatic(spaPath, { index: false }));
    Logger.log(`Serving SPA static files from ${spaPath}`, 'Bootstrap');
  } else {
    Logger.warn(
      `SPA dist/ not found. Tried: ${spaCandidates.join(' | ')}. ` +
      `Build the frontend ('npm run build' at repo root) or set KOBEOS_SPA_PATH. ` +
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

  // SPA catch-all: return index.html for any route that isn't /api/* or a
  // static asset. This lets React Router handle /shop/:slug, /m/:slug, etc.
  //
  // The SPA is built with a RELATIVE base ('./assets/…') so Electron can load
  // it over file://. That means on a DEEP route (e.g. /m/johsport) the browser
  // requests /m/assets/index-*.js — which is NOT under top-level /assets/ and
  // would otherwise fall through to index.html (served as text/html), breaking
  // the module script and blanking the page. So: resolve any nested /assets/
  // request — and any relatively-referenced top-level file (registerSW.js,
  // manifest.webmanifest, icons…) — to the real file before the HTML fallback.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
      return next();
    }
    // Nested "/assets/…" from a deep route → serve the real hashed asset.
    const assetIdx = req.path.indexOf('/assets/');
    if (assetIdx > 0) {
      const real = join(spaPath, req.path.slice(assetIdx));
      if (existsSync(real)) return res.sendFile(real);
    }
    // A relatively-referenced top-level static file that resolved under a
    // deep route (e.g. /m/registerSW.js → registerSW.js).
    const ext = extname(req.path);
    if (ext && ext !== '.html') {
      const flat = join(spaPath, basename(req.path));
      if (existsSync(flat)) return res.sendFile(flat);
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
