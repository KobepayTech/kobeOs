import { Injectable, Logger } from '@nestjs/common';

/**
 * Offline image-editing primitives via @huggingface/transformers + sharp.
 *
 * Currently exposes one feature — background removal — using BRIA AI's
 * RMBG-1.4 (https://huggingface.co/briaai/RMBG-1.4), which is a u²-Net
 * architecture trained on a much larger dataset than the original u²-Net
 * release. KobeOS also catalogues `Xenova/u2net` (strict MIT) for users
 * who can't use RMBG's "non-commercial" community licence.
 *
 * Output is a PNG with a transparent alpha channel — drop-in for product
 * photos, storefront banners, ID-card mockups, etc. First use downloads
 * the ONNX weights (~170 MB) to the HF cache; later calls are local.
 */

type ModelKey = 'briaai/RMBG-1.4' | 'Xenova/u2net';

interface RawImageLike {
  data: Uint8Array | Uint8ClampedArray | Float32Array;
  width: number;
  height: number;
  channels: number;
}

interface ModelOutputTensor { data: Float32Array; dims: number[] }

interface PixelValuesTensor { data: Float32Array; dims: number[] }

interface RawImageStatic {
  read: (input: Buffer | string) => Promise<RawImageLike>;
}

type ModelHandle = (inputs: Record<string, unknown>) => Promise<Record<string, ModelOutputTensor>>;

interface AutoModelStatic {
  from_pretrained: (id: string, options?: Record<string, unknown>) => Promise<ModelHandle>;
}

interface AutoProcessorStatic {
  from_pretrained: (id: string, options?: Record<string, unknown>) => Promise<(image: RawImageLike) => Promise<{ pixel_values: PixelValuesTensor }>>;
}

interface TransformersModule {
  RawImage: RawImageStatic;
  AutoModel: AutoModelStatic;
  AutoProcessor: AutoProcessorStatic;
}

type SharpFactory = (input: Buffer) => SharpInstance;

interface SharpInstance {
  resize: (w: number, h: number, opts?: Record<string, unknown>) => SharpInstance;
  raw: () => SharpInstance;
  ensureAlpha: () => SharpInstance;
  joinChannel: (input: Buffer, opts?: Record<string, unknown>) => SharpInstance;
  png: () => SharpInstance;
  metadata: () => Promise<{ width?: number; height?: number; channels?: number }>;
  toBuffer: () => Promise<Buffer>;
}

interface CachedModel {
  model: ModelHandle;
  processor: (image: RawImageLike) => Promise<{ pixel_values: PixelValuesTensor }>;
  transformers: TransformersModule;
  sharp: SharpFactory;
}

@Injectable()
export class ImageEditService {
  private readonly logger = new Logger('ImageEditService');
  private modelHandles = new Map<ModelKey, Promise<CachedModel>>();

  /**
   * Remove the background of an image and return a PNG with an alpha
   * channel. Default is briaai/RMBG-1.4 (best quality); pass
   * model='Xenova/u2net' if you need strict MIT.
   */
  async removeBackground(buffer: Buffer, model: ModelKey = 'briaai/RMBG-1.4'): Promise<Buffer> {
    const handles = await this._getModel(model);
    const { model: rmbg, processor, transformers, sharp } = handles;

    const meta = await sharp(buffer).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;
    if (!origW || !origH) throw new Error('Could not read image dimensions');

    // Run the segmenter at the model's native input resolution.
    const image = await transformers.RawImage.read(buffer);
    const { pixel_values } = await processor(image);
    const output = await rmbg({ input: pixel_values });
    const maskTensor = output.output ?? Object.values(output)[0];
    if (!maskTensor?.data || maskTensor.dims.length < 2) {
      throw new Error('Background-removal model returned no usable mask');
    }
    const dims = maskTensor.dims;
    const maskH = dims[dims.length - 2];
    const maskW = dims[dims.length - 1];

    // Convert the float mask to an 8-bit grayscale buffer.
    const maskRaw = Buffer.alloc(maskW * maskH);
    for (let i = 0; i < maskRaw.length; i++) {
      const v = Math.max(0, Math.min(1, maskTensor.data[i] ?? 0));
      maskRaw[i] = Math.round(v * 255);
    }

    // Resize the mask back to the original image size as a 1-channel raw
    // buffer, then join it onto the source as the alpha channel.
    const alphaResized = (await sharp(maskRaw)
      .resize(origW, origH, { fit: 'fill', raw: { width: maskW, height: maskH, channels: 1 } } as Record<string, unknown>)
      .raw()
      .toBuffer()) as Buffer;

    return (await sharp(buffer)
      .ensureAlpha()
      .joinChannel(alphaResized, { raw: { width: origW, height: origH, channels: 1 } })
      .png()
      .toBuffer()) as Buffer;
  }

  private _getModel(key: ModelKey) {
    const existing = this.modelHandles.get(key);
    if (existing) return existing;
    const promise = this._loadModel(key).catch((err) => {
      this.modelHandles.delete(key);
      throw err;
    });
    this.modelHandles.set(key, promise);
    return promise;
  }

  private async _loadModel(key: ModelKey): Promise<CachedModel> {
    const transformersPkg = '@huggingface/transformers';
    const sharpPkg = 'sharp';
    const transformers = (await import(transformersPkg)) as unknown as TransformersModule;
    const sharpMod = (await import(sharpPkg)) as unknown as { default: SharpFactory } & SharpFactory;
    if (!transformers?.AutoModel || !transformers?.AutoProcessor || !transformers?.RawImage) {
      throw new Error('@huggingface/transformers is not installed. Run `npm install @huggingface/transformers` in server/.');
    }
    const sharp = sharpMod.default ?? sharpMod;
    if (typeof sharp !== 'function') {
      throw new Error('sharp is not installed. Run `npm install sharp` in server/.');
    }
    this.logger.log(`Loading background-removal model "${key}" — first use downloads ~170 MB to the HF cache`);
    const [model, processor] = await Promise.all([
      transformers.AutoModel.from_pretrained(key, { config: { model_type: 'custom' } }),
      transformers.AutoProcessor.from_pretrained(key, {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        },
      }),
    ]);
    return { model, processor, transformers, sharp };
  }
}
