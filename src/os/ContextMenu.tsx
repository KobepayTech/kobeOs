import { useEffect, useRef } from 'react';
import type { ContextMenuItem } from './types';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    setTimeout(() => {
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(x, vw - 240);
  const top = Math.min(y, vh - items.length * 36 - 20);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] w-56 rounded-xl border border-white/10 bg-[#1e293b] shadow-2xl py-1.5 select-none"
      style={{ left, top }}
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="my-1 border-t border-white/[0.08]" />;
        }
        const Icon = item.icon
          ? (icons[item.icon as keyof typeof icons] as LucideIcon | undefined)
          : undefined;
        return (
          <button
            key={item.id}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-sm text-os-text-primary hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            onClick={() => {
              item.action();
              onClose();
            }}
            disabled={item.disabled}
          >
            {Icon && <Icon className="w-4 h-4 text-os-text-muted" />}
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-os-text-muted">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
