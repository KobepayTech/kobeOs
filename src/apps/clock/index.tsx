import { useState, useEffect, useCallback, useRef } from 'react';
import * as icons from 'lucide-react';

interface Alarm {
  id: string;
  time: string;
  label: string;
  enabled: boolean;
}

interface TimerState {
  remaining: number;
  running: boolean;
  initial: number;
}

interface StopwatchState {
  elapsed: number;
  running: boolean;
  laps: number[];
}

function loadAlarms(): Alarm[] {
  const raw = localStorage.getItem('kobe_alarms');
  return raw ? JSON.parse(raw) : [];
}
function saveAlarms(a: Alarm[]) { localStorage.setItem('kobe_alarms', JSON.stringify(a)); }

function loadTimer(): TimerState {
  const raw = localStorage.getItem('kobe_timer');
  return raw ? JSON.parse(raw) : { remaining: 300, running: false, initial: 300 };
}
function saveTimer(t: TimerState) { localStorage.setItem('kobe_timer', JSON.stringify(t)); }

function loadStopwatch(): StopwatchState {
  const raw = localStorage.getItem('kobe_stopwatch');
  return raw ? JSON.parse(raw) : { elapsed: 0, running: false, laps: [] };
}
function saveStopwatch(s: StopwatchState) { localStorage.setItem('kobe_stopwatch', JSON.stringify(s)); }

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Clock() {
  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState<'clock' | 'alarm' | 'timer' | 'stopwatch'>('clock');
  const [worldCities] = useState<string[]>(['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']);
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms);
  const [timer, setTimer] = useState<TimerState>(loadTimer);
  const [stopwatch, setStopwatch] = useState<StopwatchState>(loadStopwatch);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    saveAlarms(alarms);
  }, [alarms]);

  useEffect(() => {
    if (timer.running) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev.remaining <= 1) {
            const next = { ...prev, remaining: prev.initial, running: false };
            saveTimer(next);
            return next;
          }
          const next = { ...prev, remaining: prev.remaining - 1 };
          saveTimer(next);
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer.running]);

  useEffect(() => {
    let swInterval: ReturnType<typeof setInterval> | null = null;
    if (stopwatch.running) {
      swInterval = setInterval(() => {
        setStopwatch((prev) => {
          const next = { ...prev, elapsed: prev.elapsed + 1 };
          saveStopwatch(next);
          return next;
        });
      }, 1000);
    }
    return () => {
      if (swInterval) clearInterval(swInterval);
    };
  }, [stopwatch.running]);

  const addAlarm = useCallback(() => {
    const time = prompt('Alarm time (HH:MM):');
    if (!time) return;
    const label = prompt('Label:') ?? 'Alarm';
    const a: Alarm = { id: `al_${Date.now()}`, time, label, enabled: true };
    setAlarms((prev) => [...prev, a]);
  }, []);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  const deleteAlarm = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const setTimerMinutes = useCallback((mins: number) => {
    const s = mins * 60;
    setTimer({ remaining: s, running: false, initial: s });
    saveTimer({ remaining: s, running: false, initial: s });
  }, []);

  const toggleTimer = useCallback(() => {
    setTimer((prev) => {
      const next = { ...prev, running: !prev.running };
      saveTimer(next);
      return next;
    });
  }, []);

  const resetTimer = useCallback(() => {
    setTimer((prev) => {
      const next = { ...prev, remaining: prev.initial, running: false };
      saveTimer(next);
      return next;
    });
  }, []);

  const toggleStopwatch = useCallback(() => {
    setStopwatch((prev) => {
      const next = { ...prev, running: !prev.running };
      saveStopwatch(next);
      return next;
    });
  }, []);

  const resetStopwatch = useCallback(() => {
    const next = { elapsed: 0, running: false, laps: [] };
    setStopwatch(next);
    saveStopwatch(next);
  }, []);

  const lapStopwatch = useCallback(() => {
    setStopwatch((prev) => {
      const next = { ...prev, laps: [prev.elapsed, ...prev.laps] };
      saveStopwatch(next);
      return next;
    });
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-sm text-os-text-primary">
      {/* Tabs */}
      <div className="h-10 flex items-center px-2 border-b border-white/[0.08] gap-1">
        {(['clock', 'alarm', 'timer', 'stopwatch'] as const).map((t) => (
          <button
            key={t}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted hover:bg-white/5'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'clock' && (
          <div className="flex flex-col items-center gap-6">
            {/* Analog */}
            <svg viewBox="0 0 200 200" className="w-48 h-48">
              <circle cx="100" cy="100" r="95" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
              {[...Array(12)].map((_, i) => {
                const angle = ((i + 1) * 30 * Math.PI) / 180;
                const x1 = 100 + 85 * Math.sin(angle);
                const y1 = 100 - 85 * Math.cos(angle);
                const x2 = 100 + 80 * Math.sin(angle);
                const y2 = 100 - 80 * Math.cos(angle);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />;
              })}
              {/* Hour hand */}
              <line
                x1="100" y1="100"
                x2={100 + 50 * Math.sin(((hours % 12 + minutes / 60) * 30 * Math.PI) / 180)}
                y2={100 - 50 * Math.cos(((hours % 12 + minutes / 60) * 30 * Math.PI) / 180)}
                stroke="#f8fafc" strokeWidth="4" strokeLinecap="round"
              />
              {/* Minute hand */}
              <line
                x1="100" y1="100"
                x2={100 + 70 * Math.sin((minutes * 6 * Math.PI) / 180)}
                y2={100 - 70 * Math.cos((minutes * 6 * Math.PI) / 180)}
                stroke="#94a3b8" strokeWidth="3" strokeLinecap="round"
              />
              {/* Second hand */}
              <line
                x1="100" y1="100"
                x2={100 + 75 * Math.sin((seconds * 6 * Math.PI) / 180)}
                y2={100 - 75 * Math.cos((seconds * 6 * Math.PI) / 180)}
                stroke="#ef4444" strokeWidth="1" strokeLinecap="round"
              />
              <circle cx="100" cy="100" r="3" fill="#f8fafc" />
            </svg>

            {/* Digital */}
            <div className="text-4xl font-mono font-bold tracking-wider text-os-text-primary">
              {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>

            {/* World clock */}
            <div className="w-full max-w-md space-y-2">
              {worldCities.map((city) => {
                const time = new Date().toLocaleTimeString('en-GB', { timeZone: city, hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <div key={city} className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                    <span className="text-sm font-medium">{city.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-mono text-os-text-secondary">{time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'alarm' && (
          <div className="space-y-2 max-w-md mx-auto">
            <button className="w-full py-2 rounded-lg bg-os-accent text-white text-sm font-medium" onClick={addAlarm}>
              Add Alarm
            </button>
            {alarms.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                <div>
                  <div className="text-lg font-mono font-semibold">{a.time}</div>
                  <div className="text-xs text-os-text-muted">{a.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={`w-10 h-5 rounded-full transition-colors ${a.enabled ? 'bg-os-accent' : 'bg-white/20'}`}
                    onClick={() => toggleAlarm(a.id)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${a.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20" onClick={() => deleteAlarm(a.id)}>
                    <icons.Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
            {alarms.length === 0 && <div className="text-center text-os-text-muted py-8">No alarms set</div>}
          </div>
        )}

        {tab === 'timer' && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-5xl font-mono font-bold text-os-text-primary">{formatTime(timer.remaining)}</div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-os-accent text-white font-medium" onClick={toggleTimer}>
                {timer.running ? 'Pause' : 'Start'}
              </button>
              <button className="px-4 py-2 rounded-lg bg-white/5 text-os-text-secondary font-medium" onClick={resetTimer}>Reset</button>
            </div>
            <div className="flex gap-2 mt-2">
              {[1, 3, 5, 10, 15, 25].map((m) => (
                <button key={m} className="px-3 py-1 rounded-lg bg-white/5 text-xs text-os-text-muted hover:bg-white/10" onClick={() => setTimerMinutes(m)}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'stopwatch' && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-5xl font-mono font-bold text-os-text-primary">{formatTime(stopwatch.elapsed)}</div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-os-accent text-white font-medium" onClick={toggleStopwatch}>
                {stopwatch.running ? 'Stop' : 'Start'}
              </button>
              <button className="px-4 py-2 rounded-lg bg-white/5 text-os-text-secondary font-medium" onClick={lapStopwatch} disabled={!stopwatch.running}>
                Lap
              </button>
              <button className="px-4 py-2 rounded-lg bg-white/5 text-os-text-secondary font-medium" onClick={resetStopwatch}>Reset</button>
            </div>
            <div className="w-full max-w-sm space-y-1 mt-2">
              {stopwatch.laps.map((l, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 rounded bg-white/5 text-xs">
                  <span className="text-os-text-muted">Lap {stopwatch.laps.length - i}</span>
                  <span className="font-mono">{formatTime(l)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
