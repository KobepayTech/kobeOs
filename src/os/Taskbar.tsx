import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOSStore } from './store';
import { StartMenu } from './StartMenu';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';

export function Taskbar() {
  const {
    windows,
    settings,
    getApp,
    focusWindow,
    launchApp,
  } = useOSStore();
  const unreadCount = useOSStore((s) => s.unreadCount);
  const { state: updaterState, download, install } = useAutoUpdater();

  const [startOpen, setStartOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isBottom = settings.taskbarPosition !== 'top';
  const posClass = isBottom ? 'bottom-4' : 'top-4';

  const formatTime = useCallback(
    (d: Date) =>
      d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: settings.showSeconds ? '2-digit' : undefined,
        hour12: false,
      }),
    [settings.showSeconds]
  );

  const openWindows = windows.filter((w) => !w.isMinimized);

  return (
    <>
      {/* Centered Glassmorphism Pill Taskbar */}
      <div
        className={`fixed ${posClass} left-1/2 -translate-x-1/2 h-14 flex items-center select-none z-[200] px-3 gap-1`}
        style={{
          background: 'rgba(255,255,255,0.25)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 9999,
          border: '1px solid rgba(255,255,255,0.40)',
          boxShadow: '0 8px 32px rgba(123,140,222,0.12)',
          maxWidth: '90vw',
        }}
      >
        {/* Start Button ("Ask Genie" style) */}
        <button
          className="h-10 px-3 flex items-center gap-2 rounded-full transition-colors mr-1"
          style={{ background: startOpen ? 'rgba(123,140,222,0.20)' : 'transparent' }}
          onMouseEnter={(e) => {
            if (!startOpen) e.currentTarget.style.background = 'rgba(123,140,222,0.12)';
          }}
          onMouseLeave={(e) => {
            if (!startOpen) e.currentTarget.style.background = 'transparent';
          }}
          onClick={() => setStartOpen((s) => !s)}
        >
          <icons.Sparkles className="w-5 h-5" style={{ color: '#7B8CDE' }} />
          <span className="text-xs font-medium hidden sm:inline" style={{ color: '#2D2B55' }}>Ask Genie</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ background: 'rgba(45,43,85,0.12)' }} />

        {/* Pinned + Open Windows */}
        <div className="flex items-center gap-0.5 overflow-hidden">
          {settings.pinnedApps.map((appId) => {
            const app = getApp(appId);
            if (!app) return null;
            const Icon = (icons[app.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.Circle;
            const isOpen = openWindows.some((w) => w.appId === appId);
            const isFocused = openWindows.some((w) => w.appId === appId && w.isFocused);
            return (
              <button
                key={appId}
                className="relative w-10 h-10 flex items-center justify-center rounded-full transition-colors group"
                onClick={() => {
                  const existing = windows.find((w) => w.appId === appId);
                  if (existing) {
                    focusWindow(existing.id);
                  } else {
                    launchApp(appId);
                  }
                }}
                title={app.name}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(123,140,222,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon className="w-5 h-5" style={{ color: '#2D2B55' }} />
                {isOpen && (
                  <div
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: isFocused ? '#7B8CDE' : 'rgba(45,43,85,0.25)' }}
                  />
                )}
              </button>
            );
          })}

          {openWindows
            .filter((w) => !settings.pinnedApps.includes(w.appId))
            .map((w) => {
              const app = getApp(w.appId);
              const Icon = app
                ? ((icons[app.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.Circle)
                : icons.Circle;
              return (
                <button
                  key={w.id}
                  className="h-10 px-2 flex items-center gap-2 rounded-full transition-colors max-w-[140px]"
                  style={{ background: w.isFocused ? 'rgba(123,140,222,0.15)' : 'transparent' }}
                  onClick={() => focusWindow(w.id)}
                  onMouseEnter={(e) => {
                    if (!w.isFocused) e.currentTarget.style.background = 'rgba(123,140,222,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    if (!w.isFocused) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" style={{ color: '#2D2B55' }} />
                  <span className="text-xs truncate" style={{ color: '#2D2B55' }}>{w.title}</span>
                </button>
              );
            })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ background: 'rgba(45,43,85,0.12)' }} />

        {/* System Tray */}
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              onClick={() => {
                setVolumeOpen((v) => !v);
                setCalendarOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(123,140,222,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <icons.Volume2 className="w-4 h-4" style={{ color: '#2D2B55' }} />
            </button>
            <AnimatePresence>
              {volumeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute p-4 rounded-2xl shadow-2xl"
                  style={{
                    bottom: 56,
                    right: 0,
                    width: 192,
                    background: 'rgba(255,255,255,0.40)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.50)',
                    boxShadow: '0 25px 80px rgba(123,140,222,0.20)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <icons.Volume2 className="w-4 h-4" style={{ color: '#6B6691' }} />
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(45,43,85,0.10)' }}>
                      <div className="h-full rounded-full" style={{ width: '75%', background: '#7B8CDE' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(123,140,222,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <icons.Wifi className="w-4 h-4" style={{ color: '#2D2B55' }} />
          </button>

          <div className="relative">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors relative"
              onClick={() => {
                setCalendarOpen(false);
                setVolumeOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(123,140,222,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <icons.Bell className="w-4 h-4" style={{ color: '#2D2B55' }} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: '#E85D5D' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative">
            <button
              className="h-10 px-2 flex flex-col items-end justify-center rounded-full transition-colors"
              onClick={() => {
                setCalendarOpen((c) => !c);
                setVolumeOpen(false);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(123,140,222,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-xs font-medium leading-tight" style={{ color: '#2D2B55' }}>
                {formatTime(time)}
              </span>
              <span className="text-[10px] leading-tight" style={{ color: '#6B6691' }}>
                {time.toLocaleDateString('en-GB')}
              </span>
            </button>
            <AnimatePresence>
              {calendarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute p-4 rounded-2xl shadow-2xl"
                  style={{
                    bottom: 56,
                    right: 0,
                    width: 288,
                    background: 'rgba(255,255,255,0.40)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.50)',
                    boxShadow: '0 25px 80px rgba(123,140,222,0.20)',
                  }}
                >
                  <MiniCalendar date={time} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <StartMenu open={startOpen} onClose={() => setStartOpen(false)} />

      {/* Auto-updater notification banner */}
      <AnimatePresence>
        {(updaterState.status === 'available' || updaterState.status === 'ready' || updaterState.status === 'downloading') && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            className={`fixed ${isBottom ? 'bottom-20' : 'top-20'} right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl max-w-sm`}
            style={{
              background: 'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.50)',
              boxShadow: '0 25px 80px rgba(123,140,222,0.20)',
            }}
          >
            <icons.RefreshCw className="w-4 h-4 shrink-0" style={{ color: '#7B8CDE' }} />
            <div className="flex-1 min-w-0">
              {updaterState.status === 'available' && (
                <>
                  <p className="font-semibold text-xs" style={{ color: '#2D2B55' }}>Update available — v{updaterState.version}</p>
                  <p className="text-xs" style={{ color: '#6B6691' }}>Kobe Studio update ready to download</p>
                </>
              )}
              {updaterState.status === 'downloading' && (
                <>
                  <p className="font-semibold text-xs" style={{ color: '#2D2B55' }}>Downloading update… {updaterState.percent}%</p>
                  <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(45,43,85,0.10)' }}>
                    <div className="h-full transition-all" style={{ width: `${updaterState.percent}%`, background: '#7B8CDE' }} />
                  </div>
                </>
              )}
              {updaterState.status === 'ready' && (
                <>
                  <p className="font-semibold text-xs" style={{ color: '#2D2B55' }}>Update ready — v{updaterState.version}</p>
                  <p className="text-xs" style={{ color: '#6B6691' }}>Restart to apply</p>
                </>
              )}
            </div>
            {updaterState.status === 'available' && (
              <button
                onClick={download}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors text-white"
                style={{ background: '#7B8CDE' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#6B7CCE')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#7B8CDE')}
              >
                Download
              </button>
            )}
            {updaterState.status === 'ready' && (
              <button
                onClick={install}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors text-white"
                style={{ background: '#5DBE7A' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#4CAE6A')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#5DBE7A')}
              >
                Restart
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MiniCalendar({ date }: { date: Date }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = date.getDate();

  return (
    <div>
      <div className="text-sm font-semibold mb-2" style={{ color: '#2D2B55' }}>
        {date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-[10px] font-medium" style={{ color: '#9B97B1' }}>
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((d) => (
          <div
            key={d}
            className="w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer"
            style={
              d === today
                ? { background: '#7B8CDE', color: '#fff', fontWeight: 600 }
                : { color: '#2D2B55' }
            }
            onMouseEnter={(e) => {
              if (d !== today) e.currentTarget.style.background = 'rgba(123,140,222,0.12)';
            }}
            onMouseLeave={(e) => {
              if (d !== today) e.currentTarget.style.background = 'transparent';
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}
