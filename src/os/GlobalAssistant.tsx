import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import KobeAssistant from '@/apps/kobe-assistant';
import { useOSStore } from './store';

/**
 * Global AI co-pilot available inside EVERY module. Renders a floating button
 * over the whole OS; clicking it slides in the Ask Kobe chat as an overlay
 * panel on top of whatever app is open. It reuses the same cross-module agent
 * (sales, tenants, stock, hotel, cargo, expenses + confirm-gated write
 * actions), so users get a functional assistant everywhere without each module
 * having to embed its own chat.
 *
 * Optionally context-aware: the focused window's title is passed to the chat
 * so the assistant knows which module the user is working in.
 */
export function GlobalAssistant() {
  const [open, setOpen] = useState(false);
  const windows = useOSStore((s) => s.windows);
  const focused = windows.find((w) => w.isFocused && !w.isMinimized);
  const contextLabel = focused?.title;
  const contextAppId = focused?.appId;

  // Ctrl/Cmd + K toggles the assistant from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Slide-over chat panel — sits above app windows, below the taskbar. */}
      {open && (
        <div className="fixed inset-0 z-[9998]" style={{ height: 'calc(100% - 80px)' }}>
          {/* Click-away backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] shadow-2xl border-l border-white/10 overflow-hidden rounded-l-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 w-7 h-7 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white/80"
              title="Close (Ctrl+K)"
            >
              <X className="w-4 h-4" />
            </button>
            <KobeAssistant contextLabel={contextLabel} appId={contextAppId} />
          </div>
        </div>
      )}

      {/* Floating co-pilot button — always visible, over any module. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-6 z-[9997] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl grid place-items-center hover:scale-105 active:scale-95 transition-transform"
          title="Ask Kobe AI (Ctrl+K)"
        >
          <Sparkles className="w-6 h-6" />
          <span className="absolute inset-0 rounded-full ring-2 ring-indigo-400/40 animate-ping" style={{ animationDuration: '3s' }} />
        </button>
      )}
    </>
  );
}
