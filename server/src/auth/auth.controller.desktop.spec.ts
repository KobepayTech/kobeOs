import { HttpException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { PasswordResetService } from './password-reset.service';

/**
 * The desktop account bridge must keep a self-hosted install usable when Kobe
 * Cloud is unreachable: a network/gateway failure falls back to a local
 * account, while an authoritative cloud rejection (e.g. email already taken) is
 * surfaced unchanged.
 */
describe('AuthController desktop bridge — cloud fallback', () => {
  const localTokens = {
    accessToken: 'local-access',
    refreshToken: 'local-refresh',
    user: { id: 'u1', email: 'a@b.com', phone: null, displayName: 'A', role: 'user' as const },
  };

  let auth: jest.Mocked<Pick<AuthService, 'register' | 'login'>>;
  let resets: jest.Mocked<Pick<PasswordResetService, 'createToken' | 'reset'>>;
  let controller: AuthController;
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.KOBEOS_DESKTOP = 'true';
    auth = { register: jest.fn().mockResolvedValue(localTokens), login: jest.fn().mockResolvedValue(localTokens) };
    resets = { createToken: jest.fn().mockResolvedValue({ ok: true }), reset: jest.fn().mockResolvedValue({ ok: true }) };
    controller = new AuthController(auth as unknown as AuthService, resets as unknown as PasswordResetService);
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.KOBEOS_DESKTOP;
  });

  it('falls back to a local account when the cloud is unreachable (network failure)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as unknown as typeof fetch;
    const res = await controller.desktopRegister({ email: 'a@b.com', password: 'pw12345678' } as never);
    expect(auth.register).toHaveBeenCalled();
    expect(res).toMatchObject({ accessToken: 'local-access', cloudAccessToken: '', cloudRefreshToken: '' });
  });

  it('falls back to local when the cloud returns a gateway error (503)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 503, json: async () => ({}),
    }) as unknown as typeof fetch;
    const res = await controller.desktopLogin({ identifier: 'a@b.com', password: 'pw12345678' } as never);
    expect(auth.login).toHaveBeenCalled();
    expect(res).toMatchObject({ accessToken: 'local-access' });
  });

  it('surfaces an authoritative cloud rejection (409) instead of falling back', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ message: 'Email already registered' }),
    }) as unknown as typeof fetch;
    await expect(
      controller.desktopRegister({ email: 'a@b.com', password: 'pw12345678' } as never),
    ).rejects.toBeInstanceOf(HttpException);
    expect(auth.register).not.toHaveBeenCalled();
  });
});
