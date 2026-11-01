import { useEffect, useState, type ReactNode } from 'react';

/** Shared storefront navigation. Modes are views over the same inventory/cart, not separate shops. */
export type ShoppingMode = 'discover' | 'classic' | 'immersive' | 'live' | 'ai';
export const SHOPPING_MODES: ReadonlyArray<{ id: ShoppingMode; label: string; description: string }> = [
  { id: 'discover', label: 'Explore', description: 'Personalized discovery and shoppable videos' },
  { id: 'classic', label: 'Catalog', description: 'Search, categories and product grid' },
  { id: 'immersive', label: 'Showroom', description: 'Interactive product experiences' },
  { id: 'live', label: 'Watch', description: 'Live demonstrations and pinned products' },
  { id: 'ai', label: 'Ask AI', description: 'Conversational product discovery' },
];
export type ShoppingModeAvailability = Partial<Record<ShoppingMode, boolean>>;
interface Props {
  storeId: string;
  views: Partial<Record<ShoppingMode, ReactNode>>;
  enabled?: ShoppingModeAvailability;
  defaultMode?: ShoppingMode;
  className?: string;
}
export function MultiModeStorefront({ storeId, views, enabled = {}, defaultMode = 'discover', className = '' }: Props) {
  const available = SHOPPING_MODES.filter(({ id }) => enabled[id] !== false && views[id] != null);
  const storageKey = `kobe:store:${storeId}:shopping-mode`;
  const [mode, setMode] = useState<ShoppingMode>(defaultMode);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey) as ShoppingMode | null;
      setMode(saved && available.some((item) => item.id === saved) ? saved : available.some((item) => item.id === defaultMode) ? defaultMode : available[0]?.id ?? 'classic');
    } catch {
      setMode(available.some((item) => item.id === defaultMode) ? defaultMode : available[0]?.id ?? 'classic');
    }
  // Availability changes should also trigger a valid fallback.
  }, [storageKey, defaultMode, available.map((item) => item.id).join(',')]);
  const select = (next: ShoppingMode) => {
    setMode(next);
    try { window.localStorage.setItem(storageKey, next); } catch { /* private browsing */ }
  };
  const current = available.some((item) => item.id === mode) ? mode : available[0]?.id;
  if (!current) return null;
  return (
    <section className={className} aria-label="Store shopping experience">
      <nav aria-label="Choose shopping experience" className="flex gap-2 overflow-x-auto pb-3">
        {available.map(({ id, label, description }) => (
          <button key={id} type="button" onClick={() => select(id)} aria-pressed={current === id}
            title={description}
            className={`rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors ${current === id ? 'bg-white text-slate-950 border-white' : 'border-slate-500 text-inherit hover:border-white'}`}>
            {label}
          </button>
        ))}
      </nav>
      <div key={current} data-shopping-mode={current}>{views[current]}</div>
    </section>
  );
}
