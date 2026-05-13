import { useState, useRef, useEffect } from 'react';
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

type Priority = 'low' | 'medium' | 'high';

interface Card {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  colorTag: string;
}

interface Column {
  id: string;
  name: string;
  cards: Card[];
  limit?: number;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-slate-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

const TAG_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#eab308', '#f97316', '#06b6d4',
];

const STORAGE_KEY = 'kobe_kanban_board';

function loadBoard(): Column[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [
    { id: 'todo', name: 'To Do', cards: [] },
    { id: 'inprogress', name: 'In Progress', cards: [] },
    { id: 'done', name: 'Done', cards: [] },
  ];
}

function saveBoard(columns: Column[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

function makeId() {
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function KanbanApp() {
  const [columns, setColumns] = useState<Column[]>(loadBoard);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [draggingCard, setDraggingCard] = useState<{ cardId: string; fromColId: string } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; title: string } | null>(null);
  const [newColName, setNewColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);

  const dragRef = useRef<{ cardId: string; fromColId: string; startX: number; startY: number } | null>(null);

  useEffect(() => {
    saveBoard(columns);
  }, [columns]);

  const openAddCard = (colId: string) => {
    setEditingCard(null);
    setEditingColumnId(colId);
    setModalOpen(true);
  };

  const openEditCard = (colId: string, card: Card) => {
    setEditingCard({ ...card });
    setEditingColumnId(colId);
    setModalOpen(true);
  };

  const saveCard = (card: Card) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id !== editingColumnId) return col;
        const exists = col.cards.find((c) => c.id === card.id);
        if (exists) {
          return { ...col, cards: col.cards.map((c) => (c.id === card.id ? card : c)) };
        }
        return { ...col, cards: [...col.cards, card] };
      })
    );
    setModalOpen(false);
  };

  const deleteCard = (colId: string, cardId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col
      )
    );
  };

  const deleteColumn = (colId: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== colId));
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    setColumns((prev) => [...prev, { id: makeId(), name: newColName.trim(), cards: [] }]);
    setNewColName('');
    setAddingCol(false);
  };

  const filteredColumns = columns.map((col) => ({
    ...col,
    cards: col.cards.filter(
      (c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
    ),
  }));

  const handleMouseDown = (e: React.MouseEvent, cardId: string, fromColId: string) => {
    e.preventDefault();
    const card = columns.find((c) => c.id === fromColId)?.cards.find((c) => c.id === cardId);
    if (!card) return;
    dragRef.current = { cardId, fromColId, startX: e.clientX, startY: e.clientY };
    setDraggingCard({ cardId, fromColId });
    setDragGhost({ x: e.clientX, y: e.clientY, title: card.title });
  };

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

    // Find drop target column
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
      setColumns((prev) => {
        const card = prev.find((c) => c.id === fromColId)?.cards.find((c) => c.id === cardId);
        if (!card) return prev;
        return prev.map((col) => {
          if (col.id === fromColId) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
          if (col.id === bestCol) return { ...col, cards: [...col.cards, card] };
          return col;
        });
      });
    }
  };

  useEffect(() => {
    if (!draggingCard) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingCard]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-200">
      {/* Header */}
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

      {/* Board */}
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
                    {col.cards.length}{col.limit ? `/${col.limit}` : ''}
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

      {/* Modal */}
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

      {/* Drag ghost */}
      {dragGhost && (
        <div
          className="fixed pointer-events-none bg-slate-700 text-white text-xs px-3 py-2 rounded shadow-lg z-50 border border-blue-500"
          style={{ left: dragGhost.x + 10, top: dragGhost.y + 10 }}
        >
          {dragGhost.title}
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
  card: Card | null;
  onSave: (c: Card) => void;
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
      id: card?.id ?? makeId(),
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
