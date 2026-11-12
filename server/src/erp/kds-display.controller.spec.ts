import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { KdsDisplayTokens } from './kds-display.controller';

describe('KDS display pairing', () => {
  const secret = 'test-secret-for-kds-display-signing';
  const jwt = new JwtService({ secret });
  const shop = { id: 'shop', ownerId: 'owner' } as StoreSettings;
  const stores = { findOneBy: jest.fn() };
  const members = { findOneBy: jest.fn() };
  const db = { getRepository: (target: unknown) => target === StoreSettings ? stores : members } as DataSource;
  const tokens = new KdsDisplayTokens(jwt, new ConfigService({ JWT_SECRET: secret }), db);

  beforeEach(() => {
    stores.findOneBy.mockReset().mockResolvedValue(shop);
    members.findOneBy.mockReset().mockResolvedValue(null);
  });

  it('only accepts a display token and keeps it separate from account authentication', async () => {
    const { token } = await tokens.issue(shop, shop.ownerId);
    await expect(tokens.ownerFor(`Bearer ${token}`)).resolves.toBe(shop.ownerId);
    expect(stores.findOneBy).toHaveBeenCalledWith({ id: shop.id, ownerId: shop.ownerId });
    await expect(jwt.verifyAsync(token)).rejects.toThrow('invalid signature');
    const accountToken = await jwt.signAsync({ sub: shop.ownerId });
    await expect(tokens.ownerFor(`Bearer ${accountToken}`)).rejects.toThrow('Pair this display');
  });

  it('rejects an existing manager link after membership is revoked', async () => {
    const { token } = await tokens.issue(shop, 'manager');
    members.findOneBy.mockResolvedValueOnce({ role: 'manager' });
    await expect(tokens.ownerFor(`Bearer ${token}`)).resolves.toBe(shop.ownerId);
    await expect(tokens.ownerFor(`Bearer ${token}`)).rejects.toThrow('revoked');
    expect(members.findOneBy).toHaveBeenCalledWith({ shopId: shop.id, userId: 'manager', role: 'manager' });
  });
});
