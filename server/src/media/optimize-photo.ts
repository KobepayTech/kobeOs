import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import sharp from 'sharp';

const logger = new Logger('optimizePhoto');
const MAX_BYTES = 1024 * 1024;

/**
 * Only the caller's file can be blamed for a decode failure. Everything else —
 * a sharp native binary that did not load on the origin, an out-of-memory
 * encode, a disk fault — is our problem, and reporting it as "choose a JPG,
 * PNG or WebP" sends the seller off re-exporting a photo that was fine. That
 * matters most on the Windows origin, where a broken sharp install would
 * otherwise turn every upload in KobeOS into a message blaming the seller.
 */
export async function optimizePhoto(file: { originalname: string; mimetype: string; buffer: Buffer; size: number }) {
  // Decode first and on its own, so an unreadable upload is distinguishable
  // from a conversion pipeline that is itself broken.
  try {
    await sharp(file.buffer, { limitInputPixels: 80_000_000 }).metadata();
  } catch (cause) {
    throw new BadRequestException('This photo could not be converted. Choose a JPG, PNG or WebP image up to 80 megapixels.', { cause });
  }

  let width = 1920;
  let smallest = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let buffer: Buffer;
    try {
      buffer = await sharp(file.buffer, { limitInputPixels: 80_000_000 })
        .rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: Math.max(55, 85 - attempt * 6) }).toBuffer();
    } catch (cause) {
      // The image decoded a moment ago, so this is the server failing, not the
      // upload. Surface it as a 500 and log it — silently returning a 400 here
      // is what hides a broken sharp install behind a user-blaming message.
      logger.error(`Photo conversion failed at width ${width}: ${(cause as Error)?.message}`);
      throw new InternalServerErrorException('Photo conversion is unavailable on this server. Contact support — your photo is fine.', { cause });
    }
    if (buffer.length <= MAX_BYTES) return {
      ...file, buffer, size: buffer.length, mimetype: 'image/webp',
      originalname: `${file.originalname.replace(/\.[^.]+$/, '') || 'photo'}.webp`,
    };
    smallest = Math.min(smallest, buffer.length);
    width = Math.floor(width * 0.8);
  }
  throw new BadRequestException(
    `This photo is still ${Math.ceil(smallest / 1024 / 1024)} MB after compression. Crop it or save it at a lower quality, then upload again.`,
  );
}
