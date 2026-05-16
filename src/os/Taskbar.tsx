import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOSStore } from './store';
import { StartMenu } from './StartMenu';

export function Taskbar() {
  const {
    windows,
    settings,
    getApp,
    focusWindow,
    launchApp,
  } = useOSStore();
  const unreadCount = useOSStore((s) => s.unreadCount);

  const [startOpen, setStartOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const posClass = settings.taskbarPosition === 'top' ? 'top-0' : 'bottom-0';

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
      <div
        className={`fixed ${posClass} left-0 right-0 h-12 flex items-center justify-between px-2 select-none z-[200]`}
        style={{
          background: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: settings.taskbarPosition === 'bottom' ? '1px solid rgba(255,255,255,0.05)' : 'none',
          borderBottom: settings.taskbarPosition === 'top' ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}
      >
        {/* Start Button */}
        <button
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            startOpen ? 'bg-white/15' : 'hover:bg-white/10'
          }`}
          onClick={() => setStartOpen((s) => !s)}
        >
          <icons.Hexagon className="w-6 h-6 text-os-accent" />
        </button>

        {/* Pinned + Open Windows */}
        <div className="flex items-center gap-1 flex-1 px-2 overflow-hidden">
          {settings.pinnedApps.map((appId) => {
            const app = getApp(appId);
            if (!app) return null;
            const Icon = (icons[app.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.Circle;
            const isOpen = openWindows.some((w) => w.appId === appId);
            return (
              <button
                key={appId}
                className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors group"
                onClick={() => {
                  const existing = windows.find((w) => w.appId === appId && !w.isMinimized);
                  if (existing) {
                    focusWindow(existing.id);
                  } else {
                    launchApp(appId);
                  }
                }}
                title={app.name}
              >
                <Icon className="w-5 h-5 text-os-text-primary" />
                {isOpen && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-os-accent" />
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
                  className={`h-10 px-2 flex items-center gap-2 rounded-lg transition-colors max-w-[160px] ${
                    w.isFocused ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  onClick={() => focusWindow(w.id)}
                >
                  <Icon className="w-4 h-4 text-os-text-primary shrink-0" />
                  <span className="text-xs text-os-text-primary truncate">{w.title}</span>
                </button>
              );
            })}
        </div>

        {/* System Tray */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => {
                setVolumeOpen((v) => !v);
                setCalendarOpen(false);
              }}
            >
              <icons.Volume2 className="w-4 h-4 text-os-text-secondary" />
            </button>
            <AnimatePresence>
              {volumeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-12 right-0 w-48 p-4 rounded-xl border border-white/10 bg-[#1e293b] shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <icons.Volume2 className="w-4 h-4 text-os-text-secondary" />
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full w-3/4 bg-os-accent rounded-full" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <icons.Wifi className="w-4 h-4 text-os-text-secondary" />
          </button>

          <div className="relative">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors relative"
              onClick={() => {
                setCalendarOpen(false);
                setVolumeOpen(false);
              }}
            >
              <icons.Bell className="w-4 h-4 text-os-text-secondary" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative">
            <button
              className="h-10 px-3 flex flex-col items-end justify-center rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => {
                setCalendarOpen((c) => !c);
                setVolumeOpen(false);
              }}
            >
              <span className="text-xs font-medium text-os-text-primary leading-tight">
                {formatTime(time)}
              </span>
              <span className="text-[10px] text-os-text-muted leading-tight">
                {time.toLocaleDateString('en-GB')}
              </span>
            </button>
            <AnimatePresence>
              {calendarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-12 right-0 p-4 rounded-xl border border-white/10 bg-[#1e293b] shadow-2xl w-72"
                >
                  <MiniCalendar date={time} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <StartMenu open={startOpen} onClose={() => setStartOpen(false)} />
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
      <div className="text-sm font-semibold text-os-text-primary mb-2">
        {date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-[10px] text-os-text-muted font-medium">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((d) => (
          <div
            key={d}
            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs ${
              d === today
                ? 'bg-os-accent text-white font-semibold'
                : 'text-os-text-secondary hover:bg-white/5'
            }`}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}
