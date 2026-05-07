import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Represents a running window instance on the desktop.
 */
export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  zIndex: number;
  icon?: string;
  data?: Record<string, unknown>;
}

/**
 * Application category types.
 */
export type AppCategory =
  | 'system'
  | 'productivity'
  | 'media'
  | 'development'
  | 'erp'
  | 'games'
  | 'communication';

/**
 * Metadata for a registered application.
 */
export interface AppManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AppCategory;
  version: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  singleton: boolean;
  requiresAuth: boolean;
  permissions: string[];
  component: LazyExoticComponent<ComponentType<unknown>>;
}

/**
 * Icon shortcut displayed on the desktop.
 */
export interface DesktopIcon {
  id: string;
  appId: string;
  x: number;
  y: number;
  label: string;
  icon: string;
}

/**
 * A notification toast or panel entry.
 */
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  appId?: string;
  timestamp: number;
  read: boolean;
}

/**
 * Persistent OS settings.
 */
export interface OSSettings {
  theme: 'dark' | 'light' | 'auto';
  accentColor: string;
  wallpaper: string;
  taskbarPosition: 'bottom' | 'top';
  showSeconds: boolean;
  dateFormat: string;
  reduceMotion: boolean;
  pinnedApps: string[];
  desktopIcons: DesktopIcon[];
}

/**
 * Context menu item definition.
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

/**
 * Virtual file system node.
 */
export interface FSNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  parentId: string | null;
  content?: string | ArrayBuffer;
  mimeType?: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  children?: string[];
}
