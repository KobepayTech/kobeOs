import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from './compress-image';

describe('photo selection compression', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('accepts a large source, scales its dimensions and releases the temporary URL', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:photo', revokeObjectURL });
    vi.stubGlobal('Image', class { naturalWidth = 4000; naturalHeight = 2000; onload?: () => void; set src(_v: string) { this.onload?.(); } });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['converted'], { type: 'image/webp' })));
    const result = await compressImage(new File([new Uint8Array(6 * 1024 * 1024)], 'large.png', { type: 'image/png' }));
    expect(result.name).toBe('large.webp');
    expect(result.type).toBe('image/webp');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 960);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });
  it('keeps video uploads intact', async () => {
    const video = new File(['video'], 'live.mp4', { type: 'video/mp4' });
    expect(await compressImage(video)).toBe(video);
  });
  it('releases the URL after an unsupported image fails to decode', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:bad', revokeObjectURL });
    vi.stubGlobal('Image', class { onerror?: () => void; set src(_v: string) { this.onerror?.(); } });
    await expect(compressImage(new File(['bad'], 'bad.png', { type: 'image/png' }))).rejects.toThrow('could not be opened');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:bad');
  });
});
