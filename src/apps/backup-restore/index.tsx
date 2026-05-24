import { useRef, useState } from 'react';
import { Database, Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; message?: string };

export default function BackupRestoreApp() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    setStatus({ kind: 'busy', message: 'Exporting your data…' });
    try {
      await ensureSession();
      const dump = await api<{ data: Record<string, unknown[]> }>('/account/export');
      const rows = Object.values(dump.data ?? {}).reduce((n, r) => n + (Array.isArray(r) ? r.length : 0), 0);
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kobeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: 'ok', message: `Exported ${rows} record${rows === 1 ? '' : 's'}.` });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Export failed' });
    }
  };

  const onFile = async (file: File) => {
    setStatus({ kind: 'busy', message: 'Restoring from backup…' });
    try {
      const parsed = JSON.parse(await file.text());
      await ensureSession();
      const res = await api<{ imported: number }>('/account/import', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setStatus({ kind: 'ok', message: `Restored ${res.imported} record${res.imported === 1 ? '' : 's'}. Reopen apps to see them.` });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Restore failed — is this a valid backup file?' });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const busy = status.kind === 'busy';

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100 p-6 gap-5 overflow-auto">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="text-lg font-semibold">Backup &amp; Restore</h1>
          <p className="text-xs text-slate-400">Export all your KOBE OS data to a file, or restore it from one.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3">
          <Download className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="text-sm font-medium">Export</div>
            <div className="text-xs text-slate-400">Download a JSON snapshot of everything you own.</div>
          </div>
          <button
            onClick={exportData}
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export my data
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3">
          <Upload className="h-5 w-5 text-blue-400" />
          <div>
            <div className="text-sm font-medium">Restore</div>
            <div className="text-xs text-slate-400">Load a backup file. Existing records with the same id are updated.</div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choose backup file…
          </button>
        </div>
      </div>

      {(status.kind === 'ok' || status.kind === 'error') && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            status.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
          }`}
        >
          {status.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <span>{status.message}</span>
        </div>
      )}
      {busy && <div className="text-xs text-slate-400">{status.message}</div>}
    </div>
  );
}
