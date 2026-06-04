import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, GripVertical, Eye, EyeOff, Trash2, Plus } from 'lucide-react';

export type HomepageSectionType =
  | 'hero'
  | 'categories'
  | 'best_sellers'
  | 'new_arrivals'
  | 'featured'
  | 'promotions'
  | 'clearance'
  | 'seasonal'
  | 'testimonials'
  | 'video'
  | 'blog'
  | 'contact'
  | 'map'
  | 'newsletter'
  | 'brands';

interface HomepageSection {
  id: string;
  sectionType: HomepageSectionType;
  order: number;
  visible: boolean;
  config: Record<string, unknown>;
}

const SECTION_LIBRARY: Array<{ type: HomepageSectionType; label: string; description: string }> = [
  { type: 'hero', label: 'Hero Banner', description: 'Large headline image at the top' },
  { type: 'categories', label: 'Categories Grid', description: 'Visual entry to each category' },
  { type: 'best_sellers', label: 'Best Sellers', description: 'Top-selling products' },
  { type: 'new_arrivals', label: 'New Arrivals', description: 'Recently added products' },
  { type: 'featured', label: 'Featured Products', description: 'Hand-picked products' },
  { type: 'promotions', label: 'Promotions', description: 'Discounted items' },
  { type: 'clearance', label: 'Clearance', description: 'Low stock at low price' },
  { type: 'seasonal', label: 'Seasonal', description: 'Seasonal tag filter' },
  { type: 'brands', label: 'Shop by Brand', description: 'Brand logo grid' },
  { type: 'testimonials', label: 'Testimonials', description: 'Customer reviews' },
  { type: 'video', label: 'Video', description: 'Embed a marketing video' },
  { type: 'blog', label: 'Blog Posts', description: 'Latest articles' },
  { type: 'contact', label: 'Contact Block', description: 'Phone, email, hours' },
  { type: 'map', label: 'Map', description: 'Embedded location map' },
  { type: 'newsletter', label: 'Newsletter', description: 'Email signup' },
];

export function HomepageSectionBuilder() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<HomepageSection[]>('/storefront/sections');
      setSections([...(rows ?? [])].sort((a, b) => a.order - b.order));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addSection = async (sectionType: HomepageSectionType) => {
    try {
      const created = await api<HomepageSection>('/storefront/sections', {
        method: 'POST',
        body: JSON.stringify({ sectionType }),
      });
      setSections((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add section');
    }
  };

  const toggleVisible = async (s: HomepageSection) => {
    try {
      const updated = await api<HomepageSection>(`/storefront/sections/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ visible: !s.visible }),
      });
      setSections((prev) => prev.map((row) => (row.id === s.id ? updated : row)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle');
    }
  };

  const removeSection = async (s: HomepageSection) => {
    if (!window.confirm(`Remove "${labelFor(s.sectionType)}" section?`)) return;
    try {
      await api(`/storefront/sections/${s.id}`, { method: 'DELETE' });
      setSections((prev) => prev.filter((row) => row.id !== s.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const onDragStart = (id: string) => () => {
    dragId.current = id;
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (targetId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const ordered = [...sections];
    const srcIdx = ordered.findIndex((s) => s.id === sourceId);
    const tgtIdx = ordered.findIndex((s) => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = ordered.splice(srcIdx, 1);
    ordered.splice(tgtIdx, 0, moved);
    setSections(ordered.map((s, i) => ({ ...s, order: i })));
    try {
      await api('/storefront/sections/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds: ordered.map((s) => s.id) }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order');
      // Restore on failure
      load();
    }
  };

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading sections…
        </div>
      )}
      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1">{error}</div>}

      {!loading &&
        sections.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={onDragStart(s.id)}
            onDragOver={onDragOver}
            onDrop={onDrop(s.id)}
            className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/40 border border-slate-700/60 rounded-md hover:border-slate-600 transition-colors cursor-move"
          >
            <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-xs text-white/85 flex-1 truncate">{labelFor(s.sectionType)}</span>
            <button onClick={() => toggleVisible(s)} className="text-slate-400 hover:text-white" title={s.visible ? 'Hide' : 'Show'}>
              {s.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => removeSection(s)} className="text-slate-400 hover:text-rose-300" title="Remove">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

      {!loading && !sections.length && (
        <div className="text-xs text-white/40 text-center py-3">
          No sections yet. Apply an industry template, or add sections below.
        </div>
      )}

      <div className="pt-2">
        {!adding ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="h-7 text-xs w-full">
            <Plus className="w-3 h-3 mr-1" /> Add section
          </Button>
        ) : (
          <div className="space-y-1 border border-slate-700/60 rounded-md p-2 max-h-48 overflow-y-auto">
            {SECTION_LIBRARY.filter((opt) => !sections.some((s) => s.sectionType === opt.type)).map((opt) => (
              <button
                key={opt.type}
                onClick={() => addSection(opt.type)}
                className="w-full text-left px-2 py-1 rounded text-xs hover:bg-slate-700/40"
              >
                <div className="text-white/85">{opt.label}</div>
                <div className="text-white/40 text-[10px]">{opt.description}</div>
              </button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-6 text-[11px] w-full text-white/50">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function labelFor(type: HomepageSectionType) {
  return SECTION_LIBRARY.find((s) => s.type === type)?.label ?? type;
}

// ── Industry template picker ─────────────────────────────────────────────────

export interface IndustryTemplate {
  code: string;
  name: string;
  description: string;
  iconKey: string;
  defaultCategories: string[];
}

export function IndustryTemplatePicker({ onApplied }: { onApplied?: () => void }) {
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api<IndustryTemplate[]>('/storefront/templates')
      .then((rows) => setTemplates(rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  const apply = async (code: string) => {
    if (!window.confirm('Applying a template will replace your current homepage sections. Continue?')) return;
    setApplying(code);
    setError(null);
    setSuccess(null);
    try {
      await api(`/storefront/templates/${encodeURIComponent(code)}/apply`, { method: 'POST' });
      setSuccess(`Template "${code}" applied.`);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply template');
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/50">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading templates…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1">{error}</div>}
      {success && <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">{success}</div>}
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t) => (
          <button
            key={t.code}
            onClick={() => apply(t.code)}
            disabled={applying === t.code}
            className="text-left p-2 bg-slate-800/40 border border-slate-700/60 rounded-md hover:border-blue-500/50 disabled:opacity-60"
          >
            <div className="text-xs font-medium text-white/90">{t.name}</div>
            <div className="text-[10px] text-white/40 mt-0.5 line-clamp-2">{t.description}</div>
            <div className="text-[10px] text-white/30 mt-1">{t.defaultCategories.slice(0, 3).join(' · ')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
