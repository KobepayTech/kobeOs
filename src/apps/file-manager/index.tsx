import { useState, useEffect, useCallback, useMemo } from 'react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fs } from '@/os/fs';
import { useOSStore } from '@/os/store';
import type { FSNode } from '@/os/types';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

type Mode = 'local' | 'cloud';

interface CloudNode {
  id: string;
  path: string;
  parentPath?: string | null;
  name: string;
  type: 'file' | 'directory';
  mimeType?: string | null;
  size: number;
}

function cloudToFs(n: CloudNode): FSNode {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    mimeType: n.mimeType ?? undefined,
    size: n.size,
    createdAt: 0,
    modifiedAt: 0,
  } as FSNode;
}

export default function FileManager() {
  const [mode, setMode] = useState<Mode>('local');
  const [path, setPath] = useState('/home/user');
  const [cloudPath, setCloudPath] = useState('/');
  const [items, setItems] = useState<FSNode[]>(() => fs.readdir('/home/user'));
  const [history, setHistory] = useState<string[]>(['/home/user']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const launchApp = useOSStore((s) => s.launchApp);

  const refreshLocal = useCallback((p: string) => {
    setItems(fs.readdir(p));
  }, []);

  const refreshCloud = useCallback(async (p: string) => {
    try {
      await ensureSession();
      const list = await api<CloudNode[]>(`/files?parent=${encodeURIComponent(p)}`);
      setItems(list.map(cloudToFs));
      setCloudError(null);
    } catch (err) {
      setItems([]);
      setCloudError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    if (mode === 'local') refreshLocal(path);
    else void refreshCloud(cloudPath);
  }, [mode, path, cloudPath, refreshLocal, refreshCloud]);

  const refresh = useCallback(() => {
    if (mode === 'local') refreshLocal(path);
    else void refreshCloud(cloudPath);
  }, [mode, path, cloudPath, refreshLocal, refreshCloud]);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setSelected(null);
    if (m === 'local') {
      setHistory(['/home/user']);
      setHistoryIdx(0);
      setPath('/home/user');
    } else {
      setCloudPath('/');
    }
  }, []);

  const navigate = useCallback(
    (newPath: string) => {
      setSelected(null);
      if (mode === 'cloud') {
        setCloudPath(newPath);
        return;
      }
      if (!fs.exists(newPath)) return;
      const nextHistory = history.slice(0, historyIdx + 1);
      nextHistory.push(newPath);
      setHistory(nextHistory);
      setHistoryIdx(nextHistory.length - 1);
      setPath(newPath);
    },
    [mode, history, historyIdx]
  );

  const goBack = useCallback(() => {
    if (mode === 'cloud') {
      const parts = cloudPath.split('/').filter(Boolean);
      parts.pop();
      setCloudPath(parts.length === 0 ? '/' : '/' + parts.join('/'));
      setSelected(null);
      return;
    }
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setPath(history[idx]);
      setSelected(null);
    }
  }, [mode, cloudPath, history, historyIdx]);

  const goUp = useCallback(() => {
    const current = mode === 'cloud' ? cloudPath : path;
    const parts = current.split('/').filter(Boolean);
    if (parts.length === 0) return;
    parts.pop();
    const parent = parts.length === 0 ? '/' : '/' + parts.join('/');
    if (mode === 'cloud') {
      setCloudPath(parent);
      setSelected(null);
    } else {
      navigate(parent);
    }
  }, [mode, path, cloudPath, navigate]);

  const onDoubleClick = useCallback(
    (node: FSNode) => {
      if (node.type === 'directory') {
        const base = mode === 'cloud' ? cloudPath : path;
        const child = base === '/' ? `/${node.name}` : `${base}/${node.name}`;
        navigate(child);
      } else if (mode === 'local') {
        const mime = node.mimeType ?? 'text/plain';
        if (mime.startsWith('text/') || mime === 'application/json') {
          launchApp('text-editor', { filePath: path + '/' + node.name });
        }
      }
    },
    [mode, path, cloudPath, navigate, launchApp]
  );

  const createFolder = useCallback(async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    if (mode === 'cloud') {
      const newPath = cloudPath === '/' ? `/${name}` : `${cloudPath}/${name}`;
      try {
        await api('/files', { method: 'POST', body: JSON.stringify({ path: newPath, type: 'directory' }) });
        await refreshCloud(cloudPath);
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : 'Create failed');
      }
    } else {
      fs.mkdir(path + '/' + name);
      refreshLocal(path);
    }
  }, [mode, path, cloudPath, refreshLocal, refreshCloud]);

  const deleteNode = useCallback(async () => {
    if (!selected) return;
    const node = items.find((i) => i.id === selected);
    if (!node) return;
    if (!confirm(`Delete ${node.name}?`)) return;
    if (mode === 'cloud') {
      const target = cloudPath === '/' ? `/${node.name}` : `${cloudPath}/${node.name}`;
      try {
        await api(`/files/node?path=${encodeURIComponent(target)}`, { method: 'DELETE' });
        setSelected(null);
        await refreshCloud(cloudPath);
      } catch (err) {
        setCloudError(err instanceof Error ? err.message : 'Delete failed');
      }
    } else {
      fs.delete(path + '/' + node.name);
      setSelected(null);
      refreshLocal(path);
    }
  }, [mode, selected, items, path, cloudPath, refreshLocal, refreshCloud]);

  const breadcrumbs = useMemo(() => {
    if (mode === 'cloud') {
      const parts = cloudPath.split('/').filter(Boolean);
      const crumbs = [{ label: 'Cloud', path: '/' }];
      let acc = '';
      for (const p of parts) { acc += '/' + p; crumbs.push({ label: p, path: acc }); }
      return crumbs;
    }
    const parts = path.split('/').filter(Boolean);
    const crumbs = [{ label: 'Home', path: '/home/user' }];
    let acc = '/home/user';
    for (const p of parts.slice(2)) { acc += '/' + p; crumbs.push({ label: p, path: acc }); }
    return crumbs;
  }, [mode, path, cloudPath]);

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
      <div className="w-48 border-r border-white/[0.08] flex flex-col bg-[#0f172a]">
        <div className="p-2 border-b border-white/[0.05]">
          <div className="flex rounded-md overflow-hidden border border-white/10">
            <button
              className={`flex-1 py-1 text-xs ${mode === 'local' ? 'bg-os-accent/20 text-os-accent' : 'hover:bg-white/5 text-os-text-secondary'}`}
              onClick={() => switchMode('local')}
            >
              Local
            </button>
            <button
              className={`flex-1 py-1 text-xs ${mode === 'cloud' ? 'bg-os-accent/20 text-os-accent' : 'hover:bg-white/5 text-os-text-secondary'}`}
              onClick={() => switchMode('cloud')}
            >
              Cloud
            </button>
          </div>
        </div>
        <div className="p-2">
          <div className="text-[10px] font-semibold text-os-text-muted uppercase tracking-wider px-2 mb-1">
            {mode === 'local' ? 'Quick Access' : 'Cloud Root'}
          </div>
          {mode === 'local' ? sidebarItems.map((si) => {
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
          }) : (
            <button
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                cloudPath === '/' ? 'bg-white/10 text-os-accent' : 'hover:bg-white/5 text-os-text-secondary'
              }`}
              onClick={() => setCloudPath('/')}
            >
              <icons.Cloud className="w-4 h-4" />
              <span className="text-sm">Cloud root</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-10 flex items-center gap-1 px-2 border-b border-white/[0.08]">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
            onClick={goBack}
            disabled={mode === 'local' && historyIdx === 0}
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
              <span key={`${crumb.path}-${i}`} className="flex items-center gap-1 shrink-0">
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
              <p className="text-sm">{mode === 'cloud' && cloudError ? cloudError : 'This folder is empty'}</p>
            </div>
          )}
        </div>

        <div className="h-6 flex items-center px-3 border-t border-white/[0.08] text-[11px] text-os-text-muted">
          {items.length} items {mode === 'cloud' && '· cloud'}
        </div>
      </div>
    </div>
  );
}
