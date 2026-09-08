import sharp from 'sharp';
import { optimizePhoto } from './optimize-photo';

describe('ERP photo conversion', () => {
  it('converts a large transparent PNG within the shared size budget', async () => {
    const input = await sharp({ create: { width: 4000, height: 2500, channels: 4, background: { r: 100, g: 150, b: 200, alpha: 0.5 } } }).png().toBuffer();
    const photo = await optimizePhoto({ originalname: 'product.png', mimetype: 'image/png', buffer: input, size: input.length });
    const meta = await sharp(photo.buffer).metadata();
    expect(photo.mimetype).toBe('image/webp');
    expect(photo.originalname).toBe('product.webp');
    expect(photo.size).toBe(photo.buffer.length);
    expect(photo.size).toBeLessThanOrEqual(1024 * 1024);
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1200);
    expect(meta.hasAlpha).toBe(true);
  });
  it('rejects corrupt photos instead of storing a broken image', async () => {
    await expect(optimizePhoto({ originalname: 'bad.png', mimetype: 'image/png', buffer: Buffer.from('not an image'), size: 12 })).rejects.toThrow('could not be converted');
  });
});
