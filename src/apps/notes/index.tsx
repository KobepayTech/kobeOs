import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Trash2, Pin, PinOff, Tag, X, Save, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;

// ── Constants ────────────────────────────────────────────────────────────────

const NOTE_COLORS = [
  '#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca',
  '#e9d5ff', '#fed7aa', '#a7f3d0', '#f9a8d4',
];

const EMPTY_NOTE: NoteInput = {
  title: '',
  body: '',
  tags: [],
  pinned: false,
  color: NOTE_COLORS[0],
};

const AUTOSAVE_DELAY_MS = 800;

// ── Helpers ──────────────────────────────────────────────────────────────────

function noteMatches(note: Note, query: string): boolean {
  const q = query.toLowerCase();
  return (
    note.title.toLowerCase().includes(q) ||
    note.body.toLowerCase().includes(q) ||
    note.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// ── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({
  note, active, onClick, onDelete, onTogglePin,
}: {
  note: Note;
  active: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl p-3 cursor-pointer border transition-all ${
        active ? 'border-white/20 ring-1 ring-white/20' : 'border-transparent hover:border-white/10'
      }`}
      style={{ backgroundColor: note.color + '22' }}
    >
      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: note.color }} />
      <div className="pl-3">
        <p className="text-sm font-medium text-white/90 truncate leading-snug">
          {note.title || <span className="italic text-white/30">Untitled</span>}
        </p>
        {note.body && (
          <p className="text-xs text-white/40 mt-0.5 line-clamp-2 leading-relaxed">{note.body}</p>
        )}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {note.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onTogglePin} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80" title={note.pinned ? 'Unpin' : 'Pin'}>
          {note.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400" title="Delete">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {note.pinned && <Pin className="absolute top-2 right-2 w-3 h-3 text-amber-400 group-hover:hidden" />}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteInput>(EMPTY_NOTE);
  const [query, setQuery] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNew = activeId === null;

  useEffect(() => {
    let cancelled = false;
    api<Note[]>('/notes')
      .then((data) => { if (!cancelled) setNotes(data); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      // Clear any pending autosave so it doesn't fire after unmount.
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, []);

  const filtered = notes
    .filter((n) => !query || noteMatches(n, query))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  const saveNote = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await api<Note>('/notes', { method: 'POST', body: JSON.stringify(draft) });
        setNotes((prev) => [created, ...prev]);
        setActiveId(created.id);
      } else {
        const updated = await api<Note>(`/notes/${activeId}`, { method: 'PATCH', body: JSON.stringify(draft) });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [isNew, activeId, draft]);

  const scheduleSave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void saveNote(); }, AUTOSAVE_DELAY_MS);
  }, [saveNote]);

  const updateDraft = useCallback(<K extends keyof NoteInput>(key: K, value: NoteInput[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    scheduleSave();
  }, [scheduleSave]);

  const handleSelect = useCallback((note: Note) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setActiveId(note.id);
    setDraft({ title: note.title, body: note.body, tags: note.tags, pinned: note.pinned, color: note.color });
    setTagInput('');
  }, []);

  const handleNew = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setActiveId(null);
    setDraft(EMPTY_NOTE);
    setTagInput('');
  }, []);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api(`/notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) { setActiveId(null); setDraft(EMPTY_NOTE); }
    } catch (e) { setError((e as Error).message); }
  }, [activeId]);

  const handleTogglePin = useCallback(async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    try {
      const updated = await api<Note>(`/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !note.pinned }) });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (activeId === note.id) setDraft((d) => ({ ...d, pinned: updated.pinned }));
    } catch (e) { setError((e as Error).message); }
  }, [activeId]);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || draft.tags.includes(tag)) { setTagInput(''); return; }
    updateDraft('tags', [...draft.tags, tag]);
    setTagInput('');
  }, [tagInput, draft.tags, updateDraft]);

  const removeTag = useCallback((tag: string) => {
    updateDraft('tags', draft.tags.filter((t) => t !== tag));
  }, [draft.tags, updateDraft]);

  return (
    <div className="flex h-full bg-[#0f0f1a] text-white overflow-hidden">

      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white/80">Notes</span>
          <button onClick={handleNew} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="New note">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/30 outline-none"
            />
            {query && <button onClick={() => setQuery('')} className="text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-white/30"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-white/25 py-8">{query ? 'No matches' : 'No notes yet'}</p>
          ) : (
            filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                active={note.id === activeId}
                onClick={() => handleSelect(note)}
                onDelete={(e) => handleDelete(e, note.id)}
                onTogglePin={(e) => handleTogglePin(e, note)}
              />
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateDraft('color', c)}
                  className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${draft.color === c ? 'border-white/60 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              onClick={() => updateDraft('pinned', !draft.pinned)}
              className={`p-1.5 rounded-lg transition-colors ${draft.pinned ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-white/10 text-white/40 hover:text-white/70'}`}
              title={draft.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            {saving ? (
              <span className="flex items-center gap-1 text-xs text-white/30"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
            ) : (
              <button
                onClick={() => void saveNote()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-xs text-white/60 hover:text-white/90 transition-colors"
              >
                <Save className="w-3 h-3" />
                {isNew ? 'Create' : 'Save'}
              </button>
            )}
          </div>
        </div>

        <input
          value={draft.title}
          onChange={(e) => updateDraft('title', e.target.value)}
          placeholder="Title"
          className="w-full px-6 pt-5 pb-2 bg-transparent text-xl font-semibold text-white/90 placeholder:text-white/20 outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5 px-6 pb-3">
          {draft.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              <Tag className="w-2.5 h-2.5" />
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-400 ml-0.5"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
            onBlur={addTag}
            placeholder="Add tag…"
            className="text-xs bg-transparent text-white/40 placeholder:text-white/20 outline-none w-20"
          />
        </div>

        <textarea
          value={draft.body}
          onChange={(e) => updateDraft('body', e.target.value)}
          placeholder="Start writing…"
          className="flex-1 px-6 py-2 bg-transparent text-sm text-white/75 placeholder:text-white/20 outline-none resize-none leading-relaxed"
        />

        {activeNote?.updatedAt && (
          <div className="px-6 py-2 text-[11px] text-white/20 border-t border-white/[0.04]">
            Last edited {new Date(activeNote.updatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
