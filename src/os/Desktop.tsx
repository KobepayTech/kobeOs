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
  ShoppingCart,
  Play,
  Circle,
  CheckCircle2,
  Plus,
  Clock,
  AlertCircle,
  BarChart3,
  Building2,
  Zap,
  Plane, Printer, Users, Wallet, Shield, Code2,
  Sun,
  CloudSun,
  StickyNote as NotepadIcon,
  MessageCircle,
  CheckSquare,
} from 'lucide-react';
import { useOSStore } from './store';
import { ContextMenu } from './ContextMenu';
import { WindowManager } from './WindowManager';
import { Taskbar } from './Taskbar';

/* ------------------------------------------------------------------ */
/*  Bokeh orb background  - lavender/purple tones                     */
/* ------------------------------------------------------------------ */
function BokehBackground() {
  const orbs = [
    { x: 15, y: 20, size: 320, color: 'rgba(180,170,230,0.35)', blur: 90 },
    { x: 75, y: 15, size: 280, color: 'rgba(200,180,240,0.30)', blur: 100 },
    { x: 50, y: 60, size: 380, color: 'rgba(160,190,250,0.28)', blur: 110 },
    { x: 85, y: 75, size: 240, color: 'rgba(190,160,235,0.30)', blur: 80 },
    { x: 25, y: 80, size: 300, color: 'rgba(170,180,245,0.25)', blur: 95 },
    { x: 60, y: 35, size: 220, color: 'rgba(200,195,250,0.22)', blur: 70 },
    { x: 10, y: 50, size: 260, color: 'rgba(175,165,235,0.28)', blur: 85 },
    { x: 90, y: 45, size: 290, color: 'rgba(155,185,245,0.25)', blur: 105 },
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
/*  Live Clock Component                                               */
/* ------------------------------------------------------------------ */
function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[time.getDay()];
  const monthName = months[time.getMonth()];
  const dateNum = time.getDate();

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="text-[48px] font-light tracking-tight leading-none"
        style={{
          color: 'var(--os-text-primary)',
          fontFamily: "'Inter', Georgia, serif",
        }}
      >
        {hours}:{minutes}
      </div>
      <div
        className="text-[16px] font-normal"
        style={{ color: 'var(--os-text-secondary)' }}
      >
        {dayName}, {monthName} {dateNum}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget Row                                                         */
/* ------------------------------------------------------------------ */
function WidgetRow({ tasks }: { tasks: Task[] }) {
  const { launchApp } = useOSStore();
  const now = new Date();
  const dateNum = now.getDate();
  const incompleteCount = tasks.filter((t) => !t.completed).length;

  const widgetGlass =
    'flex flex-col items-center justify-center gap-1 glass rounded-2xl transition-all duration-200 hover:scale-105 cursor-pointer';

  return (
    <div className="flex items-center gap-3 mb-6">
      {/* Weather */}
      <button
        className={`${widgetGlass} px-4 py-3 min-w-[110px]`}
        onClick={() => launchApp('settings')}
      >
        <div className="flex items-center gap-1.5">
          <Sun className="w-5 h-5" style={{ color: 'var(--os-warning)' }} />
          <span className="text-[15px] font-semibold" style={{ color: 'var(--os-text-primary)' }}>
            82&deg;
          </span>
        </div>
        <span className="text-[11px] font-medium" style={{ color: 'var(--os-text-secondary)' }}>
          Miami &middot; Sunny
        </span>
      </button>

      {/* Clock */}
      <button
        className={`${widgetGlass} w-14 h-14`}
        onClick={() => launchApp('clock')}
      >
        <Clock className="w-5 h-5" style={{ color: 'var(--os-accent)' }} />
      </button>

      {/* Calendar */}
      <button
        className={`${widgetGlass} w-14 h-14 relative`}
        onClick={() => launchApp('calendar')}
      >
        <Calendar className="w-5 h-5" style={{ color: 'var(--os-accent)' }} />
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--os-accent), #A78BFA)',
            color: 'white',
          }}
        >
          {dateNum}
        </span>
      </button>

      {/* Notes */}
      <button
        className={`${widgetGlass} w-14 h-14`}
        onClick={() => launchApp('notepad')}
      >
        <NotepadIcon className="w-5 h-5" style={{ color: 'var(--os-accent)' }} />
      </button>

      {/* Messages */}
      <button
        className={`${widgetGlass} w-14 h-14`}
        onClick={() => launchApp('chat')}
      >
        <MessageCircle className="w-5 h-5" style={{ color: 'var(--os-accent)' }} />
      </button>

      {/* Tasks */}
      <button
        className={`${widgetGlass} px-4 py-3 min-w-[110px]`}
        onClick={() => {}}
      >
        <div className="flex items-center gap-1.5">
          <CheckSquare className="w-5 h-5" style={{ color: 'var(--os-success)' }} />
          <span className="text-[15px] font-semibold" style={{ color: 'var(--os-text-primary)' }}>
            {incompleteCount}
          </span>
        </div>
        <span className="text-[11px] font-medium" style={{ color: 'var(--os-text-secondary)' }}>
          {incompleteCount === 1 ? 'Task' : 'Tasks'} left
        </span>
      </button>
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
  { id: 'chat', label: 'Messages', icon: MessageSquare, appId: 'chat', iconBg: 'linear-gradient(135deg, rgba(123,140,222,0.25), rgba(167,139,250,0.20))' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, appId: 'calendar', iconBg: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(123,140,222,0.20))' },
  { id: 'files', label: 'Files', icon: FolderOpen, appId: 'file-manager', iconBg: 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(192,132,252,0.20))' },
  { id: 'settings', label: 'Settings', icon: Settings, appId: 'settings', iconBg: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(123,140,222,0.20))' },
  { id: 'erp', label: 'ERP', icon: BarChart3, appId: 'erp-dashboard', iconBg: 'linear-gradient(135deg, rgba(132,204,22,0.25), rgba(163,230,53,0.20))' },
  { id: 'posys', label: 'Property', icon: Building2, appId: 'property', iconBg: 'linear-gradient(135deg, rgba(234,179,8,0.25), rgba(250,204,21,0.20))' },
  { id: 'photos', label: 'Photos', icon: Image, appId: 'image-viewer', iconBg: 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(244,114,182,0.20))' },
  { id: 'notes', label: 'Notes', icon: StickyNote, appId: 'notepad', iconBg: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(251,146,60,0.20))' },
  { id: 'cargo', label: 'KOBECARGO', icon: Plane, appId: 'cargo', iconBg: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(34,211,238,0.20))' },
  { id: 'kobe-print', label: 'KobePrint', icon: Printer, appId: 'kobe-print', iconBg: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(123,140,222,0.20))' },
  { id: 'creator', label: 'Kobe Studio', icon: Users, appId: 'creator', iconBg: 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(192,132,252,0.20))' },
  { id: 'kobe-hotel', label: 'KobeHotel', icon: Building2, appId: 'kobe-hotel', iconBg: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(59,130,246,0.20))' },
  { id: 'kobe-pay', label: 'KobePay', icon: Wallet, appId: 'kobe-pay', iconBg: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(74,222,128,0.20))' },
  { id: 'kobetech-admin', label: 'Kobetech', icon: Shield, appId: 'kobetech-admin', iconBg: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(123,140,222,0.20))' },
  { id: 'kobetech-devops', label: 'DevOps', icon: Code2, appId: 'kobetech-devops', iconBg: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(167,139,250,0.20))' },
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
      style={{
        background: 'var(--os-wallpaper)',
      }}
      onContextMenu={handleBgRightClick}
    >
      <BokehBackground />

      {/* Main content container */}
      <div className="relative z-10 h-full flex flex-col items-center overflow-y-auto scrollbar-hide">
        {/* ── Top Bar ── */}
        <div className="w-full max-w-4xl px-6 pt-5 pb-2 flex items-center justify-between shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, var(--os-accent), #A78BFA)',
              }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-lg font-bold tracking-[0.2em] uppercase"
              style={{ color: 'var(--os-text-primary)' }}
            >
              KOBE
            </span>
          </div>

          {/* Right status icons */}
          <div className="flex items-center gap-1">
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.06] active:scale-95">
              <Bell className="w-[18px] h-[18px]" style={{ color: 'var(--os-text-secondary)' }} />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: 'var(--os-danger)' }}
              />
            </button>
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.06] active:scale-95">
              <ShoppingCart className="w-[18px] h-[18px]" style={{ color: 'var(--os-text-secondary)' }} />
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: 'var(--os-accent)' }}
              >
                3
              </span>
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.06] active:scale-95">
              <Play className="w-[18px] h-[18px]" style={{ color: 'var(--os-text-secondary)' }} />
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.06] active:scale-95 ml-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, var(--os-accent), #A78BFA)',
                  color: 'white',
                }}
              >
                K
              </div>
            </button>
          </div>
        </div>

        {/* ── Center content ── */}
        <div className="flex-1 w-full max-w-3xl px-6 flex flex-col items-center pt-4 pb-8">
          {/* Live Clock */}
          <div className="mb-5">
            <LiveClock />
          </div>

          {/* Search bar */}
          <div
            className="w-full max-w-xl relative mb-2 transition-all duration-300"
            style={{
              transform: searchFocused ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <div
              className="relative flex items-center w-full h-11 rounded-full transition-all duration-300"
              style={{
                background: searchFocused
                  ? 'var(--os-glass-strong-bg)'
                  : 'var(--os-glass-bg)',
                border: searchFocused
                  ? '1px solid var(--os-glass-strong-border)'
                  : '1px solid var(--os-glass-border)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: searchFocused
                  ? '0 0 0 3px rgba(var(--os-accent-rgb),0.15), 0 4px 24px rgba(var(--os-accent-rgb),0.15)'
                  : '0 4px 16px rgba(var(--os-accent-rgb),0.10)',
              }}
            >
              <Search
                className="absolute left-4 shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  color: 'var(--os-text-muted)',
                }}
              />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search Apps"
                className="w-full h-full bg-transparent pl-11 pr-4 text-sm outline-none"
                style={{
                  color: 'var(--os-text-primary)',
                }}
              />
            </div>
          </div>

          {/* Voice hint */}
          <div className="flex items-center gap-1.5 mb-6">
            <span className="text-[11px]" style={{ color: 'var(--os-text-muted)' }}>
              Press and hold
            </span>
            <kbd
              className="inline-flex items-center justify-center px-1.5 h-4 rounded text-[10px] font-medium"
              style={{
                background: 'rgba(var(--os-accent-rgb),0.12)',
                color: 'var(--os-text-secondary)',
                border: '1px solid rgba(var(--os-accent-rgb),0.15)',
              }}
            >
              S
            </kbd>
            <span className="text-[11px]" style={{ color: 'var(--os-text-muted)' }}>
              to speak
            </span>
            <Mic
              className="ml-0.5"
              style={{
                width: 11,
                height: 11,
                color: 'var(--os-text-muted)',
              }}
            />
          </div>

          {/* Widget Row */}
          <WidgetRow tasks={tasks} />

          {/* App shortcuts grid */}
          <div className="w-full grid grid-cols-4 gap-3 mb-6">
            {(searchQuery ? filteredApps : appShortcuts).map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  onClick={() => launchApp(app.appId)}
                  className="group flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: 'var(--os-widget-bg)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid var(--os-glass-border)',
                    boxShadow:
                      '0 8px 32px rgba(123,140,222,0.10), inset 0 1px 0 rgba(255,255,255,0.50)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{
                      background: app.iconBg,
                    }}
                  >
                    <Icon
                      style={{
                        width: 18,
                        height: 18,
                        color: 'var(--os-text-primary)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--os-text-primary)' }}
                  >
                    {app.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* My Tasks section */}
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{
              background: 'var(--os-widget-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--os-glass-border)',
              boxShadow: '0 8px 32px rgba(var(--os-accent-rgb),0.10)',
            }}
          >
            {/* Tasks header */}
            <div className="flex items-center justify-between px-4 py-3">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--os-text-primary)' }}
              >
                My Tasks
              </span>
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.06] active:scale-95"
                style={{ color: 'var(--os-text-secondary)' }}
              >
                <Plus style={{ width: 12, height: 12 }} />
                Add Task
              </button>
            </div>

            {/* Add task input */}
            {showAddTask && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addTask();
                      if (e.key === 'Escape') {
                        setShowAddTask(false);
                        setNewTaskText('');
                      }
                    }}
                    placeholder="Enter a new task..."
                    autoFocus
                    className="flex-1 h-9 px-3 rounded-xl text-sm outline-none placeholder:text-[var(--os-text-muted)]"
                    style={{
                      background: 'var(--os-glass-border)',
                      border: '1px solid rgba(255,255,255,0.50)',
                      color: 'var(--os-text-primary)',
                    }}
                  />
                  <button
                    onClick={addTask}
                    className="h-9 px-4 rounded-xl text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, var(--os-accent), #A78BFA)',
                      color: 'white',
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Task list */}
            <div className="px-2 pb-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.08] group"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="shrink-0 transition-all active:scale-90"
                  >
                    {task.completed ? (
                      <CheckCircle2
                        style={{
                          width: 16,
                          height: 16,
                          color: 'var(--os-accent)',
                        }}
                      />
                    ) : (
                      <Circle
                        style={{
                          width: 16,
                          height: 16,
                          color: 'var(--os-text-muted)',
                        }}
                      />
                    )}
                  </button>

                  <span
                    className="flex-1 text-[13px] transition-all"
                    style={{
                      color: task.completed ? 'var(--os-text-muted)' : 'var(--os-text-primary)',
                      textDecoration: task.completed ? 'line-through' : 'none',
                    }}
                  >
                    {task.text}
                  </span>

                  <span
                    className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                    style={{
                      color:
                        task.dueDate === 'Today'
                          ? 'var(--os-accent)'
                          : task.dueDate === 'Yesterday'
                            ? 'var(--os-text-muted)'
                            : task.dueDate === 'Tomorrow'
                              ? 'var(--os-warning)'
                              : '#9B97B1',
                      background:
                        task.dueDate === 'Today'
                          ? 'rgba(123,140,222,0.12)'
                          : task.dueDate === 'Tomorrow'
                            ? 'rgba(232,169,58,0.10)'
                            : 'rgba(123,140,222,0.06)',
                    }}
                  >
                    {task.dueDate === 'Today' && (
                      <Clock style={{ width: 9, height: 9 }} />
                    )}
                    {task.dueDate === 'Tomorrow' && (
                      <AlertCircle style={{ width: 9, height: 9 }} />
                    )}
                    {task.dueDate === 'Next' && (
                      <Calendar style={{ width: 9, height: 9 }} />
                    )}
                    {task.dueLabel}
                  </span>
                </div>
              ))}

              {tasks.length === 0 && (
                <div
                  className="text-center py-6 text-xs"
                  style={{ color: 'var(--os-text-muted)' }}
                >
                  No tasks yet. Click &quot;Add Task&quot; to create one.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
