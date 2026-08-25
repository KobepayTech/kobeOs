import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { IsOptional, IsString, IsUrl, MinLength, validateSync } from 'class-validator';
import { IsNull, Repository } from 'typeorm';
import { ProviderConfig } from './provider-config.entity';
import { ProviderSetupSession } from './provider-setup-session.entity';

export class MetaProviderConfigDto {
  @IsString()
  @MinLength(1)
  appId!: string;

  /** Optional when updating an existing record: the old secret is retained. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  appSecret?: string;

  @IsString()
  @IsUrl({ require_tld: false })
  redirectUri!: string;

  @IsOptional()
  @IsString()
  loginConfigId?: string;

  @IsOptional()
  @IsString()
  graphVersion?: string;
}

export class ActivateMetaProviderConfigDto extends MetaProviderConfigDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

export interface EffectiveMetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  loginConfigId: string;
  graphVersion: string;
}

type MetaStatus = {
  configured: boolean;
  source: 'setup' | 'environment' | 'not-configured';
  appId: string;
  redirectUri: string;
  loginConfigId: string;
  graphVersion: string;
  hasSecret: boolean;
  configuredAt: string | null;
};

const PROVIDER = 'meta';
const SETUP_TTL_MS = 10 * 60_000;

@Injectable()
export class ProviderConfigService {
  constructor(
    @InjectRepository(ProviderConfig)
    private readonly configs: Repository<ProviderConfig>,
    @InjectRepository(ProviderSetupSession)
    private readonly sessions: Repository<ProviderSetupSession>,
    private readonly env: ConfigService,
  ) {}

  private encryptionKey(): Buffer {
    // Dedicated, FIXED key for provider secrets so routine JWT_SECRET rotation
    // never makes the stored Meta secret undecryptable. Set PROVIDER_ENCRYPTION_KEY
    // once and keep it stable. Falls back to JWT_SECRET only for older
    // deployments that never set the dedicated key.
    const key = this.env.get<string>('PROVIDER_ENCRYPTION_KEY')?.trim()
      || this.env.getOrThrow<string>('JWT_SECRET');
    return createHash('sha256').update(key).digest();
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join('.');
  }

  private decrypt(value: string): string {
    const [ivHex, tagHex, ciphertextHex] = value.split('.');
    if (!ivHex || !tagHex || !ciphertextHex) throw new Error('Invalid encrypted provider secret');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private environmentConfig(): Partial<EffectiveMetaConfig> {
    return {
      appId: this.env.get<string>('META_APP_ID') || this.env.get<string>('INSTAGRAM_APP_ID') || '',
      appSecret: this.env.get<string>('META_APP_SECRET') || this.env.get<string>('INSTAGRAM_APP_SECRET') || '',
      redirectUri: this.env.get<string>('META_REDIRECT_URI') || '',
      loginConfigId: this.env.get<string>('META_LOGIN_CONFIG_ID')?.trim() || '',
      graphVersion: this.env.get<string>('META_GRAPH_VERSION')?.trim() || 'v26.0',
    };
  }

  async getMetaConfig(): Promise<EffectiveMetaConfig> {
    const env = this.environmentConfig();
    const saved = await this.configs.findOne({ where: { provider: PROVIDER } });
    if (!saved) {
      return {
        appId: env.appId || '',
        appSecret: env.appSecret || '',
        redirectUri: env.redirectUri || '',
        loginConfigId: env.loginConfigId || '',
        graphVersion: env.graphVersion || 'v26.0',
      };
    }

    let appSecret = '';
    try {
      appSecret = this.decrypt(saved.encryptedAppSecret);
    } catch {
      // A changed JWT_SECRET makes the old ciphertext intentionally unreadable.
      // The setup screen can replace it without ever exposing the old value.
      appSecret = '';
    }
    return {
      appId: saved.appId || env.appId || '',
      appSecret: appSecret || env.appSecret || '',
      redirectUri: saved.redirectUri || env.redirectUri || '',
      loginConfigId: saved.loginConfigId || env.loginConfigId || '',
      graphVersion: saved.graphVersion || env.graphVersion || 'v26.0',
    };
  }

  async status(): Promise<MetaStatus> {
    const saved = await this.configs.findOne({ where: { provider: PROVIDER } });
    const current = await this.getMetaConfig();
    const configured = Boolean(current.appId && current.appSecret && current.redirectUri);
    return {
      configured,
      source: saved ? 'setup' : configured ? 'environment' : 'not-configured',
      appId: current.appId,
      redirectUri: current.redirectUri,
      loginConfigId: current.loginConfigId,
      graphVersion: current.graphVersion,
      hasSecret: Boolean(current.appSecret),
      configuredAt: saved?.updatedAt?.toISOString() ?? null,
    };
  }

  async saveMetaConfig(raw: MetaProviderConfigDto, configuredBy?: string): Promise<MetaStatus> {
    this.validateMetaInput(raw);

    const appId = raw.appId.trim();
    const redirectUri = raw.redirectUri.trim();
    const existing = await this.configs.findOne({ where: { provider: PROVIDER } });
    let encryptedAppSecret = existing?.encryptedAppSecret;
    if (raw.appSecret?.trim()) encryptedAppSecret = this.encrypt(raw.appSecret.trim());
    if (!encryptedAppSecret) {
      const environmentSecret = this.environmentConfig().appSecret;
      if (environmentSecret) encryptedAppSecret = this.encrypt(environmentSecret);
    }
    if (!encryptedAppSecret) throw new BadRequestException('Meta app secret is required the first time you save Meta setup');

    const record = this.configs.create({
      ...(existing ?? {}),
      provider: PROVIDER,
      appId,
      encryptedAppSecret,
      redirectUri,
      loginConfigId: raw.loginConfigId?.trim() ?? existing?.loginConfigId ?? this.environmentConfig().loginConfigId ?? '',
      graphVersion: raw.graphVersion?.trim() || existing?.graphVersion || 'v26.0',
      configuredBy: configuredBy || existing?.configuredBy || null,
    });
    await this.configs.save(record);
    return this.status();
  }

  async createSetupSession(createdBy?: string, requestOrigin?: string): Promise<{
    setupUrl: string;
    expiresAt: string;
  }> {
    const publicUrl = requestOrigin?.trim()
      || this.env.get<string>('APP_PUBLIC_URL')?.trim()
      || this.env.get<string>('APP_FRONTEND_URL')?.trim()
      || '';
    if (!publicUrl) {
      throw new BadRequestException('Set APP_PUBLIC_URL before creating a QR setup link');
    }

    // Invalidate older unconsumed links whenever an admin requests a new one.
    await this.sessions.update(
      { provider: PROVIDER, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SETUP_TTL_MS);
    await this.sessions.save(this.sessions.create({
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      provider: PROVIDER,
      expiresAt,
      usedAt: null,
      createdBy: createdBy || null,
    }));

    const base = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
    return {
      setupUrl: `${base}/setup/meta?token=${encodeURIComponent(rawToken)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async activateWithToken(token: string, config: MetaProviderConfigDto): Promise<MetaStatus> {
    const rawToken = token?.trim();
    if (!rawToken) throw new UnauthorizedException('Missing setup token');
    this.validateMetaInput(config);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.sessions.findOne({ where: { tokenHash, provider: PROVIDER } });
    if (!session || session.usedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('This setup link is expired or has already been used');
    }
    const claimed = await this.sessions.update(
      { id: session.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!claimed.affected) throw new UnauthorizedException('This setup link has already been used');
    return this.saveMetaConfig(config, session.createdBy ?? undefined);
  }

  private validateMetaInput(raw: MetaProviderConfigDto): void {
    const errors = validateSync(Object.assign(new MetaProviderConfigDto(), raw), {
      whitelist: true,
    });
    if (errors.length) {
      throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
    }
  }

  async assertConfigured(): Promise<EffectiveMetaConfig> {
    const config = await this.getMetaConfig();
    if (!config.appId || !config.appSecret || !config.redirectUri) {
      throw new BadRequestException('Meta sign-in is not configured');
    }
    return config;
  }
}
