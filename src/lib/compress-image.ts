/** Product photos share a 1920px / 1MB budget across ERP uploads. */
export const IMAGE_MAX_BYTES = 1024 * 1024;
export const IMAGE_MAX_EDGE = 1920;

export async function compressImage(file: File, maxBytes = IMAGE_MAX_BYTES): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size > 40 * 1024 * 1024) throw new Error('Choose an image smaller than 40 MB.');
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Invalid image size limit.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('This image format could not be opened. Export it as JPG, PNG or WebP and try again.'));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('The selected image is empty.');
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    let width = Math.max(1, Math.round(img.naturalWidth * scale));
    let height = Math.max(1, Math.round(img.naturalHeight * scale));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image resizing is unavailable in this browser.');
      context.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('Could not compress the image.')),
        'image/webp', Math.max(0.55, 0.85 - attempt * 0.06),
      ));
      if (blob.size <= maxBytes) {
        const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${extension}`, { type: blob.type, lastModified: file.lastModified });
      }
      width = Math.max(1, Math.floor(width * 0.8));
      height = Math.max(1, Math.floor(height * 0.8));
    }
    throw new Error('Could not fit this image. Please choose a smaller photo.');
  } finally { URL.revokeObjectURL(url); }
}
