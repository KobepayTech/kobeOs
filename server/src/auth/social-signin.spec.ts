import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

describe('social account login', () => {
  const values: Record<string, string> = {
    JWT_SECRET: 'test-only-state-signing-key-long-enough',
    GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'server-only-secret',
    GOOGLE_REDIRECT_URI: 'https://api.example.com/api/auth/oauth/google/callback',
    APP_FRONTEND_URL: 'https://app.example.com',
  };
  const config = { get: (key: string) => values[key], getOrThrow: (key: string) => values[key] };
  let service: AuthService;
  const originalFetch = global.fetch;
  beforeEach(() => {
    service = new AuthService({} as never, {} as never, config as never, {} as never, {} as never);
  });
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('uses server credentials and the registered Google callback', () => {
    const url = new URL(service.googleAuthUrl(service.createOAuthState('google')));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(values.GOOGLE_REDIRECT_URI);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.has('client_secret')).toBe(false);
  });

  it('creates or signs in an account only after Google verifies its identity', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id_token: 'provider-id-token' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        aud: values.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com',
        exp: String(Math.floor(Date.now() / 1000) + 600), email: 'amina@example.com', email_verified: true,
      }) });
    const signin = jest.spyOn(service, 'oauthSignIn').mockResolvedValue({ user: { id: 'u' } } as never);
    await service.googleCodeSignIn('authorization-code');
    expect(signin).toHaveBeenCalledWith(expect.objectContaining({ email: 'amina@example.com' }));
  });

  it('rejects an unverified Google email', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      aud: values.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com',
      exp: String(Math.floor(Date.now() / 1000) + 600), email: 'amina@example.com', email_verified: false,
    }) });
    await expect(service.googleSignIn('id-token')).rejects.toThrow('not verified');
  });

  it('rejects state issued for a different provider', () => {
    expect(() => service.verifyOAuthState(service.createOAuthState('google'), 'meta')).toThrow();
  });

  it('does not exchange a Google code without this browser’s state cookie', async () => {
    const exchange = jest.spyOn(service, 'googleCodeSignIn');
    const controller = new AuthController(service, {} as never);
    const response = { setHeader: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    await controller.googleCallback('code', service.createOAuthState('google'), '',
      { headers: {} } as never, response as never);
    expect(exchange).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(expect.stringContaining('error='));
  });

  it('completes a browser-bound Google callback', async () => {
    const state = service.createOAuthState('google');
    jest.spyOn(service, 'googleCodeSignIn').mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' } as never);
    const response = { setHeader: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    await new AuthController(service, {} as never).googleCallback('code', state, '',
      { headers: { cookie: `kobeos_oauth_google=${state}` } } as never, response as never);
    expect(response.redirect).toHaveBeenCalledWith(expect.stringContaining('/oauth/google#access_token='));
  });

  it('prevents password signup from claiming a social provider identity', async () => {
    await expect(service.register({ email: 'meta_123@users.kobeos.local', password: 'long-password' }))
      .rejects.toThrow('Use your own email');
  });

  it.each(['meta', 'tiktok'] as const)('rejects a %s callback from another browser', async provider => {
    const state = service.createOAuthState(provider);
    const exchange = jest.spyOn(service, provider === 'meta' ? 'metaSignIn' : 'tiktokSignIn');
    const controller = new AuthController(service, {} as never);
    const response = { setHeader: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    await controller[provider === 'meta' ? 'metaCallback' : 'tiktokCallback']('code', state, '', '',
      { headers: {} } as never, response as never);
    expect(exchange).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(expect.stringContaining('error='));
  });

  it.each(['email', 'phone'] as const)('registers and signs in with %s and a password', async method => {
    let saved: Record<string, any> | undefined;
    const users = {
      findByEmail: jest.fn(async (email: string) => saved?.email === email ? saved : undefined),
      findByPhone: jest.fn(async (phone: string) => saved?.phone === phone ? saved : undefined),
      create: jest.fn(async (data: Record<string, any>) => saved = { id: 'account', role: 'user', ...data }),
    };
    const tokens = { create: (data: unknown) => data, save: jest.fn(async () => undefined) };
    const auth = new AuthService(users as never, { signAsync: jest.fn(async () => 'jwt') } as never,
      config as never, tokens as never, {} as never);
    const identifier = method === 'email' ? 'amina@example.com' : '+255712345678';
    const registration = await auth.register({ [method]: identifier, password: 'long-password', displayName: 'Amina' });
    expect(registration.user.id).toBe('account');
    const login = await auth.login({ identifier, password: 'long-password' });
    expect(login.user.id).toBe(registration.user.id);
    await expect(auth.login({ identifier, password: 'wrong-password' })).rejects.toThrow('Invalid credentials');
  });
});
