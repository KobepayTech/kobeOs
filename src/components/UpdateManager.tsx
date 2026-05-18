import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type UpdateEvent =
  | { event: 'checking' }
  | { event: 'available'; version: string; releaseNotes?: string; releaseDate?: string }
  | { event: 'not-available'; currentVersion: string }
  | { event: 'progress'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { event: 'downloaded'; version: string }
  | { event: 'error'; message: string };

interface UpdaterStatus {
  currentVersion: string;
  hasBackup: boolean;
  bootOk: boolean;
  backupVersion: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtSpeed(bps: number) {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UpdateManager() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [phase, setPhase] = useState<UpdateEvent['event'] | 'idle'>('idle');
  const [available, setAvailable] = useState<{ version: string; releaseNotes?: string; releaseDate?: string } | null>(null);
  const [progress, setProgress] = useState<{ percent: number; transferred: number; total: number; bytesPerSecond: number } | null>(null);
  const [downloaded, setDownloaded] = useState<{ version: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollbackConfirm, setRollbackConfirm] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!window.kobeOS?.updater;

  // Load status on mount
  useEffect(() => {
    if (!isElectron) return;
    window.kobeOS.updater?.status().then(setStatus).catch(() => null);
  }, [isElectron]);

  // Subscribe to update events
  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.kobeOS.updater?.onEvent((ev: UpdateEvent) => {
      setPhase(ev.event);
      setError(null);
      if (ev.event === 'available') {
        setAvailable({ version: ev.version, releaseNotes: ev.releaseNotes, releaseDate: ev.releaseDate });
        setProgress(null);
      }
      if (ev.event === 'progress') {
        setProgress({ percent: ev.percent, transferred: ev.transferred, total: ev.total, bytesPerSecond: ev.bytesPerSecond });
      }
      if (ev.event === 'downloaded') {
        setDownloaded({ version: ev.version });
        setProgress(null);
        setBusy(false);
      }
      if (ev.event === 'error') {
        setError(ev.message);
        setBusy(false);
      }
      if (ev.event === 'not-available') {
        setBusy(false);
      }
    });
    return unsub;
  }, [isElectron]);

  const handleCheck = useCallback(async () => {
    if (!isElectron) return;
    setBusy(true);
    setError(null);
    setPhase('checking');
    setAvailable(null);
    setDownloaded(null);
    await window.kobeOS.updater?.check().catch((e: Error) => setError(e.message));
  }, [isElectron]);

  const handleDownload = useCallback(async () => {
    if (!isElectron) return;
    setBusy(true);
    setError(null);
    await window.kobeOS.updater?.download().catch((e: Error) => { setError(e.message); setBusy(false); });
  }, [isElectron]);

  const handleInstall = useCallback(() => {
    if (!isElectron) return;
    window.kobeOS.updater?.install();
  }, [isElectron]);

  const handleRollback = useCallback(async () => {
    if (!isElectron) return;
    setBusy(true);
    setError(null);
    const result = await window.kobeOS.updater?.rollback().catch((e: Error) => ({ success: false, error: e.message }));
    if (!result?.success) {
      setError(result?.error ?? 'Rollback failed');
      setBusy(false);
    }
    // On success the app relaunches — no further UI update needed
  }, [isElectron]);

  if (!isElectron) {
    return (
      <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-sm text-os-text-muted">
        Remote updates are only available in the installed Electron app.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current version + backup info */}
      <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-os-text-muted">Current version</span>
          <span className="font-mono font-semibold text-white">v{status?.currentVersion ?? '…'}</span>
        </div>
        {status?.hasBackup && (
          <div className="flex items-center justify-between">
            <span className="text-os-text-muted">Backup version</span>
            <span className="font-mono text-os-text-secondary">v{status.backupVersion ?? '?'}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-os-text-muted">Boot health</span>
          <span className={status?.bootOk ? 'text-green-400' : 'text-yellow-400'}>
            {status?.bootOk ? '✅ Healthy' : '⚠️ Unverified'}
          </span>
        </div>
      </div>

      {/* Status / progress */}
      {phase === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-os-text-muted">
          <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
          Checking for updates…
        </div>
      )}

      {phase === 'not-available' && !error && (
        <div className="text-sm text-green-400">✅ You're on the latest version.</div>
      )}

      {available && phase !== 'progress' && !downloaded && (
        <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-300">Update available — v{available.version}</span>
            {available.releaseDate && (
              <span className="text-xs text-os-text-muted">
                {new Date(available.releaseDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {available.releaseNotes && (
            <p className="text-xs text-os-text-secondary leading-relaxed line-clamp-3">
              {typeof available.releaseNotes === 'string'
                ? available.releaseNotes.replace(/<[^>]+>/g, '')
                : ''}
            </p>
          )}
          <button
            onClick={handleDownload}
            disabled={busy}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium disabled:opacity-50 transition-colors"
          >
            Download Update
          </button>
        </div>
      )}

      {phase === 'progress' && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-os-text-muted">
            <span>Downloading update…</span>
            <span>{fmtSpeed(progress.bytesPerSecond)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-os-text-muted">
            <span>{fmtBytes(progress.transferred)} / {fmtBytes(progress.total)}</span>
            <span>{progress.percent}%</span>
          </div>
        </div>
      )}

      {downloaded && (
        <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/10 space-y-3">
          <p className="text-sm font-semibold text-green-300">
            v{downloaded.version} ready to install
          </p>
          <p className="text-xs text-os-text-muted">
            The app will restart to apply the update. If the new version fails to boot,
            it will automatically roll back to v{status?.currentVersion}.
          </p>
          <button
            onClick={handleInstall}
            className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm text-white font-medium transition-colors"
          >
            Restart &amp; Install
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          ❌ {error}
        </div>
      )}

      {/* Check button */}
      {!downloaded && phase !== 'progress' && (
        <button
          onClick={handleCheck}
          disabled={busy || phase === 'checking'}
          className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white disabled:opacity-50 transition-colors"
        >
          {phase === 'checking' ? 'Checking…' : 'Check for Updates'}
        </button>
      )}

      {/* Rollback section */}
      {status?.hasBackup && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <p className="text-xs font-semibold text-os-text-muted uppercase tracking-wider">Rollback</p>
          <p className="text-xs text-os-text-muted">
            Revert to the previous version (v{status.backupVersion ?? '?'}).
            Use this if the current version has issues.
          </p>
          {!rollbackConfirm ? (
            <button
              onClick={() => setRollbackConfirm(true)}
              className="w-full py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-sm text-orange-400 transition-colors"
            >
              Roll Back to v{status.backupVersion ?? '?'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setRollbackConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white/10 text-sm text-os-text-secondary hover:bg-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={busy}
                className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm text-white font-medium disabled:opacity-50 transition-colors"
              >
                {busy ? 'Rolling back…' : 'Confirm Rollback'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
