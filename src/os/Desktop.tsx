import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Mic,
  MessageSquare,
  Calendar,
  FolderOpen,
  Settings,
  Cloud,
  Music,
  Image,
  StickyNote,
  Bell,
  ShoppingCart,
  Play,
  User,
  Circle,
  CheckCircle2,
  Plus,
  Clock,
  AlertCircle,
  ChevronRight,
  BarChart3,
  Building2,
  Zap,
} from 'lucide-react';
import { useOSStore } from './store';
import { ContextMenu } from './ContextMenu';

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
];

/* ------------------------------------------------------------------ */
/*  Desktop component                                                  */
/* ------------------------------------------------------------------ */
export function Desktop() {
  const { launchApp, showContextMenu, hideContextMenu, contextMenu } = useOSStore();
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
        background: 'linear-gradient(180deg, #0a0a1a 0%, #0f0f2a 40%, #0a0a1a 100%)',
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span
              className="text-lg font-bold tracking-[0.2em] uppercase"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              KOBE
            </span>
          </div>

          {/* Right status icons */}
          <div className="flex items-center gap-1">
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06] active:scale-95">
              <Bell className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06] active:scale-95">
              <ShoppingCart className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-[10px] font-bold flex items-center justify-center text-white">
                3
              </span>
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06] active:scale-95">
              <Play className="w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06] active:scale-95 ml-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                }}
              >
                K
              </div>
            </button>
          </div>
        </div>

        {/* ── Center content ── */}
        <div className="flex-1 w-full max-w-3xl px-6 flex flex-col items-center pt-6 pb-8">
          {/* Heading */}
          <h1
            className="text-3xl sm:text-4xl font-light tracking-tight mb-6 text-center"
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontFamily: "'Inter', Georgia, serif",
              letterSpacing: '-0.02em',
            }}
          >
            What I can do for you?
          </h1>

          {/* Search bar */}
          <div
            className="w-full max-w-xl relative mb-2 transition-all duration-300"
            style={{
              transform: searchFocused ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <div
              className="relative flex items-center w-full h-11 rounded-2xl transition-all duration-300"
              style={{
                background: searchFocused
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.04)',
                border: searchFocused
                  ? '1px solid rgba(255,255,255,0.15)'
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: searchFocused
                  ? '0 0 0 3px rgba(59,130,246,0.15), 0 4px 24px rgba(0,0,0,0.2)'
                  : '0 2px 12px rgba(0,0,0,0.1)',
              }}
            >
              <Search
                className="absolute left-3.5 shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  color: 'rgba(255,255,255,0.35)',
                }}
              />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search for tasks, files, notes.."
                className="w-full h-full bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-white/25"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              />
            </div>
          </div>

          {/* Voice hint */}
          <div className="flex items-center gap-1.5 mb-7">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Press and hold
            </span>
            <kbd
              className="inline-flex items-center justify-center px-1.5 h-4 rounded text-[10px] font-medium"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              S
            </kbd>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              to speak
            </span>
            <Mic
              className="ml-0.5"
              style={{
                width: 11,
                height: 11,
                color: 'rgba(255,255,255,0.3)',
              }}
            />
          </div>

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
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow:
                      '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Icon
                      style={{
                        width: 18,
                        height: 18,
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
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
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          >
            {/* Tasks header */}
            <div className="flex items-center justify-between px-4 py-3">
              <span
                className="text-sm font-medium"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                My Tasks
              </span>
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-white/[0.06] active:scale-95"
                style={{ color: 'rgba(255,255,255,0.5)' }}
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
                    className="flex-1 h-9 px-3 rounded-xl text-sm outline-none placeholder:text-white/20"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  />
                  <button
                    onClick={addTask}
                    className="h-9 px-4 rounded-xl text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/[0.03] group"
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
                          color: '#3b82f6',
                        }}
                      />
                    ) : (
                      <Circle
                        style={{
                          width: 16,
                          height: 16,
                          color: 'rgba(255,255,255,0.2)',
                        }}
                      />
                    )}
                  </button>

                  <span
                    className="flex-1 text-[13px] transition-all"
                    style={{
                      color: task.completed
                        ? 'rgba(255,255,255,0.35)'
                        : 'rgba(255,255,255,0.75)',
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
                          ? 'rgba(59,130,246,0.8)'
                          : task.dueDate === 'Yesterday'
                            ? 'rgba(255,255,255,0.35)'
                            : task.dueDate === 'Tomorrow'
                              ? 'rgba(245,158,11,0.8)'
                              : 'rgba(255,255,255,0.35)',
                      background:
                        task.dueDate === 'Today'
                          ? 'rgba(59,130,246,0.1)'
                          : task.dueDate === 'Tomorrow'
                            ? 'rgba(245,158,11,0.08)'
                            : 'rgba(255,255,255,0.04)',
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
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  No tasks yet. Click "Add Task" to create one.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
