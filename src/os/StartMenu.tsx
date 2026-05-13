import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOSStore } from './store';

interface StartMenuProps {
  open: boolean;
  onClose: () => void;
}

export function StartMenu({ open, onClose }: StartMenuProps) {
  const { apps, settings, launchApp, pinApp, unpinApp } = useOSStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [apps, query]);

  const byCategory = useMemo(() => {
    const map: Record<string, typeof apps> = {};
    for (const app of filtered) {
      const cat = app.category;
      map[cat] = map[cat] ?? [];
      map[cat].push(app);
    }
    return map;
  }, [filtered]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed left-2 z-[250] w-[600px] max-w-[90vw] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(15,23,42,0.98)',
        backdropFilter: 'blur(30px)',
        bottom: 56,
        maxHeight: 520,
      }}
    >
      {/* Search */}
      <div className="p-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
          <icons.Search className="w-4 h-4 text-os-text-muted" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-os-text-primary placeholder:text-os-text-muted outline-none"
            placeholder="Type to search apps, files, and settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <icons.X className="w-4 h-4 text-os-text-muted hover:text-os-text-primary" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned */}
      {!query && (
        <div className="px-3 pb-2">
          <div className="text-xs font-semibold text-os-text-muted uppercase tracking-wider mb-2">
            Pinned
          </div>
          <div className="grid grid-cols-6 gap-2">
            {settings.pinnedApps.slice(0, 12).map((appId) => {
              const app = apps.find((a) => a.id === appId);
              if (!app) return null;
              const Icon = (icons[app.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.Circle;
              return (
                <button
                  key={appId}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors"
                  onClick={() => {
                    launchApp(appId);
                    onClose();
                  }}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5">
                    <Icon className="w-5 h-5 text-os-text-primary" />
                  </div>
                  <span className="text-[10px] text-os-text-secondary truncate max-w-full">{app.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* All apps */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {Object.entries(byCategory).map(([cat, list]) => (
          <div key={cat} className="mb-3">
            <div className="text-xs font-semibold text-os-text-muted uppercase tracking-wider mb-1 sticky top-0 bg-[#0f172a]/95 py-1">
              {cat}
            </div>
            <div className="flex flex-col gap-0.5">
              {list.map((app) => {
                const Icon = (icons[app.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.Circle;
                const pinned = settings.pinnedApps.includes(app.id);
                return (
                  <button
                    key={app.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
                    onClick={() => {
                      launchApp(app.id);
                      onClose();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (pinned) unpinApp(app.id);
                      else pinApp(app.id);
                    }}
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 shrink-0">
                      <Icon className="w-4 h-4 text-os-text-primary" />
                    </div>
                    <span className="text-sm text-os-text-primary flex-1">{app.name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/5 text-os-text-muted"
                    >
                      {app.version}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User */}
      <div className="px-3 py-2 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-os-accent/20 flex items-center justify-center">
            <icons.User className="w-4 h-4 text-os-accent" />
          </div>
          <div>
            <div className="text-sm font-medium text-os-text-primary">User</div>
            <div className="text-[10px] text-os-text-muted">Administrator</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <icons.Lock className="w-4 h-4 text-os-text-secondary" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <icons.Power className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
