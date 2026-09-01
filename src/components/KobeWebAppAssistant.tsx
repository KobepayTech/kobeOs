import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import KobeAssistant from '@/apps/kobe-assistant';
import { getToken } from '@/lib/api';

export default function KobeWebAppAssistant({
  appId,
  contextLabel,
}: {
  appId: string;
  contextLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => !!getToken());

  useEffect(() => {
    const refresh = () => setAuthenticated(!!getToken());
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(refresh, 3000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authenticated]);

  if (!authenticated) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 right-0 top-0 w-full max-w-[430px] overflow-hidden border-l border-white/10 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20"
              title="Close Kobe AI (Ctrl+K)"
            >
              <X className="h-4 w-4" />
            </button>
            <KobeAssistant appId={appId} contextLabel={contextLabel} responseMode="quality" />
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[9997] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
          title="Ask Kobe AI (Ctrl+K)"
          aria-label="Ask Kobe AI"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute inset-0 rounded-full ring-2 ring-indigo-400/40 animate-ping" style={{ animationDuration: '3s' }} />
        </button>
      )}
    </>
  );
}
