import { ProviderConfigService } from './provider-config.service';
import { describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { ProviderConfig } from './provider-config.entity';
import type { ProviderSetupSession } from './provider-setup-session.entity';

describe('ProviderConfigService', () => {
  const appSecret = 'meta-secret-that-must-never-be-returned';

  function setup() {
    let savedConfig: Record<string, unknown> | undefined;
    let savedSession: Record<string, unknown> | undefined;
    const configRepo = {
      findOne: jest.fn(async () => savedConfig),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => {
        savedConfig = { ...value, updatedAt: new Date() };
        return savedConfig;
      }),
    };
    const sessionRepo = {
      update: jest.fn(async () => ({ affected: 1 })),
      findOne: jest.fn(async () => savedSession),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(async (value: Record<string, unknown>) => {
        savedSession = { ...value, id: 'session-1' };
        return savedSession;
      }),
    };
    const values: Record<string, string> = {
      JWT_SECRET: 'a deployment secret long enough for this test',
      APP_PUBLIC_URL: 'https://kobe.example',
      META_APP_ID: '',
      META_APP_SECRET: '',
      META_REDIRECT_URI: '',
      META_LOGIN_CONFIG_ID: '',
      META_GRAPH_VERSION: 'v26.0',
    };
    const env = {
      get: (key: string, fallback?: string) => values[key] ?? fallback,
      getOrThrow: (key: string) => values[key] ?? (() => { throw new Error(`missing ${key}`); })(),
    };
    const service = new ProviderConfigService(
      configRepo as unknown as Repository<ProviderConfig>,
      sessionRepo as unknown as Repository<ProviderSetupSession>,
      env as unknown as ConfigService,
    );
    return { service, configRepo, sessionRepo, getConfig: () => savedConfig };
  }

  it('encrypts the Meta secret at rest and decrypts it only for OAuth use', async () => {
    const { service, getConfig } = setup();
    await service.saveMetaConfig({
      appId: '123456',
      appSecret,
      redirectUri: 'https://kobe.example/api/auth/oauth/meta/callback',
      loginConfigId: 'config-1',
      graphVersion: 'v26.0',
    });

    const stored = getConfig() as Record<string, unknown>;
    expect(typeof stored.encryptedAppSecret).toBe('string');
    expect(stored.encryptedAppSecret).not.toContain(appSecret);
    expect(await service.getMetaConfig()).toMatchObject({ appId: '123456', appSecret });
    expect(await service.status()).toMatchObject({ configured: true, hasSecret: true });
  });

  it('creates an expiring setup URL without putting credentials in the URL', async () => {
    const { service } = setup();
    const session = await service.createSetupSession('admin-1');
    expect(session.setupUrl).toMatch(/^https:\/\/kobe\.example\/setup\/meta\?token=/);
    expect(session.setupUrl).not.toContain(appSecret);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
