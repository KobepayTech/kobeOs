import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  Search,
  Trash2,
  Edit3,
  Calendar,
  Flag,
  GripVertical,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

type Priority = 'low' | 'medium' | 'high';

interface ApiBoard { id: string; name: string }
interface ApiColumn { id: string; boardId: string; title: string; position: number; color: string }
interface ApiCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
  position: number;
  labels: string[];
  priority: Priority;
  colorTag?: string | null;
  dueAt?: string | null;
}

interface UICard {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  colorTag: string;
}

interface UIColumn {
  id: string;
  name: string;
  cards: UICard[];
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-slate-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

const TAG_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#eab308', '#f97316', '#06b6d4',
];

const DEFAULT_COLUMNS: Array<{ title: string }> = [
  { title: 'To Do' },
  { title: 'In Progress' },
  { title: 'Done' },
];

function fromApiCard(c: ApiCard): UICard {
  return {
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    priority: c.priority ?? 'medium',
    dueDate: c.dueAt ? c.dueAt.slice(0, 10) : '',
    colorTag: c.colorTag ?? TAG_COLORS[0],
  };
}

export default function KanbanApp() {
  const [board, setBoard] = useState<ApiBoard | null>(null);
  const [columns, setColumns] = useState<UIColumn[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<UICard | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [draggingCard, setDraggingCard] = useState<{ cardId: string; fromColId: string } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; title: string } | null>(null);
  const [newColName, setNewColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dragRef = useRef<{ cardId: string; fromColId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        if (cancelled) return;
        const boards = await api<ApiBoard[]>('/kanban/boards');
        let b = boards[0];
        if (!b) {
          b = await api<ApiBoard>('/kanban/boards', {
            method: 'POST', body: JSON.stringify({ name: 'My Board' }),
          });
        }
        if (cancelled) return;
        setBoard(b);

        let cols = await api<ApiColumn[]>(`/kanban/columns?boardId=${b.id}`);
        if (cols.length === 0) {
          for (const [idx, c] of DEFAULT_COLUMNS.entries()) {
            await api('/kanban/columns', {
              method: 'POST',
              body: JSON.stringify({ boardId: b.id, title: c.title, position: idx }),
            });
          }
          cols = await api<ApiColumn[]>(`/kanban/columns?boardId=${b.id}`);
        }
        const cards = await Promise.all(
          cols.map((c) => api<ApiCard[]>(`/kanban/cards?columnId=${c.id}`)),
        );
        const ui: UIColumn[] = cols.map((c, i) => ({
          id: c.id,
          name: c.title,
          cards: cards[i].map(fromApiCard),
        }));
        if (cancelled) return;
        setColumns(ui);
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to connect');
          setStatus('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openAddCard = (colId: string) => {
    setEditingCard(null);
    setEditingColumnId(colId);
    setModalOpen(true);
  };

  const openEditCard = (colId: string, card: UICard) => {
    setEditingCard({ ...card });
    setEditingColumnId(colId);
    setModalOpen(true);
  };

  const saveCard = useCallback(async (card: UICard) => {
    if (!editingColumnId) return;
    const payload = {
      title: card.title,
      description: card.description,
      priority: card.priority,
      colorTag: card.colorTag,
      dueAt: card.dueDate ? new Date(card.dueDate + 'T00:00:00').toISOString() : undefined,
    };
    try {
      if (editingCard) {
        const updated = await api<ApiCard>(`/kanban/cards/${card.id}`, {
          method: 'PATCH', body: JSON.stringify(payload),
        });
        setColumns((prev) => prev.map((col) =>
          col.id === editingColumnId
            ? { ...col, cards: col.cards.map((c) => (c.id === card.id ? fromApiCard(updated) : c)) }
            : col,
        ));
      } else {
        const created = await api<ApiCard>('/kanban/cards', {
          method: 'POST',
          body: JSON.stringify({ columnId: editingColumnId, ...payload }),
        });
        setColumns((prev) => prev.map((col) =>
          col.id === editingColumnId ? { ...col, cards: [...col.cards, fromApiCard(created)] } : col,
        ));
      }
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    }
  }, [editingCard, editingColumnId]);

  const deleteCard = useCallback(async (colId: string, cardId: string) => {
    try {
      await api(`/kanban/cards/${cardId}`, { method: 'DELETE' });
      setColumns((prev) => prev.map((col) =>
        col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col,
      ));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  }, []);

  const deleteColumn = useCallback(async (colId: string) => {
    try {
      await api(`/kanban/columns/${colId}`, { method: 'DELETE' });
      setColumns((prev) => prev.filter((c) => c.id !== colId));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  }, []);

  const addColumn = useCallback(async () => {
    if (!newColName.trim() || !board) return;
    try {
      const created = await api<ApiColumn>('/kanban/columns', {
        method: 'POST',
        body: JSON.stringify({ boardId: board.id, title: newColName.trim(), position: columns.length }),
      });
      setColumns((prev) => [...prev, { id: created.id, name: created.title, cards: [] }]);
      setNewColName('');
      setAddingCol(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Add failed');
    }
  }, [newColName, board, columns.length]);

  const filteredColumns = columns.map((col) => ({
    ...col,
    cards: col.cards.filter(
      (c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()),
    ),
  }));

  const handleMouseDown = (e: React.MouseEvent, cardId: string, fromColId: string) => {
    e.preventDefault();
    const card = columns.find((c) => c.id === fromColId)?.cards.find((c) => c.id === cardId);
    if (!card) return;
    dragRef.current = { cardId, fromColId };
    setDraggingCard({ cardId, fromColId });
    setDragGhost({ x: e.clientX, y: e.clientY, title: card.title });
  };

  const moveCard = useCallback(async (cardId: string, fromColId: string, toColId: string) => {
    setColumns((prev) => {
      const card = prev.find((c) => c.id === fromColId)?.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      return prev.map((col) => {
        if (col.id === fromColId) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        if (col.id === toColId) return { ...col, cards: [...col.cards, card] };
        return col;
      });
    });
    try {
      await api(`/kanban/cards/${cardId}`, {
        method: 'PATCH', body: JSON.stringify({ columnId: toColId }),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Move failed');
    }
  }, []);

  useEffect(() => {
    if (!draggingCard) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setDragGhost((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { cardId, fromColId } = dragRef.current;
      dragRef.current = null;
      setDraggingCard(null);
      setDragGhost(null);

      const cols = document.querySelectorAll('[data-col-id]');
      let bestCol: string | null = null;
      let bestDist = Infinity;
      cols.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          const dist = Math.abs(e.clientX - (rect.left + rect.width / 2));
          if (dist < bestDist) {
            bestDist = dist;
            bestCol = el.getAttribute('data-col-id');
          }
        }
      });

      if (bestCol && bestCol !== fromColId) {
        moveCard(cardId, fromColId, bestCol);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingCard, moveCard]);

  if (status !== 'ready') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
        {status === 'connecting' ? 'Connecting…' : (errorMsg ?? 'Failed to connect')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800 shrink-0">
        <div className="flex items-center gap-2 bg-slate-900 rounded px-3 py-1.5 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards..."
            className="bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none w-full"
          />
        </div>
        {!addingCol ? (
          <button
            onClick={() => setAddingCol(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            <Plus className="w-4 h-4" /> Add Column
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addColumn()}
              placeholder="Column name"
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button onClick={addColumn} className="px-2 py-1 rounded bg-blue-600 text-white text-sm">Add</button>
            <button onClick={() => setAddingCol(false)} className="p-1 hover:bg-slate-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 min-w-max">
          {filteredColumns.map((col) => (
            <div
              key={col.id}
              data-col-id={col.id}
              className="w-72 shrink-0 bg-slate-800 rounded-lg border border-slate-700 flex flex-col max-h-full"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{col.name}</h3>
                  <span className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded-full">
                    {col.cards.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openAddCard(col.id)} className="p-1 hover:bg-slate-700 rounded" title="Add card">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteColumn(col.id)} className="p-1 hover:bg-slate-700 rounded" title="Delete column">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
                {col.cards.map((card) => (
                  <div
                    key={card.id}
                    className={`bg-slate-900 rounded border border-slate-700 p-3 cursor-move relative group ${
                      draggingCard?.cardId === card.id ? 'opacity-40' : ''
                    }`}
                    onMouseDown={(e) => handleMouseDown(e, card.id, col.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-slate-500" />
                        <span className="font-medium text-sm">{card.title}</span>
                      </div>
                      <button
                        onClick={() => openEditCard(col.id, card)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                    {card.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{card.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[card.priority]}`} title={card.priority} />
                      {card.dueDate && (
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Calendar className="w-3 h-3" /> {card.dueDate}
                        </span>
                      )}
                      {card.colorTag && (
                        <span className="w-4 h-1 rounded" style={{ backgroundColor: card.colorTag }} />
                      )}
                      <button
                        onClick={() => deleteCard(col.id, card.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-900 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-96 max-w-full p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{editingCard ? 'Edit Card' : 'New Card'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-slate-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <CardForm card={editingCard} onSave={saveCard} onCancel={() => setModalOpen(false)} />
          </div>
        </div>
      )}

      {dragGhost && (
        <div
          className="fixed pointer-events-none bg-slate-700 text-white text-xs px-3 py-2 rounded shadow-lg z-50 border border-blue-500"
          style={{ left: dragGhost.x + 10, top: dragGhost.y + 10 }}
        >
          {dragGhost.title}
        </div>
      )}

      {errorMsg && (
        <div className="absolute bottom-3 right-3 bg-red-900/80 text-red-100 text-xs px-3 py-1.5 rounded shadow-lg">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function CardForm({
  card,
  onSave,
  onCancel,
}: {
  card: UICard | null;
  onSave: (c: UICard) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(card?.title ?? '');
  const [description, setDescription] = useState(card?.description ?? '');
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(card?.dueDate ?? '');
  const [colorTag, setColorTag] = useState(card?.colorTag ?? TAG_COLORS[0]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: card?.id ?? '',
      title: title.trim(),
      description,
      priority,
      dueDate,
      colorTag,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={3}
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
      />
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-slate-400" />
        {(['low', 'medium', 'high'] as Priority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`px-2 py-1 rounded text-xs capitalize ${
              priority === p ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Tag:</span>
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColorTag(c)}
            className={`w-5 h-5 rounded-full border-2 ${colorTag === c ? 'border-white' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm">
          Cancel
        </button>
        <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm">
          Save
        </button>
      </div>
    </form>
  );
}
