import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Images, Loader2, Search, Sparkles, UploadCloud, X } from 'lucide-react';
import { API_BASE, api, apiArray, apiObject, getToken } from '@/lib/api';

export interface ProductImageSuggestion {
  name?: string;
  category?: string;
  description?: string;
  tags?: string[];
}

interface StoreMediaItem {
  id: string;
  originalName: string;
  url: string;
  status: string;
  category?: string;
  metadata?: Record<string, unknown>;
  aiSuggestions?: Record<string, unknown>;
}

export interface StoreMediaSelection {
  url: string;
  suggestion: ProductImageSuggestion;
}

function displayName(filename: string) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveStoreMediaUrl(value: string) {
  if (!value || /^https?:|^blob:|^data:/i.test(value)) return value;
  if (value.startsWith('/api') && API_BASE.endsWith('/api')) return `${API_BASE}${value.slice(4)}`;
  return `${API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

function existingSuggestion(item: StoreMediaItem): ProductImageSuggestion {
  const values = { ...(item.aiSuggestions ?? {}), ...(item.metadata ?? {}) };
  return {
    name: String(values.name || displayName(item.originalName) || ''),
    category: String(values.category || item.category || ''),
    description: String(values.description || ''),
    tags: Array.isArray(values.tags)
      ? values.tags.map((tag) => String(tag)).filter(Boolean)
      : String(values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

async function imageBase64(item: StoreMediaItem) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(resolveStoreMediaUrl(item.url), { headers });
  if (!response.ok) throw new Error(`Could not read image (${response.status})`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(blob);
  });
}

export function StoreMediaGallery({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: StoreMediaSelection) => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<StoreMediaItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api<unknown>('/media/inbox', { offlineFallback: false });
      setItems(apiArray<StoreMediaItem>(response));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the store gallery.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) =>
      [item.originalName, item.category, item.metadata?.name]
        .some((field) => String(field || '').toLowerCase().includes(value)));
  }, [items, query]);

  if (!open) return null;
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const upload = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      images.forEach((file) => form.append('files', file));
      await api('/media/inbox/upload', {
        method: 'POST',
        body: form,
        offlineFallback: false,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const choose = async (fillWithAi: boolean) => {
    if (!selected) return;
    let suggestion = fillWithAi ? existingSuggestion(selected) : {};
    if (fillWithAi) {
      setAnalysing(true);
      setError('');
      try {
        const image = await imageBase64(selected);
        const response = await api<unknown>('/ai/vision/product', {
          method: 'POST',
          body: JSON.stringify({ image }),
          offlineFallback: false,
        });
        const ai = apiObject<ProductImageSuggestion>(response);
        if (ai) suggestion = { ...suggestion, ...ai };
      } catch (reason) {
        setError(
          `${reason instanceof Error ? reason.message : 'AI could not read this image.'} The saved gallery details will be used instead.`,
        );
      } finally {
        setAnalysing(false);
      }
    }
    onSelect({ url: selected.url, suggestion });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10100] grid place-items-center bg-slate-950/65 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Images className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black">Store image gallery</h2>
            <p className="text-[11px] text-slate-500">Choose a saved image or upload new product photos.</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-100 p-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved images"
              className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.currentTarget.value = '';
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid h-64 place-items-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      active ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <img
                      src={resolveStoreMediaUrl(item.url)}
                      alt={item.originalName}
                      className="aspect-square w-full bg-slate-100 object-cover"
                    />
                    <div className="p-2">
                      <p className="truncate text-xs font-black">{existingSuggestion(item).name}</p>
                      <p className="mt-0.5 truncate text-[9px] text-slate-400">{item.status.toLowerCase()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid h-64 place-items-center text-center text-slate-400">
              <div>
                <ImagePlus className="mx-auto h-9 w-9" />
                <p className="mt-2 text-sm font-bold">No saved images yet</p>
                <p className="text-xs">Upload product images to start the gallery.</p>
              </div>
            </div>
          )}
        </div>

        {error && <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">{error}</div>}

        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-4">
          <button
            onClick={() => void choose(false)}
            disabled={!selected || analysing}
            className="h-11 rounded-xl border border-slate-200 text-xs font-black text-slate-600 disabled:opacity-40"
          >
            Use image only
          </button>
          <button
            onClick={() => void choose(true)}
            disabled={!selected || analysing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-black text-white disabled:opacity-40"
          >
            {analysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysing ? 'Reading product…' : 'Use & fill details'}
          </button>
        </div>
      </div>
    </div>
  );
}
