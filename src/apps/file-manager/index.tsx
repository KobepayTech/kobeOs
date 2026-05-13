import { useState, useEffect, useCallback, useMemo } from 'react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fs } from '@/os/fs';
import { useOSStore } from '@/os/store';
import type { FSNode } from '@/os/types';

export default function FileManager() {
  const [path, setPath] = useState('/home/user');
  const [items, setItems] = useState<FSNode[]>(() => fs.readdir('/home/user'));
  const [history, setHistory] = useState<string[]>(['/home/user']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const launchApp = useOSStore((s) => s.launchApp);

  const refresh = useCallback(() => {
    const nodes = fs.readdir(path);
    setItems(nodes);
  }, [path]);

  useEffect(() => {
    setItems(fs.readdir(path));
  }, [path]);

  const navigate = useCallback(
    (newPath: string) => {
      if (!fs.exists(newPath)) return;
      const nextHistory = history.slice(0, historyIdx + 1);
      nextHistory.push(newPath);
      setHistory(nextHistory);
      setHistoryIdx(nextHistory.length - 1);
      setPath(newPath);
      setSelected(null);
    },
    [history, historyIdx]
  );

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setPath(history[idx]);
      setSelected(null);
    }
  }, [history, historyIdx]);

  const goUp = useCallback(() => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return;
    parts.pop();
    const parent = '/' + parts.join('/');
    navigate(parent);
  }, [path, navigate]);

  const onDoubleClick = useCallback(
    (node: FSNode) => {
      if (node.type === 'directory') {
        navigate(path + '/' + node.name);
      } else {
        const mime = node.mimeType ?? 'text/plain';
        if (mime.startsWith('text/') || mime === 'application/json') {
          launchApp('text-editor', { filePath: path + '/' + node.name });
        }
      }
    },
    [path, navigate, launchApp]
  );

  const createFolder = useCallback(() => {
    const name = prompt('Folder name:');
    if (!name) return;
    fs.mkdir(path + '/' + name);
    refresh();
  }, [path, refresh]);

  const deleteNode = useCallback(() => {
    if (!selected) return;
    const node = items.find((i) => i.id === selected);
    if (!node) return;
    if (!confirm(`Delete ${node.name}?`)) return;
    fs.delete(path + '/' + node.name);
    setSelected(null);
    refresh();
  }, [selected, items, path, refresh]);

  const breadcrumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    const crumbs = [{ label: 'Home', path: '/home/user' }];
    let acc = '/home/user';
    for (const p of parts.slice(2)) {
      acc += '/' + p;
      crumbs.push({ label: p, path: acc });
    }
    return crumbs;
  }, [path]);

  const getIcon = (node: FSNode): LucideIcon => {
    if (node.type === 'directory') return icons.Folder;
    const mime = node.mimeType ?? '';
    if (mime.startsWith('image/')) return icons.Image;
    if (mime.startsWith('audio/')) return icons.Music;
    if (mime.startsWith('video/')) return icons.Video;
    if (mime.includes('json') || mime.includes('javascript')) return icons.FileCode;
    return icons.FileText;
  };

  const sidebarItems = [
    { label: 'Home', path: '/home/user', icon: icons.Home },
    { label: 'Documents', path: '/home/user/Documents', icon: icons.FileText },
    { label: 'Pictures', path: '/home/user/Pictures', icon: icons.Image },
    { label: 'Music', path: '/home/user/Music', icon: icons.Music },
    { label: 'Downloads', path: '/home/user/Downloads', icon: icons.Download },
    { label: 'Desktop', path: '/home/user/Desktop', icon: icons.Monitor },
  ];

  return (
    <div className="flex h-full text-sm text-os-text-primary bg-[#0f172a]">
      {/* Sidebar */}
      <div className="w-48 border-r border-white/[0.08] flex flex-col bg-[#0f172a]">
        <div className="p-2">
          <div className="text-[10px] font-semibold text-os-text-muted uppercase tracking-wider px-2 mb-1">
            Quick Access
          </div>
          {sidebarItems.map((si) => {
            const Icon = si.icon;
            return (
              <button
                key={si.path}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                  path === si.path ? 'bg-white/10 text-os-accent' : 'hover:bg-white/5 text-os-text-secondary'
                }`}
                onClick={() => navigate(si.path)}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{si.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-10 flex items-center gap-1 px-2 border-b border-white/[0.08]">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            onClick={goBack}
            disabled={historyIdx === 0}
          >
            <icons.ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            onClick={goUp}
          >
            <icons.ChevronUp className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 overflow-hidden">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1 shrink-0">
                {i > 0 && <icons.ChevronRight className="w-3 h-3 text-os-text-muted" />}
                <button
                  className="text-sm text-os-text-secondary hover:text-os-text-primary transition-colors"
                  onClick={() => navigate(crumb.path)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            onClick={createFolder}
          >
            <icons.FolderPlus className="w-4 h-4" />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            onClick={refresh}
          >
            <icons.RefreshCw className="w-4 h-4" />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/20 transition-colors"
            onClick={deleteNode}
            disabled={!selected}
          >
            <icons.Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>

        {/* File Grid */}
        <div className="flex-1 overflow-auto p-3">
          <div className="grid grid-cols-4 gap-3">
            {items.map((node) => {
              const Icon = getIcon(node);
              const isSel = selected === node.id;
              return (
                <button
                  key={node.id}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                    isSel ? 'bg-os-accent/20 border border-os-accent/40' : 'hover:bg-white/5'
                  }`}
                  onClick={() => setSelected(node.id)}
                  onDoubleClick={() => onDoubleClick(node)}
                >
                  <Icon className={`w-10 h-10 ${node.type === 'directory' ? 'text-amber-400' : 'text-os-text-secondary'}`} />
                  <span className="text-xs text-os-text-primary truncate w-full text-center">{node.name}</span>
                </button>
              );
            })}
          </div>
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-os-text-muted">
              <icons.FolderOpen className="w-12 h-12 mb-2 opacity-40" />
              <p className="text-sm">This folder is empty</p>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="h-6 flex items-center px-3 border-t border-white/[0.08] text-[11px] text-os-text-muted">
          {items.length} items
        </div>
      </div>
    </div>
  );
}
