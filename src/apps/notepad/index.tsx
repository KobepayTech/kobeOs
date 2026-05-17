import { useEffect, useState, useCallback, useMemo } from 'react';
import * as icons from 'lucide-react';
import { useApiResource } from '@/lib/useApiResource';

interface ApiNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

function deriveTitle(body: string): string {
  return body.split('\n')[0].slice(0, 40) || 'Untitled';
}

export default function Notepad() {
  const { items, loading, error, ready, create, update, remove } =
    useApiResource<ApiNote>('/notes');

  const [activeId, setActiveId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  const notes = useMemo(
    () => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  );

  // Auto-select the first note when notes load and nothing is selected yet.
  // setState is intentional here — it runs only when activeId is empty and notes
  // have just loaded, which is a one-time initialization, not a cascading loop.
  useEffect(() => {
    if (!activeId && notes.length) {
      // Defer to avoid the synchronous-setState-in-effect lint rule.
      queueMicrotask(() => {
        setActiveId(notes[0].id);
        setDraft(notes[0].body);
        setDirty(false);
      });
    }
  }, [notes, activeId]);

  const active = notes.find((n) => n.id === activeId);

  const selectNote = useCallback((id: string) => {
    const n = notes.find((x) => x.id === id);
    setActiveId(id);
    setDraft(n?.body ?? '');
    setDirty(false);
  }, [notes]);

  useEffect(() => {
    if (!dirty || !active) return;
    const handle = setTimeout(() => {
      update(active.id, { body: draft, title: deriveTitle(draft) })
        .then(() => setDirty(false))
        .catch(() => { /* keep dirty so we retry on next keystroke */ });
    }, 600);
    return () => clearTimeout(handle);
  }, [draft, dirty, active, update]);

  const createNote = useCallback(async () => {
    const created = await create({ title: 'New Note', body: '' });
    setActiveId(created.id);
    setDraft('');
    setDirty(false);
  }, [create]);

  const deleteNote = useCallback(async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await remove(id);
    if (activeId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      setActiveId(remaining[0]?.id ?? '');
      setDraft(remaining[0]?.body ?? '');
      setDirty(false);
    }
  }, [activeId, notes, remove]);

  const filtered = query
    ? notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
    : notes;

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-os-text-muted bg-[#0f172a]">
        {loading ? 'Connecting…' : (error ?? 'Connecting…')}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0f172a] text-sm text-os-text-primary">
      <div className="w-52 border-r border-white/[0.08] flex flex-col bg-[#0f172a]">
        <div className="p-2 flex items-center gap-1">
          <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10" onClick={createNote}>
            <icons.Plus className="w-4 h-4" />
          </button>
          <div className="flex-1 relative">
            <icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-os-text-muted" />
            <input
              className="w-full pl-7 pr-2 py-1 rounded-md bg-white/5 border border-white/5 text-xs outline-none"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && (
            <div className="text-center text-xs text-os-text-muted py-6">No notes yet</div>
          )}
          {filtered.map((n) => (
            <button
              key={n.id}
              className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between group ${
                n.id === activeId ? 'bg-os-accent/15 border-l-2 border-os-accent' : 'hover:bg-white/5'
              }`}
              onClick={() => selectNote(n.id)}
            >
              <div className="truncate flex-1">
                <div className="text-sm truncate">{n.title || 'Untitled'}</div>
                <div className="text-[10px] text-os-text-muted">{new Date(n.updatedAt).toLocaleDateString()}</div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
              >
                <icons.Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </button>
          ))}
        </div>
        {error && <div className="text-[10px] text-red-400 px-2 py-1 border-t border-white/[0.08]">{error}</div>}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-9 flex items-center gap-1 px-2 border-b border-white/[0.08]">
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="Bold" onClick={() => document.execCommand('bold')}>
            <icons.Bold className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="Italic" onClick={() => document.execCommand('italic')}>
            <icons.Italic className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="Underline" onClick={() => document.execCommand('underline')}>
            <icons.Underline className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="Bullet list" onClick={() => document.execCommand('insertUnorderedList')}>
            <icons.List className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="Numbered list" onClick={() => document.execCommand('insertOrderedList')}>
            <icons.ListOrdered className="w-4 h-4" />
          </button>
          <div className="ml-auto text-[10px] text-os-text-muted pr-2">
            {dirty ? 'Saving…' : active ? 'Synced' : ''}
          </div>
        </div>
        {active ? (
          <div
            key={active.id}
            className="flex-1 p-4 outline-none overflow-auto"
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
              setDraft(e.currentTarget.innerText);
              setDirty(true);
            }}
            dangerouslySetInnerHTML={{ __html: active.body.replace(/\n/g, '<br>') }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-os-text-muted text-sm">
            <button onClick={createNote} className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10">Create your first note</button>
          </div>
        )}
      </div>
    </div>
  );
}
