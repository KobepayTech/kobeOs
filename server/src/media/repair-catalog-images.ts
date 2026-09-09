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
export async function repairCatalogImages(repo: Repository<PosProduct>, ownerId: string, rows: PosProduct[], retry = false) {
  const legacyId = (url: string | null | undefined) => /^\/api\/media\/blob\/([a-f0-9-]{36})$/i.exec(url || '')?.[1];
  const source = (row: PosProduct) => JSON.stringify([row.imageUrl ?? null, row.imageUrls || []]);
  const pending = rows.filter(row => row.ownerId === ownerId && (retry || row.photoRepair?.source !== source(row)));
  const ids = [...new Set(pending.flatMap((row) => [row.imageUrl, ...(row.imageUrls || [])]).map(legacyId).filter((id): id is string => !!id))];
  if (!ids.length) return rows;
  if (retry) for (const id of ids) unresolvable.delete(`${ownerId}:${id}`);
  const links = await publicPhotoLinks(repo.manager.getRepository(MediaAsset), ownerId, ids);
  const resolve = (url: string) => links.get(legacyId(url) || '') || url;
  for (const row of pending) {
    const imageUrl = row.imageUrl ? resolve(row.imageUrl) : row.imageUrl;
    const imageUrls = (row.imageUrls || []).map(resolve);
    const photoRepair = { source: JSON.stringify([imageUrl ?? null, imageUrls]),
      unresolved: [imageUrl, ...imageUrls].filter((url): url is string => !!legacyId(url)), checkedAt: new Date().toISOString() };
    // One atomic compare-and-swap preserves concurrent gallery edits and saves
    // misses durably. A restart or cache expiry no longer repeats the lookup.
    const result = await repo.createQueryBuilder().update().set({ imageUrl, imageUrls, photoRepair })
      .where('id = :id AND "ownerId" = :ownerId AND "imageUrl" IS NOT DISTINCT FROM :old AND COALESCE("imageUrls", \'[]\'::jsonb) = :oldGallery::jsonb',
        { id: row.id, ownerId, old: row.imageUrl ?? null, oldGallery: JSON.stringify(row.imageUrls || []) }).execute();
    if (result?.affected === 1) Object.assign(row, { imageUrl, imageUrls, photoRepair });
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
