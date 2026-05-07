/**
 * Theme configuration for KOBE OS.
 * Provides accent color palettes and wallpaper gradients.
 */

export const accentColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
];

export const wallpapers = [
  { name: 'Cosmic Blue', value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' },
  { name: 'Deep Space', value: 'linear-gradient(135deg, #020617 0%, #1e1b4b 50%, #0f172a 100%)' },
  { name: 'Midnight', value: 'linear-gradient(135deg, #000000 0%, #1a1a2e 50%, #16213e 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0c4a6e 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #064e3b 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #4c1d95 0%, #be185d 50%, #fb923c 100%)' },
];

export function setTheme(mode: 'dark' | 'light' | 'auto'): void {
  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function setAccentColor(color: string): void {
  document.documentElement.style.setProperty('--os-accent', color);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  document.documentElement.style.setProperty('--os-accent-rgb', `${r}, ${g}, ${b}`);
}

export function setWallpaper(wallpaper: string): void {
  document.documentElement.style.setProperty('--os-wallpaper', wallpaper);
}
