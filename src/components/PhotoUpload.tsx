import { useCallback, useRef, useState } from 'react';
import { uploadFile, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

/**
 * Reusable photo upload — drag-drop, click-to-pick, or paste-URL. POSTs the
 * file to /api/media/upload?kind=photo and surfaces the returned src URL via
 * `onChange`. Used everywhere we used to ask the merchant to paste a URL
 * (product wizard, jersey design editor, etc.).
 */
export function PhotoUpload({
  value,
  onChange,
  label,
  aspect = 'square',
  className,
  maxBytes = 5 * 1024 * 1024,
}: {
  /** Current image URL (relative `/api/media/...` or absolute). */
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspect?: 'square' | 'banner';
  className?: string;
  maxBytes?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Pick an image file (JPG, PNG, WebP, …).');
        return;
      }
      if (file.size > maxBytes) {
        setError(`File too large — keep it under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const asset = await uploadFile<{ src: string }>('/media/upload?kind=photo', file);
        if (!asset?.src) throw new Error('Upload returned no src');
        onChange(asset.src);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [maxBytes, onChange],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handle(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handle(file);
    // reset so picking the same file again still triggers change
    if (fileRef.current) fileRef.current.value = '';
  };

  const aspectClass = aspect === 'banner' ? 'aspect-[16/6]' : 'aspect-square';
  const resolvedSrc = value
    ? value.startsWith('http')
      ? value
      : `${API_BASE}${value.startsWith('/api') ? value.slice(4) : value}`
    : null;

  return (
    <div className={className}>
      {label && <label className="text-xs text-white/60 block mb-1">{label}</label>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} />
      {resolvedSrc ? (
        <div className={`relative ${aspectClass} bg-slate-900/40 border border-white/10 rounded overflow-hidden`}>
          <img src={resolvedSrc} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
            <Button size="sm" type="button" variant="outline" onClick={() => fileRef.current?.click()} className="text-xs">
              <Camera className="w-3.5 h-3.5 mr-1" /> Replace
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => onChange(null)}
              className="text-xs border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`${aspectClass} flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-500/10 text-blue-200'
              : 'border-white/15 text-white/50 hover:border-white/25 hover:bg-white/[0.03]'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-6 h-6 opacity-50" />
              <span className="text-xs font-medium">Drop image or click to pick</span>
              <span className="text-[10px] opacity-50">JPG · PNG · WebP up to {Math.round(maxBytes / 1024 / 1024)} MB</span>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="text-[11px] text-rose-300 mt-1 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Paste an image URL:', value ?? '');
          if (url !== null) onChange(url || null);
        }}
        className="text-[10px] text-white/40 hover:text-white/70 mt-1 underline-offset-2 hover:underline inline-flex items-center gap-1"
      >
        <Upload className="w-3 h-3" /> or paste a URL
      </button>
    </div>
  );
}
