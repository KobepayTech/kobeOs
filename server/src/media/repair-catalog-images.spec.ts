import { repairCatalogImages } from './repair-catalog-images';
import { PosProduct } from '../pos/pos.entity';
import { Repository } from 'typeorm';

describe('saved catalogue photo repair', () => {
  it('persists misses across reloads and bypasses negative cache on explicit retry', async () => {
    const id = '44444444-4444-4444-4444-444444444444';
    const assetRepo = { find: jest.fn().mockResolvedValue([]), update: jest.fn() };
    const query = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) };
    const repo = { manager: { getRepository: () => assetRepo }, createQueryBuilder: () => query } as unknown as Repository<PosProduct>;
    const row = { id: 'p', ownerId: 'durable', imageUrl: `/api/media/blob/${id}`, imageUrls: [] } as unknown as PosProduct;
    await repairCatalogImages(repo, 'durable', [row]);
    expect(row.photoRepair?.unresolved).toEqual([row.imageUrl]);
    // A saved record suppresses lookups even when the in-memory cache expires.
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 7_200_000);
    try { await repairCatalogImages(repo, 'durable', [JSON.parse(JSON.stringify(row))]); } finally { clock.mockRestore(); }
    expect(assetRepo.find).toHaveBeenCalledTimes(1);
    assetRepo.find.mockResolvedValue([{ id, kind: 'photo', publicToken: 'restored', src: '/api/media-public/restored' }]);
    await repairCatalogImages(repo, 'durable', [row], true);
    expect(row.imageUrl).toBe('/api/media-public/restored');
    expect(row.photoRepair?.unresolved).toEqual([]);
  });
  it('does not replace a concurrently edited gallery in the response', async () => {
    const id = '55555555-5555-5555-5555-555555555555';
    const assetRepo = { find: jest.fn().mockResolvedValue([{ id, kind: 'photo', publicToken: 'public', src: '/api/media-public/public' }]) };
    const query = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 0 }) };
    const repo = { manager: { getRepository: () => assetRepo }, createQueryBuilder: () => query } as unknown as Repository<PosProduct>;
    const row = { id: 'p', ownerId: 'concurrent', imageUrl: `/api/media/blob/${id}`, imageUrls: [] } as unknown as PosProduct;
    await repairCatalogImages(repo, 'concurrent', [row]);
    expect(row.imageUrl).toContain('/api/media/blob/');
    expect(row.photoRepair).toBeUndefined();
  });
  it('repairs owned photo references and leaves external and foreign references alone', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const foreign = '22222222-2222-2222-2222-222222222222';
    const assetRepo = { find: jest.fn().mockResolvedValue([{ id, ownerId: 'owner', publicToken: 'public-photo', src: '/old', kind: 'photo', contentBinary: Buffer.from('bytes') }]), update: jest.fn() };
    const query = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({ affected: 1 }) };
    const repo = { manager: { getRepository: () => assetRepo }, createQueryBuilder: () => query } as unknown as Repository<PosProduct>;
    const rows = [{ id: 'product', ownerId: 'owner', imageUrl: `/api/media/blob/${id}`, imageUrls: [`/api/media/blob/${id}`, `/api/media/blob/${foreign}`, 'https://example.com/image.jpg'] }] as PosProduct[];
    await repairCatalogImages(repo, 'owner', rows);
    expect(assetRepo.find.mock.calls[0][0].where.ownerId).toBe('owner');
    expect(rows[0].imageUrl).toBe('/api/media-public/public-photo');
    expect(rows[0].imageUrls).toEqual(['/api/media-public/public-photo', `/api/media/blob/${foreign}`, 'https://example.com/image.jpg']);
    expect(query.where.mock.calls.every(call => call[1].ownerId === 'owner' && call[0].includes(':old'))).toBe(true);
  });
  it('stops querying for a reference it cannot resolve', async () => {
    // A deleted or foreign asset never resolves, so the product row keeps its
    // legacy URL. Without a memory of the miss every later read — including
    // every public storefront page view — would re-run the same lookup.
    const missing = '33333333-3333-3333-3333-333333333333';
    const assetRepo = { find: jest.fn().mockResolvedValue([]), update: jest.fn() };
    const query = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn() };
    const repo = { manager: { getRepository: () => assetRepo }, createQueryBuilder: () => query } as unknown as Repository<PosProduct>;
    const rows = () => [{ id: 'product', ownerId: 'owner-miss', imageUrl: `/api/media/blob/${missing}`, imageUrls: [] }] as PosProduct[];

    await repairCatalogImages(repo, 'owner-miss', rows());
    expect(assetRepo.find).toHaveBeenCalledTimes(1);
    await repairCatalogImages(repo, 'owner-miss', rows());
    await repairCatalogImages(repo, 'owner-miss', rows());
    expect(assetRepo.find).toHaveBeenCalledTimes(1);
  });
  it('does no database work for already public links', async () => {
    const getRepository = jest.fn();
    await repairCatalogImages({ manager: { getRepository } } as unknown as Repository<PosProduct>, 'owner', [{ imageUrl: '/api/media-public/token', imageUrls: [] }] as unknown as PosProduct[]);
    expect(getRepository).not.toHaveBeenCalled();
  });
});
