import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { AlertTriangle, WifiOff, X } from 'lucide-react';

type SystemMode = 'healthy' | 'degraded' | 'critical';
interface SystemReport { mode: SystemMode; message: string }

const POLL_MS = 30_000;

/**
 * Safe-mode banner for the self-healing monitor. Polls GET /system/health and,
 * when the backend reports a degraded (AI offline) or critical (DB down) mode,
 * shows a calm, plain-language strip so the user knows what's happening and
 * that the system is recovering itself — instead of features failing silently.
 * Dismissible; reappears if the mode changes.
 */
export default function SafeModeBanner() {
  const [report, setReport] = useState<SystemReport | null>(null);
  const [dismissed, setDismissed] = useState<SystemMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const probe = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/health`, { headers: { accept: 'application/json' } });
        const ct = res.headers.get('content-type') ?? '';
        if (res.ok && ct.includes('application/json')) {
          const body = (await res.json().catch(() => null)) as SystemReport | null;
          if (!cancelled && body?.mode) setReport(body);
        }
      } catch { /* the DB-only poller already surfaces hard-offline */ }
      finally { if (!cancelled) timer = setTimeout(probe, POLL_MS); }
    };
    probe();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  // Clear a dismissal once the system returns to a different mode.
  const prevMode = useRef<SystemMode | null>(null);
  useEffect(() => {
    if (report && prevMode.current && report.mode !== prevMode.current) setDismissed(null);
    prevMode.current = report?.mode ?? null;
  }, [report]);

  if (!report || report.mode === 'healthy' || dismissed === report.mode) return null;

  const critical = report.mode === 'critical';
  return (
    <div className={`fixed top-0 inset-x-0 z-[9999] flex items-center gap-2 px-4 py-2 text-sm ${critical ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'}`}>
      {critical ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{report.message}</span>
      <button onClick={() => setDismissed(report.mode)} className="opacity-80 hover:opacity-100" title="Dismiss"><X className="w-4 h-4" /></button>
    </div>
  );
}
