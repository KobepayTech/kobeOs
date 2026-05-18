import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOSStore } from '@/os/store';
import { accentColors, wallpapers } from '@/os/theme';
import { useSubscription } from '@/hooks/useSubscription';
import UpdateManager from '@/components/UpdateManager';

type Tab = 'appearance' | 'desktop' | 'taskbar' | 'notifications' | 'system' | 'apps' | 'subscription';

export default function Settings() {
  const { settings, updateSettings, pinApp, unpinApp } = useOSStore();
  const [tab, setTab] = useState<Tab>('appearance');

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'appearance', label: 'Appearance', icon: icons.Palette },
    { key: 'desktop', label: 'Desktop', icon: icons.Monitor },
    { key: 'taskbar', label: 'Taskbar', icon: icons.Layout },
    { key: 'notifications', label: 'Notifications', icon: icons.Bell },
    { key: 'system', label: 'System', icon: icons.Cpu },
    { key: 'apps', label: 'Apps', icon: icons.Grid3x3 },
    { key: 'subscription', label: 'Subscription', icon: icons.CreditCard },
  ];

  return (
    <div className="flex h-full text-sm text-os-text-primary bg-[#0f172a]">
      {/* Sidebar */}
      <div className="w-52 border-r border-white/[0.08] flex flex-col bg-[#0f172a]">
        <div className="p-3 text-lg font-semibold">Settings</div>
        <div className="flex flex-col gap-0.5 px-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                  active ? 'bg-white/10 text-os-accent' : 'hover:bg-white/5 text-os-text-secondary'
                }`}
                onClick={() => setTab(t.key)}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'appearance' && <AppearanceTab settings={settings} updateSettings={updateSettings} />}
          {tab === 'desktop' && <DesktopTab settings={settings} updateSettings={updateSettings} />}
          {tab === 'taskbar' && <TaskbarTab settings={settings} updateSettings={updateSettings} />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'system' && <SystemTab />}
          {tab === 'apps' && <AppsTab settings={settings} pinApp={pinApp} unpinApp={unpinApp} />}
          {tab === 'subscription' && <SubscriptionTab />}
        </motion.div>
      </div>
    </div>
  );
}

function AppearanceTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useOSStore.getState>['settings'];
  updateSettings: ReturnType<typeof useOSStore.getState>['updateSettings'];
}) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-semibold mb-3">Theme</h3>
        <div className="flex gap-2">
          {(['dark', 'light', 'auto'] as const).map((t) => (
            <button
              key={t}
              className={`px-4 py-2 rounded-lg border transition-colors capitalize ${
                settings.theme === t
                  ? 'border-os-accent bg-os-accent/10 text-os-accent'
                  : 'border-white/10 hover:bg-white/5'
              }`}
              onClick={() => updateSettings({ theme: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3">Accent Color</h3>
        <div className="flex gap-3">
          {accentColors.map((c) => (
            <button
              key={c.value}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                settings.accentColor === c.value ? 'border-white scale-110' : 'border-transparent hover:scale-105'
              }`}
              style={{ background: c.value }}
              title={c.name}
              onClick={() => updateSettings({ accentColor: c.value })}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3">Wallpaper</h3>
        <div className="grid grid-cols-3 gap-2">
          {wallpapers.map((w) => (
            <button
              key={w.name}
              className={`h-16 rounded-lg border-2 transition-all ${
                settings.wallpaper === w.value ? 'border-os-accent' : 'border-transparent hover:border-white/20'
              }`}
              style={{ background: w.value }}
              title={w.name}
              onClick={() => updateSettings({ wallpaper: w.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useOSStore.getState>['settings'];
  updateSettings: ReturnType<typeof useOSStore.getState>['updateSettings'];
}) {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <span>Show desktop icons</span>
        <button
          className={`w-10 h-5 rounded-full transition-colors ${settings.desktopIcons.length > 0 ? 'bg-os-accent' : 'bg-white/20'}`}
          onClick={() => updateSettings({ desktopIcons: settings.desktopIcons.length > 0 ? [] : settings.desktopIcons })}
        >
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.desktopIcons.length > 0 ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

function TaskbarTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useOSStore.getState>['settings'];
  updateSettings: ReturnType<typeof useOSStore.getState>['updateSettings'];
}) {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-semibold mb-3">Position</h3>
        <div className="flex gap-2">
          {(['bottom', 'top'] as const).map((p) => (
            <button
              key={p}
              className={`px-4 py-2 rounded-lg border capitalize ${
                settings.taskbarPosition === p
                  ? 'border-os-accent bg-os-accent/10 text-os-accent'
                  : 'border-white/10 hover:bg-white/5'
              }`}
              onClick={() => updateSettings({ taskbarPosition: p })}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span>Show seconds in clock</span>
        <button
          className={`w-10 h-5 rounded-full transition-colors ${settings.showSeconds ? 'bg-os-accent' : 'bg-white/20'}`}
          onClick={() => updateSettings({ showSeconds: !settings.showSeconds })}
        >
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.showSeconds ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <span>Do not disturb</span>
        <button
          className="w-10 h-5 rounded-full bg-white/20"
          onClick={() => {}}
        >
          <div className="w-4 h-4 rounded-full bg-white translate-x-0.5" />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span>Notification sounds</span>
        <button className="w-10 h-5 rounded-full bg-os-accent">
          <div className="w-4 h-4 rounded-full bg-white translate-x-5" />
        </button>
      </div>
    </div>
  );
}

function SystemTab() {
  const [backendStatus, setBackendStatus] = useState<{ running: boolean; pid: number | null; embeddedPg: boolean } | null>(null);
  const isElectron = typeof window !== 'undefined' && !!window.kobeOS?.system;

  useEffect(() => {
    if (!isElectron) return;
    window.kobeOS.system.getBackendStatus().then(setBackendStatus).catch(() => null);
    const t = setInterval(() => window.kobeOS.system.getBackendStatus().then(setBackendStatus).catch(() => null), 5000);
    return () => clearInterval(t);
  }, [isElectron]);

  return (
    <div className="space-y-6 max-w-lg">
      {/* About */}
      <div>
        <h3 className="text-base font-semibold mb-2">About</h3>
        <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-1 text-sm">
          <p><span className="text-os-text-muted">OS:</span> KobeOS</p>
          <p><span className="text-os-text-muted">Build date:</span> {new Date().toISOString().split('T')[0]}</p>
          {backendStatus && (
            <>
              <p>
                <span className="text-os-text-muted">Backend:</span>{' '}
                <span className={backendStatus.running ? 'text-green-400' : 'text-red-400'}>
                  {backendStatus.running ? `Running (pid ${backendStatus.pid})` : 'Stopped'}
                </span>
              </p>
              <p>
                <span className="text-os-text-muted">Database:</span>{' '}
                <span className="text-os-text-secondary">
                  {backendStatus.embeddedPg ? 'Embedded PostgreSQL (live mode)' : 'System PostgreSQL'}
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Remote updates */}
      <div>
        <h3 className="text-base font-semibold mb-2">Software Updates</h3>
        <UpdateManager />
      </div>

      {/* Reset */}
      <div>
        <h3 className="text-base font-semibold mb-2">Reset</h3>
        <button
          className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
          onClick={() => {
            if (confirm('Reset all settings?')) {
              localStorage.removeItem('kobe-os-settings');
              window.location.reload();
            }
          }}
        >
          Reset Settings
        </button>
      </div>
    </div>
  );
}

function AppsTab({
  settings,
  pinApp,
  unpinApp,
}: {
  settings: ReturnType<typeof useOSStore.getState>['settings'];
  pinApp: (id: string) => void;
  unpinApp: (id: string) => void;
}) {
  const apps = useOSStore((s) => s.apps);
  return (
    <div className="space-y-2">
      {apps.map((app) => {
        const Icon = (icons[app.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.Circle;
        const pinned = settings.pinnedApps.includes(app.id);
        return (
          <div key={app.id} className="flex items-center justify-between p-2 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-os-text-secondary" />
              <div>
                <div className="text-sm font-medium">{app.name}</div>
                <div className="text-[11px] text-os-text-muted">{app.description}</div>
              </div>
            </div>
            <button
              className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                pinned ? 'bg-os-accent/20 text-os-accent' : 'bg-white/5 text-os-text-muted hover:bg-white/10'
              }`}
              onClick={() => (pinned ? unpinApp(app.id) : pinApp(app.id))}
            >
              {pinned ? 'Pinned' : 'Pin'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription tab
// ---------------------------------------------------------------------------

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api';

type PayStep = 'idle' | 'entering' | 'pending' | 'success' | 'error';

function SubscriptionTab() {
  const {
    licenseStatus,
    isActive,
    isExpired,
    plan,
    expiresAt,
    daysRemaining,
    activateLicense,
    revokeLicense,
    refreshLicense,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'pro'>('trial');
  const [msisdn, setMsisdn] = useState('');
  const [step, setStep] = useState<PayStep>('idle');
  const [txId, setTxId] = useState('');
  const [error, setError] = useState('');

  // On mount, try to pull a fresh token from the backend (online refresh)
  useEffect(() => {
    const token = localStorage.getItem('kobe_access_token');
    if (!token) return;
    fetch(`${API_BASE}/license/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then(async (data: { token: string } | null) => {
        if (data?.token) await activateLicense(data.token);
        else await refreshLicense();
      })
      .catch(() => refreshLicense());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInitiate = useCallback(async () => {
    if (!msisdn.trim()) { setError('Enter your mobile number'); return; }
    setError('');
    setStep('pending');
    try {
      const token = localStorage.getItem('kobe_access_token');
      const res = await fetch(`${API_BASE}/license/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: selectedPlan, msisdn: msisdn.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { transactionId: string };
      setTxId(data.transactionId);
    } catch (e) {
      setError((e as Error).message || 'Payment initiation failed');
      setStep('error');
    }
  }, [msisdn, selectedPlan]);

  // Poll for activation
  useEffect(() => {
    if (step !== 'pending' || !txId) return;
    let cancelled = false;
    let polls = 0;
    const MAX = 36;

    const poll = async () => {
      if (cancelled) return;
      try {
        const token = localStorage.getItem('kobe_access_token');
        const res = await fetch(`${API_BASE}/license/status/${txId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json() as { status: string; token?: string };
        if (data.status === 'active' && data.token) {
          await activateLicense(data.token);
          if (!cancelled) setStep('success');
          return;
        }
        if (data.status === 'failed') {
          if (!cancelled) { setError('Payment failed. Try again.'); setStep('error'); }
          return;
        }
      } catch { /* keep polling */ }
      polls++;
      if (polls >= MAX && !cancelled) {
        setError('Timed out. Check your phone and try again.');
        setStep('error');
      }
    };

    const timer = setInterval(poll, 5_000);
    poll();
    return () => { cancelled = true; clearInterval(timer); };
  }, [step, txId, activateLicense]);

  const planLabel = plan === 'pro' ? 'KobeOS Pro' : plan === 'trial' ? 'KobeOS Trial' : null;

  return (
    <div className="space-y-6 max-w-lg">
      <h3 className="text-base font-semibold">Subscription</h3>

      {/* Current status card */}
      <div className={`p-4 rounded-xl border ${
        isActive
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : isExpired
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-white/10 bg-white/5'
      }`}>
        <div className="flex items-center gap-3">
          {isActive ? (
            <icons.CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : isExpired ? (
            <icons.AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <icons.Lock className="w-5 h-5 text-white/40 shrink-0" />
          )}
          <div>
            <div className="text-sm font-medium">
              {isActive
                ? `${planLabel} — Active`
                : isExpired
                ? `${planLabel} — Expired`
                : 'No active subscription'}
            </div>
            {isActive && expiresAt && (
              <div className="text-xs text-white/50 mt-0.5">
                Expires {expiresAt.toLocaleDateString()} · {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
              </div>
            )}
            {isExpired && (
              <div className="text-xs text-amber-400/70 mt-0.5">Renew to restore access to all apps</div>
            )}
            {licenseStatus === 'none' && (
              <div className="text-xs text-white/40 mt-0.5">Subscribe to unlock productivity, ERP, and business apps</div>
            )}
          </div>
        </div>
        {isActive && (
          <button
            onClick={() => { if (confirm('Revoke your license? You will lose access to paid apps.')) revokeLicense(); }}
            className="mt-3 text-xs text-red-400/60 hover:text-red-400 transition-colors"
          >
            Revoke license
          </button>
        )}
      </div>

      {/* Plan selector + payment form — shown when not active, or expired */}
      {(!isActive || isExpired) && step !== 'success' && (
        <>
          {/* Plan picker */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-white/70">Choose a plan</h4>
            <div className="grid grid-cols-2 gap-3">
              {(['trial', 'pro'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPlan(p)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    selectedPlan === p
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <div className="text-sm font-medium capitalize">
                    {p === 'trial' ? 'KobeOS Trial' : 'KobeOS Pro'}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">
                    {p === 'trial' ? '2,000 TZS / month' : '10,000 TZS / month'}
                  </div>
                  <div className="text-[11px] text-white/35 mt-1">
                    {p === 'trial'
                      ? 'Productivity, media, dev tools, games'
                      : 'ERP, cargo, hotel, payments, creator'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Phone input */}
          {(step === 'idle' || step === 'entering' || step === 'error') && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white/70">Pay via USSD Push</h4>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <icons.Smartphone className="w-4 h-4 text-white/40 shrink-0" />
                <input
                  type="tel"
                  placeholder="0712 345 678"
                  value={msisdn}
                  onChange={(e) => { setMsisdn(e.target.value); setStep('entering'); setError(''); }}
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                />
              </div>
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <icons.AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </p>
              )}
              <button
                onClick={handleInitiate}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
              >
                {isExpired ? 'Renew Subscription' : 'Subscribe Now'}
              </button>
              <p className="text-[11px] text-white/30 text-center">
                A USSD prompt will be sent to your phone. Confirm with your PIN to activate.
              </p>
            </div>
          )}

          {/* Pending */}
          {step === 'pending' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <icons.Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-white/60">Waiting for USSD confirmation…</p>
              <p className="text-xs text-white/30">Check your phone and enter your PIN</p>
              <button
                onClick={() => { setStep('idle'); setTxId(''); }}
                className="text-xs text-white/40 hover:text-white/60 underline"
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {/* Success */}
      {step === 'success' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <icons.CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <p className="text-sm text-white/80 font-medium">Subscription activated!</p>
          <button
            onClick={() => setStep('idle')}
            className="text-xs text-white/40 hover:text-white/60 underline"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
