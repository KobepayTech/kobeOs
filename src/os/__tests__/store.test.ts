import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useOSStore } from '../store';
import type { AppManifest } from '../types';
import { lazy } from 'react';

// Mock theme side-effects so DOM manipulation doesn't fail in jsdom.
vi.mock('../theme', () => ({
  setTheme: vi.fn(),
  setAccentColor: vi.fn(),
  setWallpaper: vi.fn(),
}));

// A minimal app manifest for testing.
function makeApp(overrides: Partial<AppManifest> = {}): AppManifest {
  return {
    id: 'test-app',
    name: 'Test App',
    description: 'A test app',
    icon: 'Circle',
    category: 'system',
    version: '1.0.0',
    width: 800,
    height: 600,
    minWidth: 300,
    minHeight: 200,
    singleton: false,
    requiresAuth: false,
    permissions: [],
    component: lazy(() => Promise.resolve({ default: () => null })),
    ...overrides,
  };
}

// Reset store state before each test.
beforeEach(() => {
  useOSStore.setState({
    windows: [],
    nextZIndex: 100,
    apps: [],
    selectedIconId: null,
    contextMenu: null,
    notifications: [],
    settings: {
      theme: 'dark',
      accentColor: '#3b82f6',
      wallpaper: '',
      taskbarPosition: 'bottom',
      showSeconds: false,
      dateFormat: 'YYYY-MM-DD',
      reduceMotion: false,
      pinnedApps: [],
      desktopIcons: [],
    },
  });
});

afterEach(() => {
  vi.clearAllTimers();
});

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

describe('openWindow', () => {
  it('returns null when app is not registered', () => {
    const win = useOSStore.getState().openWindow('unknown-app');
    expect(win).toBeNull();
  });

  it('opens a window for a registered app', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app');
    expect(win).not.toBeNull();
    expect(win!.appId).toBe('test-app');
    expect(win!.isFocused).toBe(true);
    expect(useOSStore.getState().windows).toHaveLength(1);
  });

  it('focuses existing window for singleton apps instead of opening a second', () => {
    useOSStore.getState().setApps([makeApp({ singleton: true })]);
    const first = useOSStore.getState().openWindow('test-app');
    const second = useOSStore.getState().openWindow('test-app');
    expect(second!.id).toBe(first!.id);
    expect(useOSStore.getState().windows).toHaveLength(1);
  });

  it('restores and focuses a minimized singleton window instead of opening a new one', () => {
    useOSStore.getState().setApps([makeApp({ singleton: true })]);
    const first = useOSStore.getState().openWindow('test-app');
    useOSStore.getState().minimizeWindow(first!.id);
    expect(useOSStore.getState().windows[0].isMinimized).toBe(true);

    const second = useOSStore.getState().openWindow('test-app');
    expect(second!.id).toBe(first!.id);
    expect(useOSStore.getState().windows).toHaveLength(1);
    // focusWindow un-minimizes the window
    expect(useOSStore.getState().windows[0].isMinimized).toBe(false);
  });

  it('allows multiple instances of non-singleton apps', () => {
    useOSStore.getState().setApps([makeApp({ singleton: false })]);
    useOSStore.getState().openWindow('test-app');
    useOSStore.getState().openWindow('test-app');
    expect(useOSStore.getState().windows).toHaveLength(2);
  });
});

describe('closeWindow', () => {
  it('removes the window from state', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app')!;
    useOSStore.getState().closeWindow(win.id);
    expect(useOSStore.getState().windows).toHaveLength(0);
  });
});

describe('minimizeWindow / focusWindow', () => {
  it('minimizeWindow sets isMinimized and clears focus', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app')!;
    useOSStore.getState().minimizeWindow(win.id);
    const w = useOSStore.getState().windows[0];
    expect(w.isMinimized).toBe(true);
    expect(w.isFocused).toBe(false);
  });

  it('focusWindow un-minimizes and focuses the window', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app')!;
    useOSStore.getState().minimizeWindow(win.id);
    useOSStore.getState().focusWindow(win.id);
    const w = useOSStore.getState().windows[0];
    expect(w.isMinimized).toBe(false);
    expect(w.isFocused).toBe(true);
  });

  it('focusWindow blurs all other windows', () => {
    useOSStore.getState().setApps([
      makeApp({ id: 'app-a', name: 'App A', singleton: false }),
      makeApp({ id: 'app-b', name: 'App B', singleton: false }),
    ]);
    const a = useOSStore.getState().openWindow('app-a')!;
    const b = useOSStore.getState().openWindow('app-b')!;
    useOSStore.getState().focusWindow(a.id);
    const windows = useOSStore.getState().windows;
    expect(windows.find((w) => w.id === a.id)!.isFocused).toBe(true);
    expect(windows.find((w) => w.id === b.id)!.isFocused).toBe(false);
  });
});

describe('maximizeWindow', () => {
  it('toggles isMaximized', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app')!;
    useOSStore.getState().maximizeWindow(win.id);
    expect(useOSStore.getState().windows[0].isMaximized).toBe(true);
    useOSStore.getState().maximizeWindow(win.id);
    expect(useOSStore.getState().windows[0].isMaximized).toBe(false);
  });
});

describe('updateWindow', () => {
  it('applies partial updates', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app')!;
    useOSStore.getState().updateWindow(win.id, { x: 42, y: 99 });
    const w = useOSStore.getState().windows[0];
    expect(w.x).toBe(42);
    expect(w.y).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// isAppOpen
// ---------------------------------------------------------------------------

describe('isAppOpen', () => {
  it('returns false when no window exists', () => {
    expect(useOSStore.getState().isAppOpen('test-app')).toBe(false);
  });

  it('returns true for an open window', () => {
    useOSStore.getState().setApps([makeApp()]);
    useOSStore.getState().openWindow('test-app');
    expect(useOSStore.getState().isAppOpen('test-app')).toBe(true);
  });

  it('returns true even when the window is minimized', () => {
    useOSStore.getState().setApps([makeApp()]);
    const win = useOSStore.getState().openWindow('test-app')!;
    useOSStore.getState().minimizeWindow(win.id);
    expect(useOSStore.getState().isAppOpen('test-app')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

describe('notifications', () => {
  it('addNotification adds a notification and returns its id', () => {
    const id = useOSStore.getState().addNotification({
      title: 'Hello',
      message: 'World',
      type: 'info',
    });
    expect(id).toBeTruthy();
    expect(useOSStore.getState().notifications).toHaveLength(1);
    expect(useOSStore.getState().notifications[0].read).toBe(false);
  });

  it('unreadCount reflects unread notifications', () => {
    useOSStore.getState().addNotification({ title: 'A', message: '', type: 'info' });
    useOSStore.getState().addNotification({ title: 'B', message: '', type: 'success' });
    // unreadCount is a getter — access it via the store's subscribe/getState pattern.
    const unread = useOSStore.getState().notifications.filter((n) => !n.read).length;
    expect(unread).toBe(2);
  });

  it('markRead marks a single notification as read', () => {
    const id = useOSStore.getState().addNotification({ title: 'A', message: '', type: 'info' });
    useOSStore.getState().markRead(id);
    expect(useOSStore.getState().notifications[0].read).toBe(true);
    const unread = useOSStore.getState().notifications.filter((n) => !n.read).length;
    expect(unread).toBe(0);
  });

  it('markAllRead marks all notifications as read', () => {
    useOSStore.getState().addNotification({ title: 'A', message: '', type: 'info' });
    useOSStore.getState().addNotification({ title: 'B', message: '', type: 'warning' });
    useOSStore.getState().markAllRead();
    const unread = useOSStore.getState().notifications.filter((n) => !n.read).length;
    expect(unread).toBe(0);
  });

  it('removeNotification removes the notification', () => {
    const id = useOSStore.getState().addNotification({ title: 'A', message: '', type: 'info' });
    useOSStore.getState().removeNotification(id);
    expect(useOSStore.getState().notifications).toHaveLength(0);
  });

  it('clearAll removes all notifications', () => {
    useOSStore.getState().addNotification({ title: 'A', message: '', type: 'info' });
    useOSStore.getState().addNotification({ title: 'B', message: '', type: 'error' });
    useOSStore.getState().clearAll();
    expect(useOSStore.getState().notifications).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('settings', () => {
  it('pinApp adds an app to pinnedApps', () => {
    useOSStore.getState().pinApp('terminal');
    expect(useOSStore.getState().settings.pinnedApps).toContain('terminal');
  });

  it('pinApp is idempotent', () => {
    useOSStore.getState().pinApp('terminal');
    useOSStore.getState().pinApp('terminal');
    expect(useOSStore.getState().settings.pinnedApps.filter((a) => a === 'terminal')).toHaveLength(1);
  });

  it('unpinApp removes an app from pinnedApps', () => {
    useOSStore.getState().pinApp('terminal');
    useOSStore.getState().unpinApp('terminal');
    expect(useOSStore.getState().settings.pinnedApps).not.toContain('terminal');
  });

  it('toggleTheme switches between dark and light', () => {
    expect(useOSStore.getState().settings.theme).toBe('dark');
    useOSStore.getState().toggleTheme();
    expect(useOSStore.getState().settings.theme).toBe('light');
    useOSStore.getState().toggleTheme();
    expect(useOSStore.getState().settings.theme).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// Desktop icons
// ---------------------------------------------------------------------------

describe('moveIcon', () => {
  it('updates icon position', () => {
    useOSStore.setState((s) => ({
      settings: {
        ...s.settings,
        desktopIcons: [{ id: 'di-1', appId: 'terminal', x: 0, y: 0, label: 'Terminal', icon: 'Terminal' }],
      },
    }));
    useOSStore.getState().moveIcon('di-1', 120, 240);
    const icon = useOSStore.getState().settings.desktopIcons[0];
    expect(icon.x).toBe(120);
    expect(icon.y).toBe(240);
  });
});

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

describe('contextMenu', () => {
  it('showContextMenu sets the menu', () => {
    const items = [{ id: '1', label: 'Open', action: vi.fn() }];
    useOSStore.getState().showContextMenu(100, 200, items);
    expect(useOSStore.getState().contextMenu).toEqual({ x: 100, y: 200, items });
  });

  it('hideContextMenu clears the menu', () => {
    useOSStore.getState().showContextMenu(100, 200, []);
    useOSStore.getState().hideContextMenu();
    expect(useOSStore.getState().contextMenu).toBeNull();
  });
});
