import { useEffect } from 'react';
import { useOSStore } from './store';
import { setTheme, setAccentColor, setWallpaper } from './theme';

/**
 * Hook that syncs DOM theme attributes with the OS settings store.
 */
export function useTheme() {
  const { settings } = useOSStore();

  useEffect(() => {
    setTheme(settings.theme);
    setAccentColor(settings.accentColor);
    setWallpaper(settings.wallpaper);
  }, [settings.theme, settings.accentColor, settings.wallpaper]);

  return {
    theme: settings.theme,
    accentColor: settings.accentColor,
    wallpaper: settings.wallpaper,
    reduceMotion: settings.reduceMotion,
  };
}
