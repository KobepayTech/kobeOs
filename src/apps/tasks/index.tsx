import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ListChecks, Plus, Trash2, Check, X, Edit2, Circle, CheckCircle2,
  Flag, Calendar as CalendarIcon, ChevronRight,
} from 'lucide-react';
import { useApiResource } from '@/lib/useApiResource';
import { api } from '@/lib/api';

type Priority = 'low' | 'normal' | 'high';

interface TodoList {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface TodoItem {
  id: string;
  listId: string;
  text: string;
  done: boolean;
  priority: Priority;
  dueAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const LIST_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-slate-500', bg: 'bg-slate-100' },
  normal: { label: 'Normal', color: 'text-blue-600', bg: 'bg-blue-50' },
  high: { label: 'High', color: 'text-red-600', bg: 'bg-red-50' },
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

function formatDue(dueAt?: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TasksApp() {
  const {
    items: lists, ready, error: listsError, create: createList,
    update: updateList, remove: removeList,
  } = useApiResource<TodoList>('/todo/lists');

  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // List sidebar editing state.
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // List-scoped items are managed locally so we can use the ?listId= filter.
  const [items, setItems] = useState<TodoItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // New-item composer.
  const [newItemText, setNewItemText] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<Priority>('normal');
  const [newItemDue, setNewItemDue] = useState('');

  // Item title editing.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemValue, setEditItemValue] = useState('');

  // Track the latest in-flight load so stale responses don't overwrite state.
  const loadTokenRef = useRef(0);

  // Default selection to the first list once lists are ready.
  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
    if (selectedListId && !lists.some((l) => l.id === selectedListId)) {
      setSelectedListId(lists[0]?.id ?? null);
    }
  }, [lists, selectedListId]);

  const loadItems = useCallback(async (listId: string) => {
    const token = ++loadTokenRef.current;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const result = await api<TodoItem[]>(`/todo/items?listId=${encodeURIComponent(listId)}`);
      if (loadTokenRef.current === token) setItems(result);
    } catch (err) {
      if (loadTokenRef.current === token) {
        setItemsError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (loadTokenRef.current === token) setItemsLoading(false);
    }
  }, []);

  // Reload items whenever the selected list changes (after session is ready).
  useEffect(() => {
    if (ready && selectedListId) {
      void loadItems(selectedListId);
    } else if (!selectedListId) {
      setItems([]);
    }
  }, [ready, selectedListId, loadItems]);

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Completed items sink to the bottom.
      if (a.done !== b.done) return a.done ? 1 : -1;
      // Then by priority (high first).
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      // Then by due date (soonest first; undated last).
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [items]);

  const remaining = items.filter((i) => !i.done).length;

  // ---- List actions -------------------------------------------------------
  const submitNewList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const color = LIST_COLORS[lists.length % LIST_COLORS.length];
      const created = await createList({ name, color });
      setSelectedListId(created.id);
      setNewListName('');
      setAddingList(false);
    } catch { /* surfaced via listsError */ }
  };

  const startRename = (list: TodoList) => {
    setRenamingListId(list.id);
    setRenameValue(list.name);
  };

  const submitRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) { setRenamingListId(null); return; }
    try {
      await updateList(id, { name });
    } catch { /* surfaced via listsError */ }
    setRenamingListId(null);
  };

  const deleteList = async (id: string) => {
    try {
      await removeList(id);
    } catch { /* surfaced via listsError */ }
  };

  // ---- Item actions -------------------------------------------------------
  const addItem = async () => {
    const text = newItemText.trim();
    if (!text || !selectedListId) return;
    const body: { listId: string; text: string; priority: Priority; dueAt?: string } = {
      listId: selectedListId,
      text,
      priority: newItemPriority,
    };
    if (newItemDue) body.dueAt = new Date(newItemDue).toISOString();
    try {
      const created = await api<TodoItem>('/todo/items', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setItems((prev) => [...prev, created]);
      setNewItemText('');
      setNewItemPriority('normal');
      setNewItemDue('');
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : String(err));
    }
  };

  const patchItem = async (id: string, patch: Partial<Pick<TodoItem, 'text' | 'done' | 'priority' | 'dueAt'>>) => {
    try {
      const updated = await api<TodoItem>(`/todo/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleDone = (item: TodoItem) => patchItem(item.id, { done: !item.done });

  const cyclePriority = (item: TodoItem) => {
    const next: Priority = item.priority === 'low' ? 'normal' : item.priority === 'normal' ? 'high' : 'low';
    return patchItem(item.id, { priority: next });
  };

  const startEditItem = (item: TodoItem) => {
    setEditingItemId(item.id);
    setEditItemValue(item.text);
  };

  const submitEditItem = async (id: string) => {
    const text = editItemValue.trim();
    if (text) await patchItem(id, { text });
    setEditingItemId(null);
  };

  const deleteItem = async (id: string) => {
    try {
      await api(`/todo/items/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-slate-500 text-sm">
        {listsError ?? 'Connecting…'}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white text-slate-900 overflow-hidden">
      {/* Sidebar: lists */}
      <div className="w-60 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-sm">Tasks</span>
          </div>
          <button
            onClick={() => { setAddingList(true); setNewListName(''); }}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            title="New list"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {addingList && (
            <div className="flex items-center gap-1 px-2 py-1.5">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitNewList();
                  if (e.key === 'Escape') { setAddingList(false); setNewListName(''); }
                }}
                placeholder="List name"
                className="flex-1 min-w-0 bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
              />
              <button onClick={() => void submitNewList()} className="p-1 text-green-600 hover:bg-green-50 rounded">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setAddingList(false); setNewListName(''); }} className="p-1 text-red-600 hover:bg-red-50 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {lists.length === 0 && !addingList && (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <ListChecks className="w-8 h-8 mb-2" />
              <p className="text-xs">No lists yet</p>
            </div>
          )}

          {lists.map((list) => (
            <div
              key={list.id}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-4 transition-colors ${
                selectedListId === list.id
                  ? 'bg-blue-50 border-l-blue-600'
                  : 'border-l-transparent hover:bg-slate-100'
              }`}
              onClick={() => setSelectedListId(list.id)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
              {renamingListId === list.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitRename(list.id);
                    if (e.key === 'Escape') setRenamingListId(null);
                  }}
                  onBlur={() => void submitRename(list.id)}
                  className="flex-1 min-w-0 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{list.name}</span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(list); }}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded"
                  title="Rename"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void deleteList(list.id); }}
                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                  title="Delete list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {listsError && (
          <div className="text-[10px] text-red-500 px-2 py-1 border-t border-slate-200">{listsError}</div>
        )}
      </div>

      {/* Right pane: items of selected list */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {!selectedList ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <ListChecks className="w-12 h-12 mb-3" />
            <p className="text-sm">Create or select a list to get started</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedList.color }} />
              <h2 className="text-lg font-bold text-slate-900 truncate">{selectedList.name}</h2>
              <span className="text-xs text-slate-400">{remaining} remaining</span>
            </div>

            {/* New item composer */}
            <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addItem(); }}
                placeholder="Add a task…"
                className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-slate-400"
              />
              <select
                value={newItemPriority}
                onChange={(e) => setNewItemPriority(e.target.value as Priority)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                title="Priority"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={newItemDue}
                onChange={(e) => setNewItemDue(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                title="Due date"
              />
              <button
                onClick={() => void addItem()}
                disabled={!newItemText.trim()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {itemsLoading && items.length === 0 && (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Loading…</div>
              )}

              {!itemsLoading && sortedItems.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mb-2" />
                  <p className="text-sm">No tasks yet</p>
                </div>
              )}

              {sortedItems.map((item) => {
                const due = formatDue(item.dueAt);
                const overdue = !item.done && item.dueAt
                  ? new Date(item.dueAt).getTime() < Date.now()
                  : false;
                return (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 px-6 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <button
                      onClick={() => void toggleDone(item)}
                      className="shrink-0"
                      title={item.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {item.done ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500 transition-colors" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      {editingItemId === item.id ? (
                        <input
                          autoFocus
                          value={editItemValue}
                          onChange={(e) => setEditItemValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void submitEditItem(item.id);
                            if (e.key === 'Escape') setEditingItemId(null);
                          }}
                          onBlur={() => void submitEditItem(item.id)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <div
                          className={`text-sm truncate ${item.done ? 'line-through text-slate-400' : 'text-slate-900'}`}
                          onDoubleClick={() => startEditItem(item)}
                        >
                          {item.text}
                        </div>
                      )}
                      {due && (
                        <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {due}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => void cyclePriority(item)}
                      className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${PRIORITY_META[item.priority].bg} ${PRIORITY_META[item.priority].color}`}
                      title="Cycle priority"
                    >
                      <Flag className="w-3 h-3" />
                      {PRIORITY_META[item.priority].label}
                    </button>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => startEditItem(item)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void deleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {itemsError && (
              <div className="text-[11px] text-red-500 px-6 py-1.5 border-t border-slate-200 flex items-center gap-2">
                <ChevronRight className="w-3 h-3" />
                {itemsError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
