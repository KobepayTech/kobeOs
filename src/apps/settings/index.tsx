import { useState } from 'react';
import { motion } from 'framer-motion';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOSStore } from '@/os/store';
import { accentColors, wallpapers } from '@/os/theme';

type Tab = 'appearance' | 'desktop' | 'taskbar' | 'notifications' | 'system' | 'apps';

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
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-base font-semibold mb-2">About</h3>
        <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-1 text-sm">
          <p><span className="text-os-text-muted">Device name:</span> kobe-os</p>
          <p><span className="text-os-text-muted">OS:</span> KOBE OS v1.0</p>
          <p><span className="text-os-text-muted">Build:</span> {new Date().toISOString().split('T')[0]}</p>
          <p><span className="text-os-text-muted">Kernel:</span> WebAssembly 1.0</p>
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold mb-2">Storage</h3>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/4 bg-os-accent rounded-full" />
        </div>
        <p className="text-xs text-os-text-muted mt-1">25% used — virtual storage is unlimited</p>
      </div>
      <button
        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
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
