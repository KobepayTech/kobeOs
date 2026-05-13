import { useState, useEffect, useRef } from 'react';
import {
  Activity, Cpu, HardDrive, Network, ChevronUp, ChevronDown,
  Terminal, Timer, Zap, Trash2, Settings
} from 'lucide-react';

interface Process {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
  status: 'running' | 'sleeping' | 'idle';
  uptime: number;
}

interface StartupItem {
  id: string;
  name: string;
  enabled: boolean;
  type: 'system' | 'user';
}

const PROCESS_NAMES = [
  'kernel_task', 'launchd', 'window_server', 'dock', 'finder',
  'chrome', 'firefox', 'safari', 'node', 'python3',
  'postgres', 'redis-server', 'nginx', 'sshd', 'systemd',
  'docker', 'vscode', 'slack', 'spotify', 'zoom',
];

const USERS = ['root', 'kobe', 'system', 'admin', 'daemon'];

function makeInitialProcesses(): Process[] {
  return PROCESS_NAMES.map((name, i) => ({
    pid: 1000 + i * 17,
    name,
    user: USERS[i % USERS.length],
    cpu: Math.random() * 15,
    memory: Math.random() * 500 + 20,
    status: Math.random() > 0.3 ? 'running' : 'sleeping',
    uptime: Math.floor(Math.random() * 86400 * 7),
  }));
}

const INITIAL_STARTUP: StartupItem[] = [
  { id: 's1', name: 'Docker Desktop', enabled: true, type: 'system' },
  { id: 's2', name: 'VS Code', enabled: true, type: 'user' },
  { id: 's3', name: 'Slack', enabled: true, type: 'user' },
  { id: 's4', name: 'Spotify', enabled: false, type: 'user' },
  { id: 's5', name: 'Dropbox', enabled: true, type: 'system' },
  { id: 's6', name: '1Password', enabled: true, type: 'user' },
  { id: 's7', name: 'Zoom', enabled: false, type: 'user' },
  { id: 's8', name: 'iCloud', enabled: true, type: 'system' },
];

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function SortIcon({ col, sortCol, sortDir }: { col: keyof Process; sortCol: keyof Process; sortDir: 'asc' | 'desc' }) {
  if (sortCol !== col) return <ChevronUp className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-50" />;
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />;
}

export default function TaskManagerApp() {
  const [processes, setProcesses] = useState<Process[]>(makeInitialProcesses);
  const [startup, setStartup] = useState<StartupItem[]>(INITIAL_STARTUP);
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(60).fill(0));
  const [memHistory, setMemHistory] = useState<number[]>(Array(60).fill(0));
  const [cpuPercent, setCpuPercent] = useState(15);
  const [memPercent, setMemPercent] = useState(42);
  const [diskActive, setDiskActive] = useState(5);
  const [netActive, setNetActive] = useState(12);
  const [tab, setTab] = useState<'processes' | 'performance' | 'startup'>('processes');
  const [sortCol, setSortCol] = useState<keyof Process>('cpu');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [notif, setNotif] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cpuRef = useRef(15);
  const memRef = useRef(42);
  useEffect(() => {
    const interval = setInterval(() => {
      setProcesses(prev => prev.map(p => {
        const cpuDelta = (Math.random() - 0.5) * 6;
        const memDelta = (Math.random() - 0.5) * 30;
        return {
          ...p,
          cpu: Math.max(0, Math.min(40, p.cpu + cpuDelta)),
          memory: Math.max(10, Math.min(800, p.memory + memDelta)),
          uptime: p.uptime + 2,
        };
      }));
      const nextCpu = Math.max(10, Math.min(40, cpuRef.current + (Math.random() - 0.5) * 8));
      const nextMem = Math.max(30, Math.min(70, memRef.current + (Math.random() - 0.5) * 4));
      cpuRef.current = nextCpu;
      memRef.current = nextMem;
      setCpuPercent(nextCpu);
      setMemPercent(nextMem);
      setCpuHistory(h => [...h.slice(1), nextCpu]);
      setMemHistory(h => [...h.slice(1), nextMem]);
      setDiskActive(prev => Math.max(0, Math.min(50, prev + (Math.random() - 0.5) * 10)));
      setNetActive(prev => Math.max(0, Math.min(80, prev + (Math.random() - 0.5) * 15)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Canvas chart drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tab !== 'performance') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = (w / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // CPU line
    const drawLine = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (val / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill
      ctx.beginPath();
      ctx.fillStyle = color.replace('1)', '0.15)');
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (val / 100) * h;
        if (i === 0) { ctx.moveTo(x, y); ctx.lineTo(x, h); }
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    };

    drawLine(cpuHistory, 'rgba(59, 130, 246, 1)');
    drawLine(memHistory, 'rgba(16, 185, 129, 1)');

  }, [cpuHistory, memHistory, tab]);

  const handleSort = (col: keyof Process) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sortedProcesses = [...processes].sort((a, b) => {
    const va = a[sortCol];
    const vb = b[sortCol];
    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    return 0;
  });

  const killProcess = (pid: number, name: string) => {
    setProcesses(prev => prev.filter(p => p.pid !== pid));
    setNotif(`Process ${name} (PID ${pid}) terminated`);
    setTimeout(() => setNotif(null), 3000);
  };

  const toggleStartup = (id: string) => {
    setStartup(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const statusColor = (s: string) => {
    if (s === 'running') return 'text-emerald-400';
    if (s === 'sleeping') return 'text-blue-400';
    return 'text-slate-500';
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden font-mono text-xs">
      {/* Top Bar with resource meters */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-sm text-slate-100">Task Manager</span>
        </div>
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out"
                style={{ width: `${cpuPercent}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">CPU {cpuPercent.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out"
                style={{ width: `${memPercent}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">MEM {memPercent.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-28">
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000 ease-out"
                style={{ width: `${diskActive}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">DISK</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-28">
            <Network className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-1000 ease-out"
                style={{ width: `${netActive}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">NET</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-1 border-b border-slate-800 shrink-0 bg-slate-900/30">
        {[
          { id: 'processes', label: 'Processes', icon: Activity },
          { id: 'performance', label: 'Performance', icon: Zap },
          { id: 'startup', label: 'Startup', icon: Timer },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
              tab === t.id ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification */}
      {notif && (
        <div className="absolute top-14 right-4 z-50 bg-slate-800 border border-emerald-500/30 text-emerald-400 px-3 py-2 rounded-lg text-xs shadow-xl flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5" />
          {notif}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'processes' && (
          <div className="h-full flex flex-col">
            {/* Table header */}
            <div className="flex items-center px-4 py-2 border-b border-slate-800 bg-slate-900/30 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <button onClick={() => handleSort('pid')} className="group flex items-center gap-1 w-16 text-left hover:text-slate-200 transition-colors">
                PID <SortIcon col="pid" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('name')} className="group flex items-center gap-1 flex-1 text-left hover:text-slate-200 transition-colors">
                Name <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('user')} className="group flex items-center gap-1 w-20 text-left hover:text-slate-200 transition-colors">
                User <SortIcon col="user" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('cpu')} className="group flex items-center gap-1 w-16 text-right hover:text-slate-200 transition-colors">
                CPU% <SortIcon col="cpu" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('memory')} className="group flex items-center gap-1 w-20 text-right hover:text-slate-200 transition-colors">
                Memory <SortIcon col="memory" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('status')} className="group flex items-center gap-1 w-20 text-left hover:text-slate-200 transition-colors">
                Status <SortIcon col="status" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <button onClick={() => handleSort('uptime')} className="group flex items-center gap-1 w-24 text-left hover:text-slate-200 transition-colors">
                Uptime <SortIcon col="uptime" sortCol={sortCol} sortDir={sortDir} />
              </button>
              <div className="w-16 text-right">Action</div>
            </div>
            {/* Table body */}
            <div className="flex-1 overflow-y-auto">
              {sortedProcesses.map(p => (
                <div key={p.pid} className="flex items-center px-4 py-1.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <div className="w-16 text-slate-400">{p.pid}</div>
                  <div className="flex-1 text-slate-200 font-medium truncate pr-2">{p.name}</div>
                  <div className="w-20 text-slate-400 truncate">{p.user}</div>
                  <div className={`w-16 text-right font-bold ${p.cpu > 20 ? 'text-red-400' : p.cpu > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{p.cpu.toFixed(1)}%</div>
                  <div className="w-20 text-right text-slate-400">{p.memory.toFixed(0)} MB</div>
                  <div className={`w-20 ${statusColor(p.status)}`}>{p.status}</div>
                  <div className="w-24 text-slate-500">{formatUptime(p.uptime)}</div>
                  <div className="w-16 text-right">
                    <button
                      onClick={() => killProcess(p.pid, p.name)}
                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="End process"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-1.5 border-t border-slate-800 bg-slate-900/30 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
              <span>{processes.length} processes running</span>
              <span>Refresh: 2s</span>
            </div>
          </div>
        )}

        {tab === 'performance' && (
          <div className="h-full overflow-y-auto p-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-slate-200">CPU Usage History</span>
                </div>
                <span className="text-xs text-blue-400 font-mono">{cpuPercent.toFixed(1)}%</span>
              </div>
              <div className="h-40 bg-slate-950 rounded border border-slate-800 overflow-hidden">
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-1 bg-blue-500 rounded" />
                  <span>CPU</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-1 bg-emerald-500 rounded" />
                  <span>Memory</span>
                </div>
                <span className="ml-auto">60s window</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">CPU</span>
                </div>
                <div className="text-lg font-bold text-blue-400 mb-1">{cpuPercent.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500">8 cores / 16 threads</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Memory</span>
                </div>
                <div className="text-lg font-bold text-emerald-400 mb-1">{memPercent.toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500">{(memPercent * 0.32).toFixed(1)} GB / 32 GB</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-200">Network</span>
                </div>
                <div className="text-lg font-bold text-purple-400 mb-1">{(netActive * 12.5).toFixed(0)} MB/s</div>
                <div className="text-[10px] text-slate-500">Wi-Fi 6E</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'startup' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center px-4 py-2 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex-1">Application</div>
                <div className="w-20">Type</div>
                <div className="w-24 text-right">Status</div>
              </div>
              {startup.map(item => (
                <div key={item.id} className="flex items-center px-4 py-2.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">{item.name}</span>
                  </div>
                  <div className="w-20">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${item.type === 'system' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="w-24 text-right">
                    <button
                      onClick={() => toggleStartup(item.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${item.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
