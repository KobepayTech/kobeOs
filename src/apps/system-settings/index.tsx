import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Globe,
  HardDrive,
  Info,
  Bell,
  Monitor,
  Moon,
  Sun,
  Smartphone,
  Check,
  Loader2,
} from 'lucide-react';

/* ───────────────────────────── types ───────────────────────────── */

type TabKey = 'appearance' | 'language' | 'storage' | 'system' | 'notifications';

interface SystemSettingsState {
  theme: 'light' | 'dark' | 'auto';
  language: 'english' | 'swahili' | 'auto';
  notificationsEnabled: boolean;
  notificationSounds: boolean;
  doNotDisturb: boolean;
}

const STORAGE_KEY = 'kobe-system-settings';

const defaultSettings: SystemSettingsState = {
  theme: 'dark',
  language: 'english',
  notificationsEnabled: true,
  notificationSounds: true,
  doNotDisturb: false,
};

function loadSettings(): SystemSettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultSettings };
}

function saveSettings(state: SystemSettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ─────────────────────────── sidebar tabs ─────────────────────────── */

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

const tabs: TabDef[] = [
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'language', label: 'Language', icon: Globe },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'system', label: 'System Info', icon: Info },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

/* ═══════════════════════════ main component ═══════════════════════════ */

export default function SystemSettingsApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('appearance');
  const [settings, setSettings] = useState<SystemSettingsState>(loadSettings);

  /* persist on every change */
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const update = <K extends keyof SystemSettingsState>(key: K, value: SystemSettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-full text-sm text-os-text-primary bg-[#0f172a] select-none">
      {/* ────────── sidebar ────────── */}
      <div className="w-56 border-r border-white/[0.08] flex flex-col bg-[#0f172a] shrink-0">
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-base font-semibold tracking-tight">System Settings</h2>
          <p className="text-[11px] text-os-text-muted mt-0.5">Configure your device</p>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-os-accent font-medium'
                    : 'text-os-text-secondary hover:bg-white/5 hover:text-os-text-primary'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="system-settings-indicator"
                    className="ml-auto w-1 h-1 rounded-full bg-os-accent"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* footer brand */}
        <div className="px-4 py-3 border-t border-white/[0.08]">
          <div className="text-[10px] text-os-text-muted uppercase tracking-wider">KobeOS</div>
          <div className="text-[10px] text-os-text-muted/60 mt-0.5">v1.6.1</div>
        </div>
      </div>

      {/* ────────── content ────────── */}
      <div className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="max-w-xl space-y-8"
          >
            {activeTab === 'appearance' && <AppearanceSection settings={settings} update={update} />}
            {activeTab === 'language' && <LanguageSection settings={settings} update={update} />}
            {activeTab === 'storage' && <StorageSection />}
            {activeTab === 'system' && <SystemInfoSection />}
            {activeTab === 'notifications' && <NotificationsSection settings={settings} update={update} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════════════════ Appearance Section ════════════════════════ */

function AppearanceSection({
  settings,
  update,
}: {
  settings: SystemSettingsState;
  update: <K extends keyof SystemSettingsState>(key: K, value: SystemSettingsState[K]) => void;
}) {
  const themeOptions: { value: SystemSettingsState['theme']; label: string; Icon: React.ElementType; desc: string }[] = [
    { value: 'light', label: 'Light', Icon: Sun, desc: 'Always use light theme' },
    { value: 'dark', label: 'Dark', Icon: Moon, desc: 'Always use dark theme' },
    { value: 'auto', label: 'System', Icon: Smartphone, desc: 'Follow system preference' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Appearance" subtitle="Personalize the look and feel of KobeOS" />

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-os-text-primary">Theme</h4>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ value, label, Icon, desc }) => {
            const active = settings.theme === value;
            return (
              <button
                key={value}
                onClick={() => update('theme', value)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-os-accent bg-os-accent/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
                }`}
              >
                {active && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3.5 h-3.5 text-os-accent" />
                  </div>
                )}
                <Icon className={`w-6 h-6 ${active ? 'text-os-accent' : 'text-os-text-secondary'}`} />
                <div className="text-sm font-medium">{label}</div>
                <div className="text-[11px] text-os-text-muted text-center leading-tight">{desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme preview cards */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-os-text-primary">Preview</h4>
        <div className="grid grid-cols-3 gap-3">
          <ThemePreviewCard
            label="Light"
            bgClass="bg-white"
            textClass="text-gray-900"
            borderClass="border-gray-200"
            isActive={settings.theme === 'light'}
          />
          <ThemePreviewCard
            label="Dark"
            bgClass="bg-gray-900"
            textClass="text-white"
            borderClass="border-gray-700"
            isActive={settings.theme === 'dark'}
          />
          <ThemePreviewCard
            label="System"
            bgClass="bg-gradient-to-br from-white to-gray-900"
            textClass="text-gray-700"
            borderClass="border-gray-400"
            isActive={settings.theme === 'auto'}
          />
        </div>
      </div>
    </div>
  );
}

function ThemePreviewCard({
  label,
  bgClass,
  textClass,
  borderClass,
  isActive,
}: {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  isActive: boolean;
}) {
  return (
    <div
      className={`relative h-20 rounded-lg border-2 overflow-hidden transition-all ${
        isActive ? 'border-os-accent' : 'border-transparent'
      }`}
    >
      <div className={`absolute inset-0 ${bgClass} opacity-20`} />
      <div
        className={`absolute inset-2 rounded border ${borderClass} ${bgClass} ${textClass} opacity-40 flex items-center justify-center`}
      >
        <Monitor className="w-5 h-5" />
      </div>
      <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-os-text-muted">{label}</div>
    </div>
  );
}

/* ════════════════════════ Language Section ════════════════════════ */

function LanguageSection({
  settings,
  update,
}: {
  settings: SystemSettingsState;
  update: <K extends keyof SystemSettingsState>(key: K, value: SystemSettingsState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Language & Region" subtitle="Choose your preferred display language" />

      <div className="space-y-3">
        <label className="text-sm font-medium text-os-text-primary">Display Language</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-os-text-muted pointer-events-none" />
          <select
            value={settings.language}
            onChange={(e) => update('language', e.target.value as SystemSettingsState['language'])}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-os-text-primary
                       focus:outline-none focus:border-os-accent/50 focus:ring-1 focus:ring-os-accent/30
                       appearance-none cursor-pointer transition-colors hover:bg-white/[0.07]"
          >
            <option value="english">English</option>
            <option value="swahili">Kiswahili (Swahili)</option>
            <option value="auto">Auto-detect</option>
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-os-text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-[11px] text-os-text-muted">
          {settings.language === 'english' && 'All system menus, dialogs and notifications will be shown in English.'}
          {settings.language === 'swahili' && 'Menyu zote, mazungumzo na arifa zitaonyeshwa kwa Kiswahili.'}
          {settings.language === 'auto' && 'KobeOS will match your browser or OS language preference.'}
        </p>
      </div>

      {/* Language details */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-os-text-muted">Date format</span>
          <span className="text-os-text-primary font-mono">DD/MM/YYYY</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-os-text-muted">Time format</span>
          <span className="text-os-text-primary">24-hour</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-os-text-muted">Number format</span>
          <span className="text-os-text-primary">1,234.56</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-os-text-muted">Currency</span>
          <span className="text-os-text-primary">TZS (Tanzanian Shilling)</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ Storage Section ════════════════════════ */

function StorageSection() {
  const totalGB = 128;
  const usedGB = 45.2;
  const freeGB = totalGB - usedGB;
  const usedPercent = (usedGB / totalGB) * 100;

  const categories = [
    { label: 'System', size: 12.8, color: 'bg-blue-500' },
    { label: 'Applications', size: 18.4, color: 'bg-emerald-500' },
    { label: 'User Data', size: 9.7, color: 'bg-amber-500' },
    { label: 'Media', size: 3.2, color: 'bg-purple-500' },
    { label: 'Cache', size: 1.1, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Storage" subtitle="Manage your local storage usage" />

      {/* Main storage bar */}
      <div className="p-5 rounded-xl border border-white/10 bg-white/[0.03] space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-semibold tabular-nums">{usedGB.toFixed(1)} GB</div>
            <div className="text-xs text-os-text-muted">used of {totalGB} GB</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium tabular-nums">{freeGB.toFixed(1)} GB</div>
            <div className="text-xs text-os-text-muted">free</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usedPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full bg-os-accent"
          />
        </div>

        <div className="text-xs text-os-text-muted text-right">{usedPercent.toFixed(1)}% used</div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-os-text-primary">Breakdown</h4>
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <div
              key={cat.label}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                <span className="text-sm text-os-text-primary">{cat.label}</span>
              </div>
              <span className="text-sm text-os-text-muted tabular-nums">{cat.size.toFixed(1)} GB</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-lg bg-os-accent/10 text-os-accent text-sm font-medium hover:bg-os-accent/20 transition-colors">
          Clear Cache
        </button>
        <button className="px-4 py-2 rounded-lg bg-white/5 text-os-text-secondary text-sm hover:bg-white/10 transition-colors">
          Manage Files
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ System Info Section ════════════════════════ */

function SystemInfoSection() {
  const [checking, setChecking] = useState(false);

  const handleCheckUpdate = () => {
    setChecking(true);
    setTimeout(() => setChecking(false), 2500);
  };

  const infoRows = [
    { label: 'OS Name', value: 'KobeOS' },
    { label: 'Version', value: '1.6.1' },
    { label: 'Build', value: '2025.0615.1-stable' },
    { label: 'Platform', value: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown' },
    { label: 'User Agent', value: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').pop()?.replace(/[()]/g, '') || 'Unknown' : 'Unknown' },
    { label: 'Electron', value: (typeof window !== 'undefined' && (window as any).kobeOS?.system) ? '31.0.0' : 'N/A (Web Mode)' },
    { label: 'Node.js', value: (typeof window !== 'undefined' && (window as any).kobeOS?.system) ? '20.15.0' : 'N/A (Web Mode)' },
    { label: 'Chrome', value: typeof navigator !== 'undefined' ? navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'Unknown' : 'Unknown' },
    { label: 'Architecture', value: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('x64') ? 'x64' : 'arm64') : 'Unknown' },
    { label: 'Memory', value: '8 GB' },
    { label: 'Processors', value: '4 cores' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="System Information" subtitle="Details about your KobeOS installation" />

      {/* Info card */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-0 divide-y divide-white/5">
        {infoRows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm text-os-text-muted">{label}</span>
            <span className="text-sm text-os-text-primary font-mono truncate max-w-[200px]" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Software update */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-os-text-primary">Software Update</h4>
            <p className="text-[11px] text-os-text-muted mt-0.5">Your system is up to date</p>
          </div>
          <button
            onClick={handleCheckUpdate}
            disabled={checking}
            className="px-3 py-1.5 rounded-lg bg-os-accent/10 text-os-accent text-xs font-medium hover:bg-os-accent/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {checking ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking
              </>
            ) : (
              'Check for Updates'
            )}
          </button>
        </div>
        <div className="text-[11px] text-os-text-muted">
          Current: <span className="text-os-text-primary font-mono">v1.6.1</span> · Last checked: Today
        </div>
      </div>

      {/* License */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium">Licensed under MIT</span>
        </div>
        <p className="text-[11px] text-emerald-400/60 mt-1">
          KobeOS is open-source software. You are free to use, modify and distribute it.
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════ Notifications Section ════════════════════════ */

function NotificationsSection({
  settings,
  update,
}: {
  settings: SystemSettingsState;
  update: <K extends keyof SystemSettingsState>(key: K, value: SystemSettingsState[K]) => void;
}) {
  const toggles: {
    key: keyof SystemSettingsState;
    label: string;
    desc: string;
  }[] = [
    {
      key: 'notificationsEnabled',
      label: 'Enable Notifications',
      desc: 'Allow apps and the system to send you notifications',
    },
    {
      key: 'notificationSounds',
      label: 'Notification Sounds',
      desc: 'Play a sound when a notification arrives',
    },
    {
      key: 'doNotDisturb',
      label: 'Do Not Disturb',
      desc: 'Silence all notifications except critical alerts',
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Notifications" subtitle="Control how and when you receive alerts" />

      <div className="space-y-1">
        {toggles.map(({ key, label, desc }) => {
          const isOn = settings[key] as boolean;
          return (
            <div
              key={key}
              className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="mr-4">
                <div className="text-sm text-os-text-primary">{label}</div>
                <div className="text-[11px] text-os-text-muted mt-0.5">{desc}</div>
              </div>
              <ToggleSwitch
                checked={isOn}
                onChange={(v) => update(key as keyof SystemSettingsState, v as SystemSettingsState[keyof SystemSettingsState])}
              />
            </div>
          );
        })}
      </div>

      {/* App-specific notification placeholder */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
        <h4 className="text-sm font-medium text-os-text-primary">Per-App Settings</h4>
        <p className="text-[11px] text-os-text-muted">
          Notification preferences for individual apps can be configured from each app&apos;s settings.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════ helper components ═════════════════════ */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-os-text-primary">{title}</h3>
      <p className="text-xs text-os-text-muted mt-0.5">{subtitle}</p>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-os-accent' : 'bg-white/20'}`}
    >
      <motion.div
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
