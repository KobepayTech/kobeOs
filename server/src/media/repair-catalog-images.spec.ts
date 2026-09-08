import { repairCatalogImages } from './repair-catalog-images';
import { PosProduct } from '../pos/pos.entity';
import { Repository } from 'typeorm';

describe('saved catalogue photo repair', () => {
  it('repairs owned photo references and leaves external and foreign references alone', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const foreign = '22222222-2222-2222-2222-222222222222';
    const assetRepo = { find: jest.fn().mockResolvedValue([{ id, ownerId: 'owner', publicToken: 'public-photo', src: '/old', kind: 'photo', contentBinary: Buffer.from('bytes') }]), update: jest.fn() };
    const query = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn() };
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
    const rows = () => [{ id: 'product', ownerId: 'owner', imageUrl: `/api/media/blob/${missing}`, imageUrls: [] }] as PosProduct[];

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
