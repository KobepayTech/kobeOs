import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSettings } from './store-settings.entity';

/** Populated by TenantMiddleware when the request arrives on a store subdomain. */
export interface TenantRequest extends Request {
  tenant?: StoreSettings;
}

/**
 * Resolves the store tenant from the Host header.
 *
 * Matches both:
 *   - Default subdomain:  {slug}.kobeapptz.com  → looks up by domainSlug
 *   - Custom domain:      shop.mycompany.com     → looks up by customDomain
 *
 * Attaches the resolved StoreSettings to `req.tenant` so downstream
 * handlers can use it without an extra DB query.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(StoreSettings)
    private readonly repo: Repository<StoreSettings>,
  ) {}

  async use(req: TenantRequest, _res: Response, next: NextFunction) {
    const host = (req.headers['x-forwarded-host'] as string | undefined)
      ?? req.headers.host
      ?? '';

    // Strip port if present (e.g. localhost:3000)
    const hostname = host.split(':')[0].toLowerCase();

    // Match *.kobeapptz.com — extract the leftmost label as the slug
    const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.kobeapptz\.com$/);
    if (subdomainMatch) {
      const slug = subdomainMatch[1];
      // Skip reserved / infrastructure subdomains
      if (!RESERVED.has(slug)) {
        req.tenant = await this.repo.findOne({ where: { domainSlug: slug } }) ?? undefined;
      }
    } else {
      // Try custom domain lookup (e.g. shop.mycompany.com)
      const isApexOrKobe = hostname === 'kobeapptz.com' || hostname.endsWith('.kobeapptz.com');
      if (!isApexOrKobe && hostname !== 'localhost') {
        req.tenant = await this.repo.findOne({ where: { customDomain: hostname } }) ?? undefined;
      }
    }

    next();
  }
}

const RESERVED = new Set([
  'www', 'api', 'admin', 'mail', 'smtp', 'imap', 'pop', 'pop3',
  'ftp', 'sftp', 'ssh', 'vpn', 'cdn', 'static', 'assets',
  'support', 'help', 'status', 'dev', 'staging', 'beta', 'app',
  'dashboard', 'panel', 'portal', 'auth', 'login', 'signup',
]);
