import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  Star,
  X,
  Plus,
  Bookmark,
  Trash2,
} from 'lucide-react';

interface Tab {
  id: string;
  url: string;
  title: string;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
}

const BOOKMARKS_KEY = 'kobe_browser_bookmarks';

const HOME_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin:0; padding:0; font-family: system-ui, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); color: #e2e8f0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
    h1 { font-size: 3rem; margin-bottom: 0.5rem; }
    p { font-size: 1.1rem; color: #94a3b8; }
    .links { margin-top: 2rem; display:flex; gap: 1rem; flex-wrap:wrap; justify-content:center; }
    a { display:block; padding: 0.75rem 1.25rem; background: #334155; border-radius: 0.5rem; color: #e2e8f0; text-decoration:none; transition: background 0.2s; }
    a:hover { background: #475569; }
  </style>
</head>
<body>
  <h1>Welcome to KOBE OS</h1>
  <p>Your personal web workspace.</p>
  <div class="links">
    <a href="https://duckduckgo.com">DuckDuckGo</a>
    <a href="https://wikipedia.org">Wikipedia</a>
    <a href="https://github.com">GitHub</a>
    <a href="https://stackoverflow.com">Stack Overflow</a>
    <a href="https://news.ycombinator.com">Hacker News</a>
  </div>
</body>
</html>
`;

const HOME_BLOB = URL.createObjectURL(new Blob([HOME_HTML], { type: 'text/html' }));

function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const blocked = ['about:', 'javascript:', 'data:', 'file:', 'chrome:', 'blob:'];
  if (blocked.some((p) => trimmed.toLowerCase().startsWith(p)) && !trimmed.startsWith(HOME_BLOB)) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

export default function BrowserApp() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'tab_0', url: HOME_BLOB, title: 'Home' },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab_0');
  const [address, setAddress] = useState(HOME_BLOB);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tabCounter = useRef(1);

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    setAddress(activeTab?.url ?? HOME_BLOB);
  }, [activeTabId, tabs]);

  const navigate = (url: string) => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('Blocked or invalid URL');
      return;
    }
    setError(null);
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, url: normalized } : t)));
    setAddress(normalized);
  };

  const newTab = () => {
    const id = `tab_${tabCounter.current++}`;
    const tab: Tab = { id, url: HOME_BLOB, title: 'New Tab' };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  const addBookmark = () => {
    const url = activeTab?.url ?? '';
    if (!url || url === HOME_BLOB) return;
    const title = activeTab?.title || url;
    setBookmarks((prev) => {
      if (prev.some((b) => b.url === url)) return prev;
      return [...prev, { id: `bm_${Date.now()}`, title, url }];
    });
  };

  const removeBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const goBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch { /* cross-origin */ }
  };

  const goForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch { /* cross-origin */ }
  };

  const refresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const isBookmarked = bookmarks.some((b) => b.url === activeTab?.url);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
      {/* Address bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0">
        <button onClick={goBack} className="p-1 hover:bg-slate-700 rounded" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button onClick={goForward} className="p-1 hover:bg-slate-700 rounded" title="Forward">
          <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={refresh} className="p-1 hover:bg-slate-700 rounded" title="Refresh">
          <RotateCw className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1 flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1">
          <Globe className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(address)}
            className="flex-1 bg-transparent text-sm text-slate-100 focus:outline-none min-w-0"
            placeholder="Enter URL"
          />
          <button onClick={() => navigate(address)} className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white">
            Go
          </button>
        </div>
        <button
          onClick={addBookmark}
          className={`p-1 rounded ${isBookmarked ? 'text-yellow-400' : 'hover:bg-slate-700'}`}
          title="Bookmark"
        >
          <Star className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => setShowBookmarks((v) => !v)}
          className={`p-1 rounded ${showBookmarks ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
          title="Bookmarks"
        >
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-700 bg-slate-800 shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`flex items-center gap-1 px-3 py-1 rounded-t text-xs cursor-pointer select-none max-w-[140px] ${
              tab.id === activeTabId ? 'bg-slate-900 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <span className="truncate">{tab.title}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="p-0.5 hover:bg-slate-600 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button onClick={newTab} className="p-1 hover:bg-slate-700 rounded ml-1" title="New Tab">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Bookmarks sidebar */}
        {showBookmarks && (
          <div className="w-48 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
            <div className="px-3 py-2 border-b border-slate-700 text-sm font-semibold flex items-center gap-2">
              <Bookmark className="w-4 h-4" /> Bookmarks
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {bookmarks.length === 0 && (
                <p className="text-xs text-slate-500 px-1">No bookmarks yet.</p>
              )}
              {bookmarks.map((bm) => (
                <div key={bm.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => navigate(bm.url)}
                    className="flex-1 text-left text-xs px-2 py-1 rounded hover:bg-slate-700 truncate"
                    title={bm.url}
                  >
                    {bm.title}
                  </button>
                  <button
                    onClick={() => removeBookmark(bm.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-900 rounded"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Iframe */}
        <div className="flex-1 relative">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Globe className="w-12 h-12 mb-3" />
              <p className="text-lg font-semibold">{error}</p>
              <button
                onClick={() => { setError(null); navigate(HOME_BLOB); }}
                className="mt-3 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm"
              >
                Go Home
              </button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={activeTab?.url ?? HOME_BLOB}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="Browser"
            />
          )}
        </div>
      </div>
    </div>
  );
}
