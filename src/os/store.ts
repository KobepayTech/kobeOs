import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  WindowInstance,
  AppManifest,
  DesktopIcon,
  Notification,
  OSSettings,
  ContextMenuItem,
} from './types';
import { setTheme, setAccentColor, setWallpaper } from './theme';

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
}

let idCounter = 0;
function makeWindowId(): string {
  return `win_${Date.now()}_${idCounter++}`;
}

// Tracks auto-dismiss timers so they can be cancelled on manual removal.
const notifTimers = new Map<string, ReturnType<typeof setTimeout>>();

const defaultDesktopIcons: DesktopIcon[] = [
  { id: 'di-1', appId: 'file-manager', x: 20, y: 20, label: 'File Manager', icon: 'FolderOpen' },
  { id: 'di-2', appId: 'terminal', x: 20, y: 110, label: 'Terminal', icon: 'Terminal' },
  { id: 'di-3', appId: 'settings', x: 20, y: 200, label: 'Settings', icon: 'Settings' },
  { id: 'di-4', appId: 'calculator', x: 20, y: 290, label: 'Calculator', icon: 'Calculator' },
  { id: 'di-5', appId: 'text-editor', x: 20, y: 380, label: 'Text Editor', icon: 'FileText' },
  { id: 'di-6', appId: 'calendar', x: 20, y: 470, label: 'Calendar', icon: 'Calendar' },
  { id: 'di-7', appId: 'browser', x: 20, y: 560, label: 'Browser', icon: 'Globe' },
  { id: 'di-8', appId: 'erp-dashboard', x: 20, y: 650, label: 'ERP Dashboard', icon: 'BarChart3' },
  { id: 'di-9', appId: 'cargo', x: 20, y: 740, label: 'KOBECARGO', icon: 'Plane' },
  { id: 'di-10', appId: 'kobe-print', x: 20, y: 830, label: 'KobePrint', icon: 'Printer' },
  { id: 'di-11', appId: 'creator', x: 120, y: 20, label: 'Creator', icon: 'Users' },
  { id: 'di-12', appId: 'kobe-hotel', x: 120, y: 110, label: 'KobeHotel', icon: 'Building2' },
  { id: 'di-13', appId: 'kobe-pay', x: 120, y: 200, label: 'KobePay', icon: 'Wallet' },
  { id: 'di-14', appId: 'kobetech-admin', x: 120, y: 290, label: 'Kobetech', icon: 'Shield' },
  { id: 'di-15', appId: 'kobetech-devops', x: 120, y: 380, label: 'DevOps', icon: 'Code2' },
];

const defaultSettings: OSSettings = {
  theme: 'dark',
  accentColor: '#3b82f6',
  wallpaper: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
  taskbarPosition: 'bottom',
  showSeconds: false,
  dateFormat: 'YYYY-MM-DD',
  reduceMotion: false,
  pinnedApps: ['file-manager', 'terminal', 'settings', 'calculator', 'browser', 'text-editor'],
  desktopIcons: defaultDesktopIcons,
};

export const useOSStore = create<OSStore>()(
  persist(
    (set, get) => ({
      windows: [],
      nextZIndex: 100,
      apps: [],
      selectedIconId: null,
      contextMenu: null,
      notifications: [],
      settings: { ...defaultSettings },

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
        return get().openWindow(appId, app.name, data);
      },
      isAppOpen: (appId) => get().windows.some((w) => w.appId === appId),

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
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
