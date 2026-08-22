import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  WindowInstance,
  AppManifest,
  DesktopIcon,
  Notification,
  OSSettings,
  ContextMenuItem,
  AppEntitlements,
} from './types';
import { setTheme, setAccentColor, setWallpaper } from './theme';
import {
  loadLicense,
  storeLicenseToken,
  clearLicenseToken,
  tierSatisfied,
} from './license';
import type { LicensePayload, LicenseStatus } from './license';
import type { SubscriptionTier } from './types';
import {
  CORE_APP_IDS,
  type AppEntitlementSnapshot,
} from '@/lib/appMarketplace';
import { apiArray } from '@/lib/api';

interface OSStore {
  // Windows
  windows: WindowInstance[];
  nextZIndex: number;
  openWindow: (appId: string, title?: string, data?: Record<string, unknown>) => WindowInstance | null;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindow: (id: string, partial: Partial<WindowInstance>) => void;
  bringToFront: (id: string) => void;

  // Apps
  apps: AppManifest[];
  setApps: (apps: AppManifest[]) => void;
  getApp: (id: string) => AppManifest | undefined;
  launchApp: (appId: string, data?: Record<string, unknown>) => WindowInstance | null;
  isAppOpen: (appId: string) => boolean;
  installedAppIds: string[];
  appEntitlements: AppEntitlements;
  isAppInstalled: (appId: string) => boolean;
  setAppEntitlements: (records: unknown) => void;
  /** Offline fallback: make the whole registered catalogue usable when the
   *  entitlement backend can't be reached, so the desktop is never left with
   *  only the core apps. Real entitlements reconcile once online. */
  enableOfflineAppFallback: () => void;
  recordInstalledApp: (record: AppEntitlementSnapshot) => void;
  pendingInstallAppId: string | null;
  requestAppInstall: (appId: string) => void;
  clearAppInstallRequest: () => void;

  // Desktop
  selectedIconId: string | null;
  selectIcon: (id: string) => void;
  deselectIcon: () => void;
  moveIcon: (id: string, x: number, y: number) => void;
  contextMenu: { x: number; y: number; items: ContextMenuItem[] } | null;
  showContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  hideContextMenu: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => string;
  removeNotification: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  get unreadCount(): number;

  // Settings
  settings: OSSettings;
  updateSettings: (partial: Partial<OSSettings>) => void;
  pinApp: (appId: string) => void;
  unpinApp: (appId: string) => void;
  toggleTheme: () => void;

  // License / subscription
  licenseStatus: LicenseStatus;
  licensePayload: LicensePayload | null;
  /** Load (or reload) the license from localStorage and verify it. */
  refreshLicense: () => Promise<void>;
  /** Persist a new raw token received from the backend and reload. */
  activateLicense: (rawToken: string) => Promise<void>;
  /** Clear the stored token (logout / manual revoke). */
  revokeLicense: () => void;
  /** Returns true if the current license satisfies the required tier. */
  canAccess: (required: SubscriptionTier) => boolean;
}

let idCounter = 0;
function makeWindowId(): string {
  return `win_${Date.now()}_${idCounter++}`;
}

// Tracks auto-dismiss timers so they can be cancelled on manual removal.
const notifTimers = new Map<string, ReturnType<typeof setTimeout>>();

const defaultDesktopIcons: DesktopIcon[] = [
  { id: 'di-1', appId: 'file-manager', x: 20, y: 20, label: 'File Manager', icon: 'FolderOpen' },
  { id: 'di-2', appId: 'settings', x: 20, y: 110, label: 'Settings', icon: 'Settings' },
  { id: 'di-3', appId: 'package-manager', x: 20, y: 200, label: 'App Store', icon: 'Store' },
];

const defaultSettings: OSSettings = {
  theme: 'dark',
  accentColor: '#3b82f6',
  wallpaper: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  taskbarPosition: 'bottom',
  showSeconds: false,
  dateFormat: 'YYYY-MM-DD',
  reduceMotion: false,
  pinnedApps: ['package-manager', 'file-manager', 'settings'],
  desktopIcons: defaultDesktopIcons,
};

export const useOSStore = create<OSStore>()(
  persist(
    (set, get) => ({
      windows: [],
      nextZIndex: 100,
      apps: [],
      installedAppIds: [...CORE_APP_IDS],
      appEntitlements: {},
      pendingInstallAppId: null,
      selectedIconId: null,
      contextMenu: null,
      notifications: [],
      settings: { ...defaultSettings },

      // License initial state — refreshed on OS boot via refreshLicense()
      licenseStatus: 'none' as LicenseStatus,
      licensePayload: null,

      refreshLicense: async () => {
        const { status, payload } = await loadLicense();
        set({ licenseStatus: status, licensePayload: payload });
      },

      activateLicense: async (rawToken: string) => {
        storeLicenseToken(rawToken);
        await get().refreshLicense();
      },

      revokeLicense: () => {
        clearLicenseToken();
        set({ licenseStatus: 'none', licensePayload: null });
      },

      canAccess: (required: SubscriptionTier) => {
        if (required === 'free') return true;
        // The embedded desktop edition ships the full suite and is not paywalled
        // (the backend likewise bypasses its guards via KOBEOS_DESKTOP). It is
        // identified by the kobeOS preload bridge, which only exists in the
        // Electron app; the hosted web edition keeps subscription gating.
        if (typeof window !== 'undefined' && !!window.kobeOS?.runtime) return true;
        const { licenseStatus, licensePayload } = get();
        if (licenseStatus !== 'valid' || !licensePayload) return false;
        return tierSatisfied(required, licensePayload.plan);
      },

      openWindow: (appId, title, data) => {
        const app = get().getApp(appId);
        if (!app) return null;
        if (app.singleton) {
          // Find any existing window (including minimized) to avoid duplicate instances.
          const existing = get().windows.find((w) => w.appId === appId);
          if (existing) {
            get().focusWindow(existing.id);
            return existing;
          }
        }
        const id = makeWindowId();
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const width = Math.min(app.width ?? 800, vw - 40);
        const height = Math.min(app.height ?? 600, vh - 100);
        const x = Math.max(20, (vw - width) / 2 + (get().windows.length * 20) % 120);
        const y = Math.max(20, (vh - height) / 2 + (get().windows.length * 20) % 120);
        const zIndex = get().nextZIndex;
        const win: WindowInstance = {
          id,
          appId,
          title: title ?? app.name,
          x,
          y,
          width,
          height,
          minWidth: app.minWidth ?? 300,
          minHeight: app.minHeight ?? 200,
          isMinimized: false,
          isMaximized: false,
          isFocused: true,
          zIndex,
          icon: app.icon,
          data,
        };
        set((state) => ({
          windows: state.windows.map((w) => ({ ...w, isFocused: false })).concat(win),
          nextZIndex: state.nextZIndex + 1,
        }));
        return win;
      },

      closeWindow: (id) => {
        set((state) => ({ windows: state.windows.filter((w) => w.id !== id) }));
      },

      minimizeWindow: (id) => {
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === id ? { ...w, isMinimized: true, isFocused: false } : w
          ),
        }));
      },

      maximizeWindow: (id) => {
        set((state) => ({
          windows: state.windows.map((w) => {
            if (w.id !== id) return w;
            if (w.isMaximized) {
              return { ...w, isMaximized: false };
            }
            return { ...w, isMaximized: true, isMinimized: false };
          }),
        }));
      },

      focusWindow: (id) => {
        const z = get().nextZIndex;
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === id
              ? { ...w, isFocused: true, isMinimized: false, zIndex: z }
              : { ...w, isFocused: false }
          ),
          nextZIndex: z + 1,
        }));
      },

      updateWindow: (id, partial) => {
        set((state) => ({
          windows: state.windows.map((w) => (w.id === id ? { ...w, ...partial } : w)),
        }));
      },

      bringToFront: (id) => {
        const z = get().nextZIndex;
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === id ? { ...w, zIndex: z, isFocused: true } : { ...w, isFocused: false }
          ),
          nextZIndex: z + 1,
        }));
      },

      setApps: (apps) => set({ apps }),
      getApp: (id) => get().apps.find((a) => a.id === id),
      launchApp: (appId, data) => {
        const app = get().getApp(appId);
        if (!app) return null;
        if (!get().isAppInstalled(appId)) {
          if (appId !== 'package-manager') get().requestAppInstall(appId);
          return null;
        }
        return get().openWindow(appId, app.name, data);
      },
      isAppOpen: (appId) => get().windows.some((w) => w.appId === appId),
      isAppInstalled: (appId) =>
        CORE_APP_IDS.includes(appId as typeof CORE_APP_IDS[number]) ||
        get().installedAppIds.includes(appId),
      setAppEntitlements: (records) => {
        const validRecords = apiArray<AppEntitlementSnapshot>(
          records,
          ['entitlements', 'apps'],
        ).filter((record) => record && typeof record.appId === 'string' && record.appId.length > 0);
        set({
          appEntitlements: Object.fromEntries(validRecords.map((record) => [record.appId, record])),
          installedAppIds: Array.from(new Set([
            ...CORE_APP_IDS,
            ...validRecords.map((record) => record.appId),
          ])),
        });
      },
      enableOfflineAppFallback: () => set((state) => ({
        installedAppIds: Array.from(new Set([
          ...CORE_APP_IDS,
          ...state.apps.map((app) => app.id),
        ])),
      })),
      recordInstalledApp: (record) => set((state) => ({
        appEntitlements: { ...state.appEntitlements, [record.appId]: record },
        installedAppIds: state.installedAppIds.includes(record.appId)
          ? state.installedAppIds
          : [...state.installedAppIds, record.appId],
      })),
      requestAppInstall: (appId) => set({ pendingInstallAppId: appId }),
      clearAppInstallRequest: () => set({ pendingInstallAppId: null }),

      selectIcon: (id) => set({ selectedIconId: id }),
      deselectIcon: () => set({ selectedIconId: null }),
      moveIcon: (id, x, y) =>
        set((state) => ({
          settings: {
            ...state.settings,
            desktopIcons: state.settings.desktopIcons.map((i) =>
              i.id === id ? { ...i, x, y } : i
            ),
          },
        })),

      showContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
      hideContextMenu: () => set({ contextMenu: null }),

      addNotification: (n) => {
        const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const notif: Notification = {
          ...n,
          id,
          timestamp: Date.now(),
          read: false,
        };
        set((state) => ({ notifications: [notif, ...state.notifications] }));
        const timer = setTimeout(() => {
          notifTimers.delete(id);
          get().removeNotification(id);
        }, 5000);
        notifTimers.set(id, timer);
        return id;
      },
      removeNotification: (id) => {
        const timer = notifTimers.get(id);
        if (timer !== undefined) {
          clearTimeout(timer);
          notifTimers.delete(id);
        }
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },
      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearAll: () => {
        notifTimers.forEach((timer) => clearTimeout(timer));
        notifTimers.clear();
        set({ notifications: [] });
      },
      get unreadCount() {
        return get().notifications.filter((n) => !n.read).length;
      },

      updateSettings: (partial) => {
        set((state) => {
          const next = { ...state.settings, ...partial };
          setTheme(next.theme);
          setAccentColor(next.accentColor);
          setWallpaper(next.wallpaper);
          return { settings: next };
        });
      },
      pinApp: (appId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            pinnedApps: state.settings.pinnedApps.includes(appId)
              ? state.settings.pinnedApps
              : [...state.settings.pinnedApps, appId],
          },
        })),
      unpinApp: (appId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            pinnedApps: state.settings.pinnedApps.filter((id) => id !== appId),
          },
        })),
      toggleTheme: () => {
        const next = get().settings.theme === 'dark' ? 'light' : 'dark';
        get().updateSettings({ theme: next });
      },
    }),
    {
      name: 'kobe-os-settings',
      version: 2,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted as OSStore;
        const state = persisted as Partial<OSStore>;
        const entitlements =
          state.appEntitlements && typeof state.appEntitlements === 'object'
            ? state.appEntitlements
            : {};
        const entitlementRecords = Array.isArray(entitlements)
          ? apiArray<AppEntitlementSnapshot>(entitlements)
          : Object.values(entitlements)
            .filter((record): record is AppEntitlementSnapshot =>
              !!record &&
              typeof record === 'object' &&
              typeof (record as Partial<AppEntitlementSnapshot>).appId === 'string',
            );
        const appEntitlements = Object.fromEntries(
          entitlementRecords.map((record) => [record.appId, record]),
        );
        const installedAppIds = Array.from(new Set([
          ...CORE_APP_IDS,
          ...Object.keys(appEntitlements),
        ]));
        const settings = state.settings
          ? {
              ...state.settings,
              pinnedApps: (state.settings.pinnedApps ?? [])
                .filter((appId) => installedAppIds.includes(appId)),
              desktopIcons: (state.settings.desktopIcons ?? [])
                .filter((icon) => installedAppIds.includes(icon.appId)),
            }
          : state.settings;
        return { ...state, appEntitlements, installedAppIds, settings } as OSStore;
      },
      partialize: (state) => ({
        settings: state.settings,
        installedAppIds: state.installedAppIds,
        appEntitlements: state.appEntitlements,
      }),
    }
  )
);
