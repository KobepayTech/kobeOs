import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export async function optimizePhoto(file: { originalname: string; mimetype: string; buffer: Buffer; size: number }) {
  try {
    let width = 1920;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const buffer = await sharp(file.buffer, { limitInputPixels: 80_000_000 })
        .rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: Math.max(55, 85 - attempt * 6) }).toBuffer();
      if (buffer.length <= 1024 * 1024) return {
        ...file, buffer, size: buffer.length, mimetype: 'image/webp',
        originalname: `${file.originalname.replace(/\.[^.]+$/, '') || 'photo'}.webp`,
      };
      width = Math.floor(width * 0.8);
    }
    throw new Error('size');
  } catch {
    throw new BadRequestException('This photo could not be converted. Choose a JPG, PNG or WebP image up to 80 megapixels.');
  }
}
