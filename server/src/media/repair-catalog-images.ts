import { randomBytes } from 'crypto';
import { In, IsNull, Not, Repository } from 'typeorm';
import { MediaAsset } from './media.entity';
import { PosProduct } from '../pos/pos.entity';

/**
 * References this repair cannot resolve — the asset was deleted, belongs to
 * another owner, or is not a photo. Without this the product row keeps its
 * legacy URL forever, so every later read re-runs the lookup: a single dead
 * reference would cost one extra query on every public storefront page view,
 * permanently. Remembering the misses turns that into one query per process.
 */
const unresolvable = new Map<string, number>();
const UNRESOLVABLE_TTL_MS = 60 * 60 * 1000;
const UNRESOLVABLE_MAX = 10_000;

function skip(ownerId: string, id: string) {
  const seenAt = unresolvable.get(`${ownerId}:${id}`);
  if (seenAt === undefined) return false;
  // Re-check hourly so a reference repaired out of band recovers on its own.
  if (Date.now() - seenAt < UNRESOLVABLE_TTL_MS) return true;
  unresolvable.delete(`${ownerId}:${id}`);
  return false;
}

function remember(ownerId: string, ids: string[]) {
  if (unresolvable.size + ids.length > UNRESOLVABLE_MAX) unresolvable.clear();
  for (const id of ids) unresolvable.set(`${ownerId}:${id}`, Date.now());
}

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

export async function publicPhotoLinks(assets: Repository<MediaAsset>, ownerId: string, requested: string[]) {
  const ids = requested.filter((id) => !skip(ownerId, id));
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
  remember(ownerId, ids.filter((id) => !links.has(id)));
  return links;
}
