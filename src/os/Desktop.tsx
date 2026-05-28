import { useState, useCallback, useEffect, useRef } from 'react';
import { appRegistry } from './registry';
import {
  Search,
  Mic,
  MessageSquare,
  Calendar,
  FolderOpen,
  Settings,
  Image,
  StickyNote,
  Bell,
  Circle,
  CheckCircle2,
  Plus,
  BarChart3,
  Building2,
  Plane, Printer, Users, Wallet, Shield, Code2, PlaneTakeoff,
} from 'lucide-react';
import { useOSStore } from './store';
import { ContextMenu } from './ContextMenu';
import { WindowManager } from './WindowManager';
import { Taskbar } from './Taskbar';

/* ------------------------------------------------------------------ */
/*  Bokeh orb background                                               */
/* ------------------------------------------------------------------ */
function BokehBackground() {
  const orbs = [
    { x: 15, y: 20, size: 280, color: 'rgba(99,102,241,0.12)', blur: 80 },
    { x: 75, y: 15, size: 240, color: 'rgba(139,92,246,0.10)', blur: 90 },
    { x: 50, y: 60, size: 320, color: 'rgba(59,130,246,0.08)', blur: 100 },
    { x: 85, y: 75, size: 200, color: 'rgba(168,85,247,0.09)', blur: 70 },
    { x: 25, y: 80, size: 260, color: 'rgba(79,70,229,0.07)', blur: 85 },
    { x: 60, y: 35, size: 180, color: 'rgba(99,102,241,0.06)', blur: 60 },
    { x: 10, y: 50, size: 220, color: 'rgba(139,92,246,0.05)', blur: 75 },
    { x: 90, y: 45, size: 250, color: 'rgba(59,130,246,0.07)', blur: 95 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: `blur(${orb.blur}px)`,
            animationDelay: `${i * 1.5}s`,
            animationDuration: `${12 + i * 2}s`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task type                                                          */
/* ------------------------------------------------------------------ */
interface Task {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string;
  dueLabel: string;
}

/* ------------------------------------------------------------------ */
/*  App shortcut data                                                  */
/* ------------------------------------------------------------------ */
const appShortcuts = [
  { id: 'chat', label: 'Messages', icon: MessageSquare, appId: 'chat' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, appId: 'calendar' },
  { id: 'files', label: 'Files', icon: FolderOpen, appId: 'file-manager' },
  { id: 'settings', label: 'Settings', icon: Settings, appId: 'settings' },
  { id: 'erp', label: 'ERP', icon: BarChart3, appId: 'erp-dashboard' },
  { id: 'posys', label: 'Property', icon: Building2, appId: 'property' },
  { id: 'photos', label: 'Photos', icon: Image, appId: 'image-viewer' },
  { id: 'notes', label: 'Notes', icon: StickyNote, appId: 'notepad' },
  { id: 'cargo', label: 'KOBECARGO', icon: Plane, appId: 'cargo' },
  { id: 'kobe-cargo-exchange', label: 'Cargo Exchange', icon: PlaneTakeoff, appId: 'kobe-cargo-exchange' },
  { id: 'kobe-print', label: 'KobePrint', icon: Printer, appId: 'kobe-print' },
  { id: 'creator', label: 'Kobe Studio', icon: Users, appId: 'creator' },
  { id: 'kobe-hotel', label: 'KobeHotel', icon: Building2, appId: 'kobe-hotel' },
  { id: 'kobe-pay', label: 'KobePay', icon: Wallet, appId: 'kobe-pay' },
  { id: 'kobetech-admin', label: 'Kobetech', icon: Shield, appId: 'kobetech-admin' },
  { id: 'kobetech-devops', label: 'DevOps', icon: Code2, appId: 'kobetech-devops' },
];

/* ------------------------------------------------------------------ */
/*  Desktop component                                                  */
/* ------------------------------------------------------------------ */
export function Desktop() {
  const { launchApp, showContextMenu, hideContextMenu, contextMenu, setApps, refreshLicense } = useOSStore();

  // Register all apps and verify the stored license token on first mount.
  useEffect(() => {
    setApps(appRegistry);
    refreshLicense();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* tasks */
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      text: 'Review Q2 financial reports',
      completed: false,
      dueDate: 'Today',
      dueLabel: 'Today',
    },
    {
      id: '2',
      text: 'Finalize property lease agreement',
      completed: true,
      dueDate: 'Yesterday',
      dueLabel: 'Yesterday',
    },
    {
      id: '3',
      text: 'Update inventory stock levels',
      completed: false,
      dueDate: 'Tomorrow',
      dueLabel: 'Due Tomorrow',
    },
    {
      id: '4',
      text: 'Schedule maintenance for Unit 4B',
      completed: false,
      dueDate: 'Next',
      dueLabel: 'May 12',
    },
  ]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  /* keyboard shortcut: press 's' to focus search */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 's' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const addTask = useCallback(() => {
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: `task_${Date.now()}`,
      text: newTaskText.trim(),
      completed: false,
      dueDate: 'Today',
      dueLabel: 'Today',
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTaskText('');
    setShowAddTask(false);
  }, [newTaskText]);

  const handleBgRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        {
          id: 'refresh',
          label: 'Refresh',
          icon: 'RefreshCw',
          action: () => window.location.reload(),
        },
        {
          id: 'sep1',
          label: '',
          action: () => {},
          separator: true,
        },
        {
          id: 'display',
          label: 'Display Settings',
          icon: 'Monitor',
          action: () => launchApp('settings'),
        },
      ]);
    },
    [showContextMenu, launchApp]
  );

  const filteredApps = appShortcuts.filter((a) =>
    a.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ── render ── */
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #0f0f2a 40%, #0a0a1a 100%)' }}
      onContextMenu={handleBgRightClick}
    >
      <BokehBackground />

      {/* Tortoise watermark — faint centered background logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <svg viewBox="0 0 200 200" className="w-[420px] h-[420px] opacity-[0.025]" fill="white">
          {/* Shell */}
          <ellipse cx="100" cy="105" rx="62" ry="52" />
          {/* Shell pattern */}
          <ellipse cx="100" cy="105" rx="38" ry="30" fill="none" stroke="black" strokeWidth="3"/>
          <line x1="100" y1="53" x2="100" y2="157" stroke="black" strokeWidth="2.5"/>
          <line x1="38" y1="105" x2="162" y2="105" stroke="black" strokeWidth="2.5"/>
          <line x1="55" y1="65" x2="145" y2="145" stroke="black" strokeWidth="2"/>
          <line x1="145" y1="65" x2="55" y2="145" stroke="black" strokeWidth="2"/>
          {/* Head */}
          <ellipse cx="100" cy="44" rx="16" ry="13" />
          {/* Eyes */}
          <circle cx="93" cy="40" r="2.5" fill="black"/>
          <circle cx="107" cy="40" r="2.5" fill="black"/>
          {/* Front legs */}
          <ellipse cx="46" cy="80" rx="12" ry="7" transform="rotate(-30 46 80)"/>
          <ellipse cx="154" cy="80" rx="12" ry="7" transform="rotate(30 154 80)"/>
          {/* Back legs */}
          <ellipse cx="52" cy="140" rx="12" ry="7" transform="rotate(30 52 140)"/>
          <ellipse cx="148" cy="140" rx="12" ry="7" transform="rotate(-30 148 140)"/>
          {/* Tail */}
          <path d="M100 157 Q108 172 104 182" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Main layout — fixed height, no scroll */}
      <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ paddingBottom: '56px' /* taskbar height */ }}>

        {/* ── Top Bar ── */}
        <div className="w-full px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#logoGrad)"/>
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#3b82f6"/>
                  <stop offset="100%" stopColor="#6366f1"/>
                </linearGradient>
              </defs>
              {/* Mini tortoise in logo */}
              <ellipse cx="20" cy="22" rx="10" ry="8" fill="white" fillOpacity="0.9"/>
              <ellipse cx="20" cy="22" rx="6" ry="4.5" fill="none" stroke="#3b82f6" strokeWidth="1.2"/>
              <ellipse cx="20" cy="12" rx="4" ry="3.2" fill="white" fillOpacity="0.9"/>
              <ellipse cx="11" cy="17" rx="3.5" ry="2" transform="rotate(-30 11 17)" fill="white" fillOpacity="0.7"/>
              <ellipse cx="29" cy="17" rx="3.5" ry="2" transform="rotate(30 29 17)" fill="white" fillOpacity="0.7"/>
              <ellipse cx="12" cy="28" rx="3.5" ry="2" transform="rotate(30 12 28)" fill="white" fillOpacity="0.7"/>
              <ellipse cx="28" cy="28" rx="3.5" ry="2" transform="rotate(-30 28 28)" fill="white" fillOpacity="0.7"/>
            </svg>
            <div>
              <div className="text-sm font-bold tracking-[0.15em] uppercase leading-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>KOBEOS</div>
              <div className="text-[9px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Business Platform</div>
            </div>
          </div>

          {/* Search — centered */}
          <div
            className="flex-1 max-w-sm mx-6 relative transition-all duration-300"
            style={{ transform: searchFocused ? 'scale(1.02)' : 'scale(1)' }}
          >
            <div
              className="relative flex items-center w-full h-9 rounded-xl transition-all duration-300"
              style={{
                background: searchFocused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: searchFocused ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: searchFocused ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
              }}
            >
              <Search className="absolute left-3 shrink-0 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search apps…"
                className="w-full h-full bg-transparent pl-9 pr-3 text-xs outline-none placeholder:text-white/25"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              />
              <Mic className="absolute right-3 w-3 h-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
            </div>
          </div>

          {/* Right status */}
          <div className="flex items-center gap-1">
            <button className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06]">
              <Bell className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>
            <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06] ml-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white' }}>K</div>
            </button>
          </div>
        </div>

        {/* ── App Grid — fills all remaining space ── */}
        <div className="flex-1 px-5 py-2 overflow-hidden flex flex-col">
          {/* Grid fills available height, no scroll */}
          <div
            className="flex-1 overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gridAutoRows: '1fr',
              gap: '10px',
              alignContent: 'start',
            }}
          >
            {(searchQuery ? filteredApps : appShortcuts).map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  onClick={() => launchApp(app.appId)}
                  className="group flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                    padding: '10px 8px',
                    minHeight: '80px',
                    maxHeight: '96px',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Icon style={{ width: 17, height: 17, color: 'rgba(255,255,255,0.75)' }} />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight line-clamp-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {app.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Tasks strip — compact, below grid ── */}
          <div
            className="shrink-0 mt-2 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>My Tasks</span>
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-white/[0.06]"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <Plus style={{ width: 10, height: 10 }} />Add
              </button>
            </div>

            {showAddTask && (
              <div className="px-4 pb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTask();
                    if (e.key === 'Escape') { setShowAddTask(false); setNewTaskText(''); }
                  }}
                  placeholder="New task…"
                  autoFocus
                  className="flex-1 h-8 px-3 rounded-lg text-xs outline-none placeholder:text-white/20"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                />
                <button onClick={addTask} className="h-8 px-3 rounded-lg text-xs font-medium" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white' }}>Add</button>
              </div>
            )}

            <div className="flex gap-2 px-3 pb-2 overflow-x-auto scrollbar-hide">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:bg-white/[0.04]"
                  style={{
                    background: task.completed ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${task.completed ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  {task.completed
                    ? <CheckCircle2 style={{ width: 12, height: 12, color: '#3b82f6' }} />
                    : <Circle style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }} />
                  }
                  <span className="text-[10px] whitespace-nowrap" style={{ color: task.completed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.65)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.text}
                  </span>
                  <span className="text-[9px] ml-1" style={{ color: task.dueDate === 'Today' ? 'rgba(59,130,246,0.7)' : task.dueDate === 'Tomorrow' ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.25)' }}>
                    {task.dueLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>{/* end main layout */}

      {/* Open application windows */}
      <WindowManager />

      {/* Taskbar */}
      <Taskbar />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
}
