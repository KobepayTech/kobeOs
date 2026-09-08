import { randomBytes } from 'crypto';
import { In, IsNull, Not, Repository } from 'typeorm';
import { MediaAsset } from './media.entity';
import { PosProduct } from '../pos/pos.entity';

/** Upgrade only this owner's saved product-photo references, never arbitrary files. */
export async function repairCatalogImages(repo: Repository<PosProduct>, ownerId: string, rows: PosProduct[]) {
  const legacyId = (url: string | null | undefined) => /^\/api\/media\/blob\/([a-f0-9-]{36})$/i.exec(url || '')?.[1];
  const ids = [...new Set(rows.flatMap((row) => [row.imageUrl, ...(row.imageUrls || [])]).map(legacyId).filter((id): id is string => !!id))];
  if (!ids.length) return rows;
  const links = await publicPhotoLinks(repo.manager.getRepository(MediaAsset), ownerId, ids);
  const resolve = (url: string) => links.get(legacyId(url) || '') || url;
  for (const row of rows) {
    const imageUrl = row.imageUrl ? resolve(row.imageUrl) : row.imageUrl;
    const imageUrls = (row.imageUrls || []).map(resolve);
    // Conditional updates cannot overwrite a product edited during this read.
    if (imageUrl !== row.imageUrl) {
      await repo.createQueryBuilder().update().set({ imageUrl }).where('id = :id AND "ownerId" = :ownerId AND "imageUrl" = :old', { id: row.id, ownerId, old: row.imageUrl }).execute();
      row.imageUrl = imageUrl;
    }
    if (JSON.stringify(imageUrls) !== JSON.stringify(row.imageUrls || [])) {
      await repo.createQueryBuilder().update().set({ imageUrls }).where('id = :id AND "ownerId" = :ownerId AND "imageUrls" = :old::jsonb', { id: row.id, ownerId, old: JSON.stringify(row.imageUrls || []) }).execute();
      row.imageUrls = imageUrls;
    }
  }
  return rows;
}

export async function publicPhotoLinks(assets: Repository<MediaAsset>, ownerId: string, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const found = await assets.find({ select: ['id', 'publicToken', 'src', 'kind'], where: { ownerId, id: In(ids), contentBinary: Not(IsNull()) } });
  const links = new Map<string, string>();
  for (const asset of found) {
    if (!['image', 'photo'].includes(asset.kind)) continue;
    if (!asset.publicToken) {
      await assets.createQueryBuilder().update().set({ publicToken: randomBytes(24).toString('base64url') })
        .where('id = :id AND "ownerId" = :ownerId AND "publicToken" IS NULL', { id: asset.id, ownerId }).execute();
      const current = await assets.findOne({ select: ['id', 'publicToken'], where: { id: asset.id, ownerId } });
      asset.publicToken = current?.publicToken;
    }
    if (!asset.publicToken) continue;
    const src = `/api/media-public/${asset.publicToken}`;
    links.set(asset.id, src);
    if (asset.src !== src) await assets.update({ id: asset.id, ownerId }, { src });
  }
  return links;
}
