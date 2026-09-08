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
  it('blames the server, not the seller, when conversion itself breaks', async () => {
    // The photo decodes; the encode is what fails. Reporting that as "choose a
    // JPG, PNG or WebP" would send the seller re-exporting a valid file.
    const input = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer();
    const proto: { webp: (...args: unknown[]) => unknown } = sharp.prototype;
    const original = proto.webp;
    proto.webp = () => { throw new Error('vips: unable to load shared library'); };
    try {
      const failing = optimizePhoto({ originalname: 'ok.png', mimetype: 'image/png', buffer: input, size: input.length });
      await expect(failing).rejects.toThrow('Photo conversion is unavailable on this server');
      await expect(failing).rejects.toMatchObject({ status: 500 });
    } finally { proto.webp = original; }
  });
});
