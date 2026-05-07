import { useState, useEffect, useCallback } from 'react';
import * as icons from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

function loadNotes(): Note[] {
  const raw = localStorage.getItem('kobe_notepad');
  if (!raw) return [{ id: 'n1', title: 'Welcome', content: 'Welcome to Notepad!\n\nThis is a simple note-taking app.', updatedAt: Date.now() }];
  return JSON.parse(raw);
}

function saveNotes(notes: Note[]) {
  localStorage.setItem('kobe_notepad', JSON.stringify(notes));
}

export default function Notepad() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeId, setActiveId] = useState<string>(notes[0]?.id ?? '');
  const [query, setQuery] = useState('');

  const active = notes.find((n) => n.id === activeId) ?? notes[0];

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const updateNote = useCallback(
    (content: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeId ? { ...n, content, title: content.split('\n')[0].slice(0, 40) || 'Untitled', updatedAt: Date.now() } : n
        )
      );
    },
    [activeId]
  );

  const createNote = useCallback(() => {
    const id = `note_${Date.now()}`;
    const newNote: Note = { id, title: 'New Note', content: '', updatedAt: Date.now() };
    setNotes((prev) => [newNote, ...prev]);
    setActiveId(id);
  }, []);

  const deleteNote = useCallback(
    (id: string) => {
      if (!confirm('Delete this note?')) return;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) {
        const remaining = notes.filter((n) => n.id !== id);
        setActiveId(remaining[0]?.id ?? '');
      }
    },
    [activeId, notes]
  );

  const filtered = query ? notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase())) : notes;

  return (
    <div className="flex h-full bg-[#0f172a] text-sm text-os-text-primary">
      {/* Sidebar */}
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
          {filtered.map((n) => (
            <button
              key={n.id}
              className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between group ${
                n.id === activeId ? 'bg-os-accent/15 border-l-2 border-os-accent' : 'hover:bg-white/5'
              }`}
              onClick={() => setActiveId(n.id)}
            >
              <div className="truncate flex-1">
                <div className="text-sm truncate">{n.title}</div>
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
      </div>

      {/* Editor */}
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
        </div>
        <div
          className="flex-1 p-4 outline-none overflow-auto"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => updateNote(e.currentTarget.innerText)}
          dangerouslySetInnerHTML={{ __html: active?.content.replace(/\n/g, '<br>') ?? '' }}
        />
      </div>
    </div>
  );
}
